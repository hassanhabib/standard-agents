import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { GenerationDelta } from "../../../models/brokers/generators/v1/GenerationDelta.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { GuardianOrchestrationService } from "../../orchestrations/decision/guardians/GuardianOrchestrationService.js";
import type { InferenceOrchestrationService } from "../../orchestrations/decision/inferences/InferenceOrchestrationService.js";
import { resolveSkillConflict } from "./DecisionCoordinationService.Conflicts.js";
import { createTryCatch, type TryCatch } from "./DecisionCoordinationService.Exceptions.js";
import { validateContext } from "./DecisionCoordinationService.Validations.js";

const REFUSE_VERDICT = "refuse";
const ROUTE_VERDICT = "route";
const REFUSE_DIRECTION = "Refuse";
const RETURN_RESPONSE_DIRECTION = "ReturnResponse";
const REFUSAL_MESSAGE = "I'm not able to help with that.";
const MINIMUM_ACCEPTABLE_SCORE = 0.3;

// A guardian that emits one of these is trying to answer rather than classify. Invariant 6 holds
// structurally either way, a verdict is only ever read as a classification, but the attempt is
// recorded, because it is exactly the event a security review needs to see.
const OVERREACH_PREFIXES = ["FINAL:", "ACTION:", "TOOL:", "TRANSFER:", "SAY:"];

// The Decision nature (SPEC.md 4.2, 4.5): two regions, and the judgment between them. Inference
// asks the model and reads its answer; Guardian screens what goes in and scores what comes out.
// The sequence that runs them, screen, resolve a skill conflict, decide, judge, check the shape,
// belongs to neither, because every step of it depends on the other region's result.
export class DecisionCoordinationService {
  private readonly inferenceOrchestrationService: InferenceOrchestrationService;
  private readonly guardianOrchestrationService: GuardianOrchestrationService;
  private readonly loggingBroker: LoggingBroker;
  private readonly contractSchema: string;
  private readonly tryCatch: TryCatch;

  public constructor(
    inferenceOrchestrationService: InferenceOrchestrationService,
    guardianOrchestrationService: GuardianOrchestrationService,
    loggingBroker: LoggingBroker,
    contractSchema = "",
  ) {
    this.inferenceOrchestrationService = inferenceOrchestrationService;
    this.guardianOrchestrationService = guardianOrchestrationService;
    this.loggingBroker = loggingBroker;
    this.contractSchema = contractSchema;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public think(context: AgentContext): Promise<AgentContext> {
    return this.sequence(context, async (resolved) => await this.inferenceOrchestrationService.decide(resolved));
  }

  // The same sequence with the decision voiced as it is made. The guardians still run after it,
  // because a draft cannot be judged before it is finished, and a refusal that arrives after the
  // words were voiced is why the Response event is the loop's to send and never this tier's.
  public thinkStream(
    context: AgentContext,
    voice: (delta: GenerationDelta) => Promise<void>,
  ): Promise<AgentContext> {
    return this.sequence(context, async (resolved) => await this.inferenceOrchestrationService.decideStream(resolved, voice));
  }

  // The guardian sequence, run once for whichever way the turn was asked. Only the decision in
  // the middle differs between the doors, so only that is a parameter: a run watched live is
  // screened, resolved, judged and shape-checked by exactly the same steps as one read afterwards.
  private sequence(
    context: AgentContext,
    decide: (resolved: AgentContext) => Promise<AgentContext>,
  ): Promise<AgentContext> {
    return this.tryCatch(async () => {
      validateContext(context);

      const fresh = freshOfLastTurn(context);
      const verdict = await this.guardianOrchestrationService.screen(fresh.prompt);
      const refused = await this.refusedByGate(fresh, verdict);

      if (refused !== null) {
        return refused;
      }

      const routed = await this.routedByGate(fresh, verdict);
      const resolution = await resolveSkillConflict(routed, (instructions) => this.guardianOrchestrationService.detectConflict(instructions));

      if (resolution.isTerminal) {
        return resolution.context;
      }

      const decided = await decide(resolution.context);
      const isFinalAnswer = decided.directionType.toLowerCase() === RETURN_RESPONSE_DIRECTION.toLowerCase();

      // An empty answer is nothing to judge: a judge would rightly reject blank input, which
      // would crash the turn. It goes back as it is; the brain simply had nothing to say.
      if (!isFinalAnswer || decided.payload.trim().length === 0) {
        return decided;
      }

      const rejected = await this.rejectedByGuardians(resolution.context, decided);

      // Every guardian has passed, so this draft is an answer. It cannot carry a stale Revising:
      // the last turn's verdict was cleared on entry, so Revising only leaves here when a
      // guardian set it this turn.
      return rejected ?? decided;
    });
  }

  // The loop screens what a tool returned before it can become an observation. It asks here
  // because the Gate is Decision's foundation, and an instruction arriving inside data is the
  // same category of thing as an instruction arriving in a prompt.
  public screen(text: string): Promise<string> {
    return this.tryCatch(async () => await this.guardianOrchestrationService.screen(text));
  }

  // The Gate's refusal: the verdict never becomes the answer. It is recorded as the raw reply and
  // the reply is the fixed refusal message. Null when the Gate did not refuse.
  private async refusedByGate(context: AgentContext, verdict: string): Promise<AgentContext | null> {
    if (!startsWithIgnoringCase(verdict.trimStart(), REFUSE_VERDICT)) {
      return null;
    }

    await this.loggingBroker.logPayload("Decision", "Gate REFUSE", singleLine(verdict), false);

    return {
      ...context,
      intent: REFUSE_DIRECTION,
      directionType: REFUSE_DIRECTION,
      payload: REFUSAL_MESSAGE,
      rawReply: verdict,
    };
  }

  // Everything else the Gate's verdict carries. A Gate that emits FINAL or ACTION falls through
  // to the Brain and its text never becomes the answer, but the overreach is recorded (SPEC.md
  // 7.6). A route label rides through as Data and steers skill selection.
  private async routedByGate(context: AgentContext, verdict: string): Promise<AgentContext> {
    if (isGuardianOverreach(verdict)) {
      await this.loggingBroker.logProcess(
        "Decision",
        "Gate overreach: a guardian tried to answer or act instead of classifying; neutralized and passed to the Brain (Invariant 6: a guardian is never the Brain)",
      );
    }

    const isRoute = startsWithIgnoringCase(verdict.trimStart(), ROUTE_VERDICT);
    await this.loggingBroker.logPayload("Decision", isRoute ? "Gate ROUTE" : "Gate ACCEPT", singleLine(verdict), false);

    return isRoute ? { ...context, route: extractRouteLabel(verdict) } : context;
  }

  // One verdict sequence for every final draft (SPEC.md 7.6): the Judge on the merits, then the
  // Contract on the shape, in that order, because a draft that is wrong on the merits should be
  // told that, not told its punctuation is off; two rejections in one turn would spend a turn
  // teaching the model the lesser of them. Returns the Revising context carrying the feedback,
  // or null when the draft stands.
  private async rejectedByGuardians(context: AgentContext, decided: AgentContext): Promise<AgentContext | null> {
    const judgement = await this.guardianOrchestrationService.evaluate(context.prompt, decided.payload);
    const isRejected = judgement.score < MINIMUM_ACCEPTABLE_SCORE;
    const judgeOutcome = isRejected ? `REJECT: ${judgement.reason}`.replace(/[:\s]+$/, "") : "ACCEPT";

    await this.loggingBroker.logProcess("Decision", `Judge -> scored ${judgement.score.toFixed(2)} -> ${judgeOutcome}`);

    if (isRejected) {
      return revising(context, decided, revisionFeedback(judgement.reason, decided.payload));
    }

    // The schema is the one that survived precedence, riding the context from the boundary. The
    // configured field remains only for a context built by hand.
    const shape = await this.guardianOrchestrationService.checkShape(
      decided.payload,
      context.inference?.responseSchemaJson ?? this.contractSchema,
    );

    if (shape.satisfied) {
      return null;
    }

    // A rejection the trace does not explain is a turn nobody can account for.
    await this.loggingBroker.logProcess("Decision", `Contract -> REJECTED: ${shape.reason}`);

    return revising(context, decided, shapeFeedback(shape.reason, decided.payload));
  }
}

// Status and cost are Decision's outputs: what this turn's guardians concluded, and what this
// turn's model calls consumed. The incoming context may still carry the previous turn's, and
// either one leaking back out is a shipped defect: a stale Revising made the loop skip Direction
// and spin, and a stale token count billed turn one forever. Narration is a turn's output too.
function freshOfLastTurn(context: AgentContext): AgentContext {
  return {
    ...context,
    status: context.status === "Revising" ? "Working" : context.status,
    promptTokens: 0,
    completionTokens: 0,
    usageIsEstimated: false,
    narration: "",
  };
}

// The rejected draft still cost a model call, and the loop bills the turn from the context this
// hands back: a revision loop the budget cannot see is where a run burns tokens fastest.
function revising(context: AgentContext, decided: AgentContext, feedback: string): AgentContext {
  return {
    ...context,
    observations: [...context.observations, feedback],
    status: "Revising",
    promptTokens: decided.promptTokens,
    completionTokens: decided.completionTokens,
    usageIsEstimated: decided.usageIsEstimated,
  };
}

function revisionFeedback(reason: string, draft: string): string {
  return reason.trim().length === 0
    ? `A previous draft was rejected on review: ${draft}`
    : `A previous draft was rejected on review, ${reason}. The draft was: ${draft}`;
}

// Aimed, not scolding. A revision the model cannot act on is a turn spent for nothing, so the
// validator's complaint is repeated verbatim rather than summarised into "invalid".
function shapeFeedback(reason: string, draft: string): string {
  return `A previous draft was rejected because ${reason}. Reply with JSON matching the required shape and nothing else. The draft was: ${draft}`;
}

function isGuardianOverreach(verdict: string): boolean {
  const upper = verdict.toUpperCase();

  return OVERREACH_PREFIXES.some((prefix) => upper.includes(prefix));
}

function extractRouteLabel(verdict: string): string {
  return singleLine(verdict.trimStart().slice(ROUTE_VERDICT.length).replace(/^[:\s]+/, ""));
}

function singleLine(text: string): string {
  return text.replace(/\r?\n/g, " ").trim();
}

function startsWithIgnoringCase(text: string, prefix: string): boolean {
  return text.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}
