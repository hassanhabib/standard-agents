import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { createPerimeterPolicy, type PerimeterPolicy } from "../../../models/coordinations/directions/PerimeterPolicy.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { createAgentEffect, type AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import type { AgentPrincipal } from "../../../models/orchestrations/effects/AgentPrincipal.js";
import type { ApprovalVerdict } from "../../../models/orchestrations/effects/ApprovalVerdict.js";
import type { RiskLevel } from "../../../models/orchestrations/effects/RiskLevel.js";
import type { ExecutionOrchestrationService } from "../../orchestrations/direction/executions/ExecutionOrchestrationService.js";
import type { PerimeterOrchestrationService } from "../../orchestrations/direction/perimeters/PerimeterOrchestrationService.js";
import {
  alreadyReplayed,
  denied,
  isTerminal,
  observed,
  replayed,
  replayedAgain,
  toTerminalStatus,
  unreconciled,
} from "./DirectionCoordinationService.Effects.js";
import { createTryCatch, type TryCatch } from "./DirectionCoordinationService.Exceptions.js";
import { validateContext } from "./DirectionCoordinationService.Validations.js";

// The Direction nature (SPEC.md 4.2, 4.9): two regions, and the order between them. Perimeter
// answers whether an act may happen; Execution performs it. Neither can own the sequence,
// because the sequence interleaves them: authorize, record the intent, approve, execute at most
// once, record the outcome. The order is the control: authorizing after execution audits a fait
// accompli, recording the intent after execution loses the effects that crashed mid-flight, and
// approving after execution is not approval at all.
export class DirectionCoordinationService {
  private readonly perimeterOrchestrationService: PerimeterOrchestrationService;
  private readonly executionOrchestrationService: ExecutionOrchestrationService;
  private readonly loggingBroker: LoggingBroker;
  private readonly policy: PerimeterPolicy;
  private readonly irreversibleToolNames: ReadonlySet<string>;
  private readonly advertisedToolNames: ReadonlySet<string>;
  private readonly tryCatch: TryCatch;

  public constructor(
    perimeterOrchestrationService: PerimeterOrchestrationService,
    executionOrchestrationService: ExecutionOrchestrationService,
    loggingBroker: LoggingBroker,
    policy: Partial<PerimeterPolicy> = {},
  ) {
    this.perimeterOrchestrationService = perimeterOrchestrationService;
    this.executionOrchestrationService = executionOrchestrationService;
    this.loggingBroker = loggingBroker;
    this.policy = createPerimeterPolicy(policy);
    this.irreversibleToolNames = new Set(this.policy.irreversibleTools.map((name) => name.toLowerCase()));
    this.advertisedToolNames = new Set(this.policy.advertisedTools.map((name) => name.toLowerCase()));
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public act(context: AgentContext): Promise<AgentContext> {
    return this.tryCatch(async () => {
      validateContext(context);

      if (isTerminal(context.directionType)) {
        const result = await this.executionOrchestrationService.return(context.payload);
        await this.loggingBroker.logPayload("Direction", `${context.directionType} returned`, result, false);

        return { ...context, result, status: toTerminalStatus(context.directionType) };
      }

      // A call naming a caller tool is not an act: it is a terminal answer addressed to the
      // caller, classified before the perimeter because there is nothing for the perimeter to
      // judge. The agent performs nothing.
      if (isAddressedToCaller(context)) {
        return await this.awaitCaller(context);
      }

      return await this.actOnEffect(context);
    });
  }

  // The run pauses; something outside this process must act and report back. Built for human
  // approval, structurally identical here: the authority over this pending effect is the caller,
  // which executes, posts the result on the session, and the run resumes.
  private async awaitCaller(context: AgentContext): Promise<AgentContext> {
    const effect: AgentEffect = {
      ...createAgentEffect(currentRunId(), context.directionType, context.payload, "Safe", false, this.principal()),
      callId: context.toolCallId,
    };

    await this.loggingBroker.logProcess(
      "Direction",
      `Caller tool '${context.directionType}' -> returned to the caller as a pending effect`,
    );

    return {
      ...context,
      result: `'${context.directionType}' is addressed to the caller; awaiting its result.`,
      pendingEffect: effect,
      status: "AwaitingInput",
    };
  }

  private async actOnEffect(context: AgentContext): Promise<AgentContext> {
    // 0. The offering (SPEC.md 4.15, enforced): an advertised tool the run was not offered is
    // denied before it becomes an act, because a Brain outside this loop can carry side-channel
    // knowledge of the catalog and name a tool the run was never shown.
    if (this.deniedBecauseSelectionWithheldIt(context.directionType)) {
      await this.loggingBroker.logProcess(
        "Direction",
        `Selection -> DENIED '${context.directionType}': not offered to this run`,
      );

      return denied(
        context,
        `tool '${context.directionType}' was not offered to this run: selection withheld it. Choose among the offered tools or answer directly.`,
      );
    }

    // Who is acting is asked at the moment the act is described, so the policy deciding whether
    // it may happen is told, not merely the record written afterwards (SPEC.md 4.9).
    const effect = createAgentEffect(
      currentRunId(),
      context.directionType,
      context.payload,
      this.riskLevelFor(context.directionType),
      this.requiresApproval(context.directionType),
      this.principal(),
      this.scopeFor(context.directionType, context.payload),
    );

    // 1. Authorize.
    const decision = await this.perimeterOrchestrationService.authorize(effect);

    if (!decision.permitted) {
      return denied(context, decision.reason);
    }

    // 1b. The mode's answer for an act nothing named, under Deny: refused before its intent is
    // recorded, exactly as a policy denial is. An act RequireApproval names was mentioned, so it
    // travels to its authority below; the mode speaks only for what no permission mentioned.
    if (this.deniedBecauseNothingPermitsIt(effect)) {
      await this.loggingBroker.logProcess(
        "Direction",
        `Permissions -> DENIED '${effect.toolName}': nothing explicitly permits it`,
      );

      return denied(
        context,
        `tool '${effect.toolName}' is not permitted: nothing explicitly permits it and the permission mode is Deny`,
      );
    }

    // 2. Record the intent, and learn what the ledger knows about this act.
    const claim = await this.perimeterOrchestrationService.claim(effect);

    if (claim.verdict === "Replay") {
      // Once is a replay, with a note saying so. From the third identical call on it is the note
      // alone: the bytes have been handed back twice, and a third copy costs the person context and
      // buys the model nothing it did not already have.
      if (alreadyReplayed(context, effect.toolName, claim.outcome ?? "")) {
        await this.loggingBroker.logProcess("Direction", `'${effect.toolName}' asked for a third time with the same arguments -> note only`);

        return observed(context, replayedAgain(effect.toolName));
      }

      return observed(context, replayed(effect.toolName, claim.outcome ?? ""));
    }

    if (claim.verdict === "InProgress") {
      return denied(
        context,
        `'${effect.toolName}' is already in progress in another run; it was not performed again. Wait for that run, or answer with what you know.`,
      );
    }

    if (claim.verdict === "Unreconciled") {
      return unreconciled(context, effect, claim.record);
    }

    // 3. Approve, if required by name or by the mode: Ask is the disposition toward everything
    // nobody mentioned. A grant is remembered for the tool and the scope it was given for,
    // exactly; an act with no named scope remembers nothing, because remembering the empty scope
    // would collapse the key to the tool name.
    if (effect.approvalRequired || this.askBecauseNothingPermittedIt(effect)) {
      const held = await this.heldForApproval(context, effect);

      if (held !== null) {
        return held;
      }
    }

    // 4. Execute. A tool that throws leaves the world in an unknown state, and the ledger says
    // so: the claim is marked failed, never released, so a repeat is held rather than performed
    // blind.
    let output: string;

    try {
      output = await this.executionOrchestrationService.run(effect.toolName, context.payload, AgentRun.current()?.signal);
    } catch (error: unknown) {
      await this.perimeterOrchestrationService.recordFailure(effect, error instanceof Error ? error.message : String(error));

      throw error;
    }

    // 4b. An act that refused itself did not happen, and the tool is the only thing that can say
    // so: a refusal comes back as an answer rather than a throw, because the next turn can act on
    // it. The claim is let go rather than filled in, so the same call runs once the model has done
    // what the refusal asked of it.
    //
    // Recording it instead made the refusal permanent. A model told "this run has not read the
    // file, read it and call again" read the file, called again, and was handed its own refusal
    // back from the record, three times over, while the file was never written.
    if (!this.performedBy(effect.toolName, output)) {
      await this.perimeterOrchestrationService.releaseClaim(effect);
      await this.loggingBroker.logProcess(
        "Direction",
        `Run-once -> '${effect.toolName}' performed nothing; the claim was released so it may run again`,
      );

      await this.loggingBroker.logPayload("Direction", `Tool '${effect.toolName}' input`, context.payload, true);
      await this.loggingBroker.logPayload("Direction", `Tool '${effect.toolName}' output`, output, false);

      return observed(context, output);
    }

    // Remembered before the outcome is recorded, because the store can fail after the act
    // succeeded, and an act that happened must still be compensable. Only performed acts: an
    // effect denied, held, replayed or refused was never performed by this run.
    AgentRun.current()?.recordPerformed({
      toolName: effect.toolName,
      arguments: effect.arguments,
      outcome: output,
      idempotencyKey: effect.idempotencyKey,
    });

    // 5. Record the outcome, before the loop advances.
    await this.perimeterOrchestrationService.recordOutcome(effect, output);
    await this.loggingBroker.logPayload("Direction", `Tool '${effect.toolName}' input`, context.payload, true);
    await this.loggingBroker.logPayload("Direction", `Tool '${effect.toolName}' output`, output, false);

    return observed(context, output);
  }

  // Null when the authority said yes (or already had); otherwise the context the held act ends
  // the turn with.
  private async heldForApproval(context: AgentContext, effect: AgentEffect): Promise<AgentContext | null> {
    const run = AgentRun.current();
    const scopeIsNamed = effect.scope.length > 0;

    if (scopeIsNamed && run !== null && run.wasGranted(effect.toolName, effect.scope)) {
      await this.loggingBroker.logProcess("Direction", `Approval -> already granted '${effect.toolName}' at '${effect.scope}'`);

      return null;
    }

    const approval = await this.perimeterOrchestrationService.requestApproval(effect);

    if (approval !== "Approved") {
      return await this.unapproved(context, effect, approval);
    }

    if (scopeIsNamed) {
      run?.rememberGrant(effect.toolName, effect.scope);
    }

    return null;
  }

  // The act was held, not performed, so the claim taken when its intent was recorded is given
  // back (SPEC.md 4.9). Leaving it standing would make the approval unusable when it finally
  // arrives: the authority says yes, the resumed run proposes the act, and the ledger reports it
  // as already done.
  private async unapproved(context: AgentContext, effect: AgentEffect, approval: ApprovalVerdict): Promise<AgentContext> {
    await this.perimeterOrchestrationService.releaseClaim(effect);

    if (approval === "Denied") {
      await this.loggingBroker.logProcess("Direction", `Approval -> DENIED '${effect.toolName}'; the claim was released`);

      return denied(context, `approval denied for '${effect.toolName}'`);
    }

    // Pending: the act is held, not performed. Waiting is not consent (SPEC.md 4.9). The act
    // travels with the pause, so whoever resumes can be shown what they are permitting.
    await this.loggingBroker.logProcess(
      "Direction",
      `Approval -> PENDING '${effect.toolName}'; the effect was not performed and the claim was released`,
    );

    return {
      ...context,
      result: `'${effect.toolName}' is waiting for approval before it can run.`,
      pendingEffect: effect,
      status: "AwaitingApproval",
    };
  }

  // The host classifies first, because it is accountable for the deployment and can speak for
  // tools it did not write. Then the tool, which is the only thing that knows what it does.
  // Requiring approval still implies Irreversible when nobody said otherwise.
  private riskLevelFor(toolName: string): RiskLevel {
    const hostDeclared = this.policy.declaredRisk.get(toolName);

    if (hostDeclared !== undefined) {
      return hostDeclared;
    }

    const toolDeclared = this.policy.toolRisk.get(toolName);

    if (toolDeclared !== undefined && toolDeclared !== "Safe") {
      return toolDeclared;
    }

    return this.requiresApproval(toolName) ? "Irreversible" : "Safe";
  }

  // What the act is about to touch, as the tool named it. The framework never parses arguments.
  private scopeFor(toolName: string, effectArguments: string): string {
    const scopeOf = this.policy.toolScope.get(toolName);

    return scopeOf === undefined ? "" : scopeOf(effectArguments);
  }

  // Whether the act happened, as the tool reads its own outcome. A tool that says nothing is a
  // tool that only answers when it did something, which is every tool that raises on failure.
  private performedBy(toolName: string, output: string): boolean {
    const performed = this.policy.toolPerformed.get(toolName);

    return performed === undefined || performed(output);
  }

  private principal(): AgentPrincipal | null {
    return this.policy.identityResolver === null ? null : this.policy.identityResolver();
  }

  private requiresApproval(toolName: string): boolean {
    return this.irreversibleToolNames.has(toolName.toLowerCase());
  }

  // The mode speaks only for what the explicit permissions did not mention. An allow-list that
  // names the tool has already answered the question, and a host policy is assumed to have said
  // what it meant.
  private askBecauseNothingPermittedIt(effect: AgentEffect): boolean {
    return this.policy.mode === "Ask" && !this.explicitlyPermits(effect);
  }

  // Deny's twin, sharing the reading of "explicitly permitted" so the two modes cannot drift.
  private deniedBecauseNothingPermitsIt(effect: AgentEffect): boolean {
    return this.policy.mode === "Deny" && !effect.approvalRequired && !this.explicitlyPermits(effect);
  }

  private explicitlyPermits(effect: AgentEffect): boolean {
    return this.policy.explicitlyPermits !== null && this.policy.explicitlyPermits(effect);
  }

  // Enforcement speaks only where selection spoke: a run with no recorded offering has nothing
  // to enforce, and a name selection never saw is not selection's to withhold.
  private deniedBecauseSelectionWithheldIt(toolName: string): boolean {
    const offered = AgentRun.current()?.offeredTools ?? null;

    if (!this.policy.enforceSelection || offered === null || !this.isAdvertised(toolName)) {
      return false;
    }

    return !offered.some((name) => name.toLowerCase() === toolName.toLowerCase());
  }

  // Advertised is what selection could have offered: the agent's described tools and the
  // described remote tools this run discovered.
  private isAdvertised(toolName: string): boolean {
    if (this.advertisedToolNames.has(toolName.toLowerCase())) {
      return true;
    }

    const remoteTools = AgentRun.current()?.remoteTools ?? [];

    return remoteTools.some((tool) => tool.description.trim().length > 0 && tool.name.toLowerCase() === toolName.toLowerCase());
  }
}

function currentRunId(): string {
  return AgentRun.current()?.id ?? "";
}

// The boundary already dropped any caller tool sharing a configured name, so a name found here
// has exactly one meaning: the caller's.
function isAddressedToCaller(context: AgentContext): boolean {
  const callerTools = context.inference?.callerTools ?? [];

  return callerTools.some((tool) => tool.name.toLowerCase() === context.directionType.toLowerCase());
}
