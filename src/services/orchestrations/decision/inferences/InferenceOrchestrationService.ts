import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { GenerationDelta } from "../../../../models/brokers/generators/v1/GenerationDelta.js";
import type { ToolDefinition } from "../../../../models/brokers/generators/v1/ToolDefinition.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import type { AgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";
import type { BrainService } from "../../../foundations/brains/BrainService.js";
import type { UsageService } from "../../../foundations/usages/UsageService.js";
import { createTryCatch, type TryCatch } from "./InferenceOrchestrationService.Exceptions.js";
import { buildAsk, droppedCallIds, interpretNatively } from "./InferenceOrchestrationService.Native.js";
import { buildUserMessage, interpret } from "./InferenceOrchestrationService.Protocol.js";

// The model call, and how its answer is read (SPEC.md 6). One foundation, but a region rather
// than a pass-through: shaping what the model is shown and reading its reply back into an
// intent is the substance of this nature. Whether that reading was right is the Guardian's
// question, not this one's.
//
// Two protocols, one outcome. The text protocol reads a line and decides what it meant; the
// native protocol reads a structure and decides the same thing. Which one runs is the brain's
// answer, not a caller's argument, so nothing above this tier learns that there are two.
export class InferenceOrchestrationService {
  private readonly brainService: BrainService;
  private readonly usageService: UsageService;
  private readonly loggingBroker: LoggingBroker;
  private readonly toolDefinitions: readonly ToolDefinition[];
  private readonly tryCatch: TryCatch;

  public constructor(
    brainService: BrainService,
    usageService: UsageService,
    loggingBroker: LoggingBroker,
    toolDefinitions: readonly ToolDefinition[] = [],
  ) {
    this.brainService = brainService;
    this.usageService = usageService;
    this.loggingBroker = loggingBroker;
    this.toolDefinitions = toolDefinitions;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public decide(context: AgentContext): Promise<AgentContext> {
    return this.tryCatch(async () => {
      return this.brainService.speaksNatively ? await this.decideNatively(context) : await this.decideTextually(context);
    });
  }

  // The same decision, voiced as it is made (SPEC.md 6.2). It reaches the same context the
  // batched door reaches, by the same reading, because a run watched live and a run read
  // afterwards must be able to disagree about nothing except when the words arrived.
  //
  // Every profile can be streamed. A brain that has no native protocol cannot stream a structured
  // turn, so its answer is voiced once when it lands: later than a native brain's, and the same
  // answer. The alternative, refusing the streamed door on a text profile, would make the door a
  // property of the provider rather than of the agent.
  public decideStream(context: AgentContext, voice: (delta: GenerationDelta) => Promise<void>): Promise<AgentContext> {
    return this.tryCatch(async () => {
      if (!this.brainService.speaksNatively) {
        const decided = await this.decideTextually(context);
        await voiceWhole(decided, voice);

        return decided;
      }

      const generation = await this.brainService.generateNativelyStream(buildAsk(context, this.toolDefinitions), voice, stopOf());
      const decided = interpretNatively(context, generation);
      await this.warnAboutDroppedCalls(generation.toolCalls.length, droppedCallIds(generation));
      await this.narrateDecided(decided, generation.content);

      return decided;
    });
  }

  private async decideNatively(context: AgentContext): Promise<AgentContext> {
    const generation = await this.brainService.generateNatively(buildAsk(context, this.toolDefinitions), stopOf());
    const decided = interpretNatively(context, generation);
    await this.warnAboutDroppedCalls(generation.toolCalls.length, droppedCallIds(generation));
    await this.narrateDecided(decided, generation.content);

    return decided;
  }

  private async decideTextually(context: AgentContext): Promise<AgentContext> {
    const userMessage = buildUserMessage(context);

    // The context carries the resolution's output from the boundary; this tier hands it on
    // and learns nothing from it. A context built by hand carries none: the plain call.
    const reply = context.inference === null
      ? await this.brainService.generate(context.systemPrompt, userMessage)
      : await this.brainService.generate(context.systemPrompt, userMessage, context.inference);

    const decided = await this.measured(interpret(context, reply.trim()), context.systemPrompt + userMessage, reply);
    await this.narrateDecided(decided, reply.trim());

    return decided;
  }

  // A model may propose several calls in one turn. The loop performs one act per turn, so the rest
  // are dropped, and they are named rather than dropped quietly, because a call that vanishes
  // without a word is one the model will keep making.
  private async warnAboutDroppedCalls(callCount: number, dropped: readonly string[]): Promise<void> {
    if (dropped.length === 0) {
      return;
    }

    await this.loggingBroker.logProcess(
      "Decision",
      `Brain -> proposed ${callCount} calls in one turn; performing the first and dropping [${dropped.join(", ")}]`,
      true,
    );
  }

  // The provider's own report wins whenever there is one; counting is the fallback, and it says
  // which it was, because a bound enforced on an estimate and a bound reconciled against a bill
  // are different claims (SPEC.md 3.4). Without this, a text-protocol run reported zero tokens
  // every turn and every budget it was given silently did nothing.
  private async measured(decided: AgentContext, sent: string, received: string): Promise<AgentContext> {
    if (decided.promptTokens > 0 || decided.completionTokens > 0) {
      return decided;
    }

    const usage = await this.usageService.measure(sent, received);

    return {
      ...decided,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      usageIsEstimated: usage.isEstimated,
    };
  }

  // One narration for the model call, whichever door drove it, so a batched run's trace shows
  // what its own model calls cost exactly as a streamed one does.
  private async narrateDecided(decided: AgentContext, reply: string): Promise<void> {
    await this.loggingBroker.logPayload("Decision", "Brain replied", reply, true);

    await this.loggingBroker.logProcess(
      "Decision",
      `Brain -> ${decided.promptTokens + decided.completionTokens} tokens (${decided.usageIsEstimated ? "counted" : "reported"})`,
      true,
    );

    await this.loggingBroker.logProcess("Decision", `Interpreted -> ${decided.directionType}`);
  }
}

// A turn that was never streamed, said once so the streamed door has something to say. Narration
// first and the answer after, which is the order a native brain produces them in, so a consumer
// reading the two protocols sees one shape.
async function voiceWhole(decided: AgentContext, voice: (delta: GenerationDelta) => Promise<void>): Promise<void> {
  if (decided.narration.length > 0) {
    await voice({ content: "", narration: decided.narration, completed: null });
  }

  if (decided.payload.length > 0) {
    await voice({ content: decided.payload, narration: "", completed: null });
  }
}

// The run's own stop, read off the ambient run rather than threaded through every signature. The
// longest thing in a turn is the model answering, and a stop that only took effect between turns
// would be a button that does nothing for the ninety seconds somebody most wants it to.
//
// Read where this tier already reads the run's offering, two tiers below the loop, so no caller
// gains an argument for it and no test has to pass one it does not care about.
function stopOf(): AbortSignal | undefined {
  return AgentRun.current()?.signal;
}
