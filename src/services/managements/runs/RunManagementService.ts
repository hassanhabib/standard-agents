import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import { createResolvedInference, type ResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import { sanitizeProviderOptions } from "../../../models/brokers/generators/ProviderOptions.js";
import type { ToolDefinition } from "../../../models/brokers/generators/v1/ToolDefinition.js";
import type { McpTool } from "../../../models/brokers/mcps/McpTool.js";
import type { AgentOutcome } from "../../../models/clients/agents/AgentOutcome.js";
import type { AgentStreamEvent } from "../../../models/clients/agents/AgentStreamEvent.js";
import { createPromptRequest, type PromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import { createRunOptions, type RunOptions } from "../../../models/managements/runs/RunOptions.js";
import { createAgentContext, type AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { DataCoordinationService } from "../../coordinations/data/DataCoordinationService.js";
import type { DecisionCoordinationService } from "../../coordinations/decision/DecisionCoordinationService.js";
import type { DirectionCoordinationService } from "../../coordinations/direction/DirectionCoordinationService.js";
import type { AgentFailureCode } from "../../../models/clients/agents/AgentFailure.js";
import { CANCELLED_MESSAGE, CIRCLES_MESSAGE, exhaustion, goingInCircles, type AgentSpend } from "./RunManagementService.Budgets.js";

// Which kind of stop it was, for the caller that switches on codes rather than reading sentences.
function failureCodeFor(stoppedBecause: string, identicalCallLimit: number): AgentFailureCode {
  if (stoppedBecause === CANCELLED_MESSAGE) {
    return "cancelled";
  }

  if (stoppedBecause === CIRCLES_MESSAGE(identicalCallLimit)) {
    return "going_in_circles";
  }

  return "budget_exhausted";
}
import { createTryCatch, type TryCatch } from "./RunManagementService.Exceptions.js";
import { createLiveNarrator, voiceNarration, voiceObservedNarration } from "./RunManagementService.Narration.js";
import { screened } from "./RunManagementService.Screening.js";
import { beginSession, loadSession, peekSession, resumedRunId, saveSession } from "./RunManagementService.Sessions.js";
import { validatePrompt } from "./RunManagementService.Validations.js";

const RETRIES_EXHAUSTED_MESSAGE = "I can't help with that at the moment.";
const TURNS_EXHAUSTED_MESSAGE = "I ran out of turns before an answer was ready; nothing was delivered.";

export type EventSink = (event: AgentStreamEvent) => Promise<void>;

const NO_SINK: EventSink = async () => {};

// The loop, deliberately the only copy (SPEC.md 7.6). Two things differ between the doors, and
// both are named here: which events anybody reads (the batched caller discards them), and
// nothing else. A control that exists on one door and not the other is not a control.
export class RunManagementService {
  private readonly dataCoordinationService: DataCoordinationService;
  private readonly decisionCoordinationService: DecisionCoordinationService;
  private readonly directionCoordinationService: DirectionCoordinationService;
  private readonly timeBroker: TimeBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly options: RunOptions;
  private readonly configuredToolNames: ReadonlySet<string>;
  private readonly tryCatch: TryCatch;

  public constructor(
    dataCoordinationService: DataCoordinationService,
    decisionCoordinationService: DecisionCoordinationService,
    directionCoordinationService: DirectionCoordinationService,
    timeBroker: TimeBroker,
    loggingBroker: LoggingBroker,
    options: RunOptions = createRunOptions(),
  ) {
    this.dataCoordinationService = dataCoordinationService;
    this.decisionCoordinationService = decisionCoordinationService;
    this.directionCoordinationService = directionCoordinationService;
    this.timeBroker = timeBroker;
    this.loggingBroker = loggingBroker;
    this.options = options;
    this.configuredToolNames = new Set(options.configuredToolNames.map((name) => name.toLowerCase()));
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  // The batched projection: the answer alone, for a caller who should not have to know there was
  // more. A plain prompt is a request that expressed no opinions: one path, not two modes.
  public async processPrompt(prompt: string, sessionId = "", signal?: AbortSignal): Promise<string> {
    return (await this.run(createPromptRequest(prompt, sessionId), signal)).result;
  }

  // The run reported with how it ended, which a caller nesting this agent inside another cannot
  // do without: held and answered read alike as strings.
  public run(request: PromptRequest, signal?: AbortSignal): Promise<AgentOutcome> {
    return this.tryCatch(async () => await this.runTheLoop(request, NO_SINK, false, signal));
  }

  // The same loop with its events delivered as they happen: the seam the streamed door stands on.
  public runWithEvents(request: PromptRequest, emit: EventSink, signal?: AbortSignal): Promise<AgentOutcome> {
    return this.tryCatch(async () => await this.runTheLoop(request, emit, false, signal));
  }

  // The streamed door (SPEC.md 4.14). The same loop, the same guardians and the same events;
  // what differs is that the decision is watched as it is made, so narration reaches the user
  // while the model is still writing rather than after it has stopped.
  public runStreamed(request: PromptRequest, emit: EventSink, signal?: AbortSignal): Promise<AgentOutcome> {
    return this.tryCatch(async () => await this.runTheLoop(request, emit, true, signal));
  }

  private async runTheLoop(
    request: PromptRequest,
    emit: EventSink,
    streaming: boolean,
    signal: AbortSignal | undefined,
  ): Promise<AgentOutcome> {
    validatePrompt(request.prompt, request.decision !== null);

    // Read before the run begins: a session that never delivered an answer was interrupted, and
    // the next prompt in it continues that run rather than starting a fresh one.
    const session = await peekSession(this.dataCoordinationService, request.sessionId, this.currentPrincipal());

    // This prompt's run (SPEC.md 4.4): one instance serves prompts concurrently, and each
    // invocation establishes its own identity, so everything recorded below is credited to it.
    return await AgentRun.begin(resumedRunId(session), signal, async () => {
      // When this run began, for the turn it will write. Taken at the top rather than beside the
      // budget's own stamp further down: what somebody means by how long a turn took is everything
      // between asking and being answered, and the work before the first turn is part of that.
      //
      // From the clock the run was given, like every other moment this service records, because a
      // service that read the wall clock is a service no test can place at a particular moment.
      const began = this.timeBroker.getCurrentDateTime();
      const run = AgentRun.current();

      if (run !== null) {
        run.prompt = request.prompt;
        run.decision = request.decision;
      }

      await this.loggingBroker.logReset();
      await this.announceResolution(request);
      await this.offerTools(request.prompt);

      // Precedence resolved once, at the top of the run, and never again below it. The caller's
      // transcript seeds the run; a session, when one exists, overwrites the history below.
      let context: AgentContext = {
        ...createAgentContext(request.prompt),
        sessionId: request.sessionId,
        history: request.history,
        toolExchanges: request.toolExchanges,
        inference: this.resolve(request),
      };

      // The start-of-run checkpoint, written before any work is done (SPEC.md 4.11), and the
      // conversation so far, loaded before Decision runs so the Brain sees it.
      await beginSession(this.dataCoordinationService, this.loggingBroker, context.sessionId, this.currentPrincipal());
      context = await loadSession(this.loggingBroker, context, session, this.options.maxHistoryTurns);

      // Budgets and cancellation are both checked at the turn boundary (SPEC.md 4.10): a turn
      // is the smallest unit the loop can stop between without leaving an effect half-recorded.
      const spend: AgentSpend = { tokens: 0 };
      const startedOn = this.timeBroker.getCurrentDateTime();
      let stoppedBecause: string | null = null;

      for (let turn = 0; turn < this.options.maxTurns; turn++) {
        if (signal?.aborted === true) {
          stoppedBecause = CANCELLED_MESSAGE;
          break;
        }

        const exhausted = exhaustion(this.options.budget, spend, startedOn, this.timeBroker.getCurrentDateTime());

        if (exhausted !== null) {
          stoppedBecause = exhausted;
          break;
        }

        await this.loggingBroker.logTurn(turn);
        await this.loggingBroker.logStep("Data");
        context = await this.dataCoordinationService.recall(context);
        await this.loggingBroker.logStep("Decision");
        // The one difference between the doors, and it is only about when the words arrive: the
        // streamed door watches the decision being made and voices each finished narration line
        // once the Gate has passed it. Everything else in this turn is identical.
        const narrator = createLiveNarrator(this.decisionCoordinationService, this.loggingBroker, emit);

        if (streaming) {
          context = await this.decisionCoordinationService.thinkStream(context, async (delta) => {
            await narrator.accept(delta.narration);
          });

          await narrator.flush();
        } else {
          context = await this.decisionCoordinationService.think(context);
        }
        spend.tokens += context.promptTokens + context.completionTokens;

        if (context.status === "Revising") {
          await this.loggingBroker.logOutcome(`turn ${turn}: revising`);
          continue;
        }

        await this.loggingBroker.logStep("Direction");

        // Voiced before the act it announces, screened first (SPEC.md Invariant 5).
        await voiceNarration(this.decisionCoordinationService, this.loggingBroker, this.options.toolNarrations, context, emit, narrator.narrated);

        // Screened before the Tool event below: a caller watching the stream must not receive
        // the text the Brain was protected from (SPEC.md 4.9).
        const observedBefore = context.observations.length;
        context = await this.directionCoordinationService.act(context);
        context = await screened(this.decisionCoordinationService, this.loggingBroker, this.options.screenToolOutput, context, observedBefore);
        await this.loggingBroker.logOutcome(`turn ${turn}: ${context.status}`);

        if (context.status === "Working" && context.result.length > 0) {
          await voiceObservedNarration(this.loggingBroker, this.options.toolNarrations, context, emit);
          await emit({ type: "Tool", content: `${context.directionType}: ${context.result}` });
        }

        // The same act, asked for as many times as the deployment allows, ends the run here. The
        // perimeter has already answered it with a replay, a note, and the note alone; a model
        // still asking is going in circles, and every turn it is given from here is the same turn.
        if (context.status === "Working" && goingInCircles(context.toolExchanges, this.options.identicalCallLimit)) {
          stoppedBecause = CIRCLES_MESSAGE(this.options.identicalCallLimit);
          break;
        }

        // A held act is announced before its message: the Status event says what happened for
        // a consumer that switches on kinds, and the Response carries the same words the
        // batched caller receives.
        if (context.status === "AwaitingApproval") {
          await emit({ type: "Status", content: "an act is waiting for approval; the run is held" });
        }

        if (isDelivered(context) && context.result.length > 0) {
          await emit({ type: "Response", content: context.result });
        }

        if (context.status !== "Working") {
          break;
        }
      }

      // Cancelled or out of budget: reported as a Status rather than a Response, because it is
      // not an answer, and never remembered or written back as one (SPEC.md 4.10, 4.11).
      if (stoppedBecause !== null) {
        await this.loggingBroker.logOutcome(`stopped: ${stoppedBecause}`);
        await emit({ type: "Status", content: stoppedBecause });
        await this.loggingBroker.logOutcome("done: Failed");

        return {
          result: stoppedBecause,
          status: "Failed",
          pendingEffect: null,
          failure: {
            category: "Service",
            code: failureCodeFor(stoppedBecause, this.options.identicalCallLimit),
            message: stoppedBecause,
          },
        };
      }

      // Turns ran out with the loop still Working: no answer was delivered, and the last tool
      // output is not one. Told the same way as a budget stop, and no session write, so the next
      // prompt resumes the interrupted run. Status stays Working: the run stopped mid-work.
      if (context.status === "Working") {
        await this.loggingBroker.logOutcome(`stopped: ${TURNS_EXHAUSTED_MESSAGE}`);
        await emit({ type: "Status", content: TURNS_EXHAUSTED_MESSAGE });
        await this.loggingBroker.logOutcome("done: Working");

        return {
          result: TURNS_EXHAUSTED_MESSAGE,
          status: "Working",
          pendingEffect: null,
          failure: { category: "Service", code: "turns_exhausted", message: TURNS_EXHAUSTED_MESSAGE },
        };
      }

      if (context.status === "Revising") {
        await emit({ type: "Status", content: "unable to satisfy review after retries; refusing" });
        await emit({ type: "Response", content: RETRIES_EXHAUSTED_MESSAGE });
        context = { ...context, result: RETRIES_EXHAUSTED_MESSAGE, status: "Refused" };
      }

      await this.loggingBroker.logOutcome(`done: ${context.status}`);

      if (context.remember.length > 0) {
        await this.dataCoordinationService.remember(context.remember);
      }

      // Appended before the run ends, so the next prompt sees it (SPEC.md 4.11).
      await saveSession(this.dataCoordinationService, this.loggingBroker, this.timeBroker, context, this.currentPrincipal(), began);

      // The pending effect rides the outcome as well as the session: a stateless deployment has
      // no session, and an exposer that cannot reach the pending call cannot yield it.
      return { result: context.result, status: context.status, pendingEffect: context.pendingEffect, failure: null };
    });
  }

  // Precedence, per field: configured, then the request, then the framework default (SPEC.md
  // 4.13). What is hard-configured takes precedence always; a caller can never widen the
  // boundary the deployment set. One schema survives, never merged, and it seeds the wire and
  // the guardian alike.
  private resolve(request: PromptRequest): ResolvedInference {
    const defaults = createResolvedInference();
    const configuredSchema = this.options.contractSchema;

    return {
      temperature: this.options.configuredTemperature ?? request.temperature ?? defaults.temperature,
      maxTokens: this.options.configuredMaxTokens ?? request.maxTokens ?? defaults.maxTokens,
      seed: request.seed,
      stop: request.stop,
      responseSchemaJson: configuredSchema !== null && configuredSchema.trim().length > 0 ? configuredSchema : request.responseSchemaJson,
      callerTools: this.withoutConfiguredNames(request.callerTools),
      providerOptionsJson: sanitizeProviderOptions(request.providerOptionsJson).json,
    };
  }

  // Said in the trace: a rejection the trace does not explain is a turn nobody can account for,
  // and a caller whose schema was discarded or whose passthrough key was stripped deserves the
  // same courtesy the guardians extend.
  private async announceResolution(request: PromptRequest): Promise<void> {
    const configuredSchema = this.options.contractSchema;

    if (configuredSchema !== null && configuredSchema.trim().length > 0 && request.responseSchemaJson !== null && request.responseSchemaJson.trim().length > 0) {
      await this.loggingBroker.logProcess("Run", "Contract -> request schema discarded; the configured Contract wins");
    }

    const sanitized = sanitizeProviderOptions(request.providerOptionsJson);

    if (sanitized.malformed) {
      await this.loggingBroker.logProcess("Run", "Provider options -> ignored: not a JSON object");
    }

    if (sanitized.strippedKeys.length > 0) {
      await this.loggingBroker.logProcess("Run", `Provider options -> stripped core-owned key(s): ${sanitized.strippedKeys.join(", ")}`);
    }

    for (const tool of request.callerTools) {
      if (this.configuredToolNames.has(tool.name.toLowerCase())) {
        await this.loggingBroker.logProcess("Run", `Caller tools -> '${tool.name}' dropped; a configured tool owns that name`);
      }
    }
  }

  // A caller tool sharing a configured name is dropped, so a call carrying that name has exactly
  // one meaning: the configured tool, executed locally, under every configured control.
  private withoutConfiguredNames(callerTools: readonly ToolDefinition[]): readonly ToolDefinition[] {
    return callerTools.filter((tool) => !this.configuredToolNames.has(tool.name.toLowerCase()));
  }

  // Selection (SPEC.md 4.15): what this run is offered, resolved once at the top and carried on
  // the run. The remote tools are discovered first, so a selector can see and withhold them, and
  // the record states the truth of the offering, never the selector's claim.
  private async offerTools(prompt: string): Promise<void> {
    const run = AgentRun.current();
    const remoteTools = await this.dataCoordinationService.retrieveRemoteTools();

    if (run !== null) {
      run.remoteTools = remoteTools;
    }

    if (this.options.toolSelector === null || run === null) {
      return;
    }

    const described = this.describedToolNames(remoteTools);
    const chosen = await this.options.toolSelector(prompt, described);
    const offered = described.filter((name) => chosen.some((choice) => choice.toLowerCase() === name.toLowerCase()));
    const withheld = described.filter((name) => !offered.includes(name));
    run.offeredTools = offered;

    await this.loggingBroker.logProcess("Run", `Selection -> offered [${offered.join(", ")}]; withheld [${withheld.join(", ")}]`);
  }

  // The described names selection judges over: the agent's own, then its servers', because a
  // description is the opt-in for both, and a remote name the agent already carries is the local
  // tool's: first to claim a name keeps it.
  private describedToolNames(remoteTools: readonly McpTool[]): readonly string[] {
    const local = this.options.describedToolNames;
    const localLower = new Set(local.map((name) => name.toLowerCase()));

    const remote = remoteTools
      .filter((tool) => tool.description.trim().length > 0 && !localLower.has(tool.name.toLowerCase()))
      .map((tool) => tool.name);

    return [...local, ...remote];
  }

  private currentPrincipal(): string {
    return this.options.principalResolver === null ? "" : (this.options.principalResolver()?.id ?? "");
  }
}

function isDelivered(context: AgentContext): boolean {
  return (
    context.status === "Responded" ||
    context.status === "Refused" ||
    context.status === "AwaitingInput" ||
    context.status === "AwaitingApproval"
  );
}
