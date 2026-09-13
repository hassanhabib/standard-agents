import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { TimeBroker } from "../../../../brokers/times/TimeBroker.js";
import type { EffectRecord } from "../../../../models/brokers/effects/EffectRecord.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import type { AgentEffect } from "../../../../models/orchestrations/effects/AgentEffect.js";
import type { ApprovalVerdict } from "../../../../models/orchestrations/effects/ApprovalVerdict.js";
import type { AuthorizationDecision } from "../../../../models/orchestrations/effects/AuthorizationDecision.js";
import type { EffectClaim } from "../../../../models/orchestrations/effects/EffectClaim.js";
import type { ApprovalService } from "../../../foundations/approvals/ApprovalService.js";
import type { EffectLedgerService } from "../../../foundations/effects/EffectLedgerService.js";
import type { PolicyService } from "../../../foundations/policies/PolicyService.js";
import { createTryCatch, type TryCatch } from "./PerimeterOrchestrationService.Exceptions.js";

// Whether an act may happen (SPEC.md 4.9): the policy's decision, the ledger's record read as a
// verdict, and the authority's answer. Direction owns the order between them; this region owns
// each question.
export class PerimeterOrchestrationService {
  private readonly policyService: PolicyService;
  private readonly approvalService: ApprovalService;
  private readonly effectLedgerService: EffectLedgerService;
  private readonly timeBroker: TimeBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly leaseMilliseconds: number;
  private readonly tryCatch: TryCatch;

  public constructor(
    policyService: PolicyService,
    approvalService: ApprovalService,
    effectLedgerService: EffectLedgerService,
    timeBroker: TimeBroker,
    loggingBroker: LoggingBroker,
    leaseMilliseconds = 300_000,
  ) {
    this.policyService = policyService;
    this.approvalService = approvalService;
    this.effectLedgerService = effectLedgerService;
    this.timeBroker = timeBroker;
    this.loggingBroker = loggingBroker;
    this.leaseMilliseconds = leaseMilliseconds;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public authorize(effect: AgentEffect): Promise<AuthorizationDecision> {
    return this.tryCatch(async () => {
      const decision = await this.policyService.authorize(effect);

      if (!decision.permitted) {
        await this.loggingBroker.logProcess("Direction", `Policy -> DENIED '${effect.toolName}': ${decision.reason}`);
      }

      return decision;
    });
  }

  // The ledger's record, read as a verdict. A completed act is replayed. A live claim by another
  // run is told, not performed. Anything else, a claim past its lease, this run's own earlier
  // attempt with no outcome, a failed tool, is an act whose fate is unknown, and the only honest
  // answer is to hold the run until a person reconciles the ledger against the world.
  public claim(effect: AgentEffect): Promise<EffectClaim> {
    return this.tryCatch(async () => {
      const claimed = await this.effectLedgerService.claim(effect, effect.runId, this.leaseMilliseconds);

      if (claimed) {
        return { verdict: "Proceed", outcome: null, record: null };
      }

      const prior = await this.effectLedgerService.retrieveRecord(effect.idempotencyKey);

      if (prior !== null && prior.state === "Completed") {
        await this.loggingBroker.logProcess("Direction", `Run-once -> '${effect.toolName}' already ran; replaying its outcome`);

        return { verdict: "Replay", outcome: prior.outcome ?? "", record: prior };
      }

      if (prior !== null && this.isLiveElsewhere(prior, effect)) {
        await this.loggingBroker.logProcess("Direction", `Run-once -> '${effect.toolName}' is in progress in another run; not performed`);

        return { verdict: "InProgress", outcome: null, record: prior };
      }

      await this.loggingBroker.logProcess(
        "Direction",
        `Run-once -> '${effect.toolName}' has an earlier attempt with no usable outcome (${prior?.state ?? "missing"}); held for reconciliation`,
      );

      return { verdict: "Unreconciled", outcome: null, record: prior };
    });
  }

  public requestApproval(effect: AgentEffect): Promise<ApprovalVerdict> {
    return this.tryCatch(async () => {
      const carried = carriedDecisionFor(effect);

      if (carried !== null) {
        await this.loggingBroker.logProcess("Direction", `Approval -> ${carried.toUpperCase()} '${effect.toolName}' from the resumed request`);

        return carried;
      }

      const approval = await this.approvalService.requestApproval(effect);

      if (approval === "Approved") {
        await this.loggingBroker.logProcess("Direction", `Approval -> APPROVED '${effect.toolName}'`);
      }

      return approval;
    });
  }

  public recordOutcome(effect: AgentEffect, outcome: string): Promise<void> {
    return this.tryCatch(async () => {
      await this.effectLedgerService.recordOutcome(effect.idempotencyKey, outcome);
    });
  }

  // Records that the tool threw, so the act's unknown fate is on the record.
  public recordFailure(effect: AgentEffect, detail: string): Promise<void> {
    return this.tryCatch(async () => {
      await this.effectLedgerService.recordFailure(effect.idempotencyKey, detail);
    });
  }

  // Gives back the claim on an act that was held rather than performed.
  public releaseClaim(effect: AgentEffect): Promise<void> {
    return this.tryCatch(async () => {
      await this.effectLedgerService.releaseClaim(effect.idempotencyKey);
    });
  }

  private isLiveElsewhere(prior: EffectRecord, effect: AgentEffect): boolean {
    return (
      prior.state === "InFlight" &&
      prior.owner !== effect.runId &&
      prior.leaseUntil.getTime() > this.timeBroker.getCurrentDateTime().getTime()
    );
  }
}

// The authority's answer, travelling on the request that resumed the run (PLAN.md 2.5).
//
// A run that was held is resumed somewhere the person who answered may no longer be sitting: the
// window was closed, the terminal exited, the script moved on. Asking again there is asking
// nobody, so the answer travels with the request instead.
//
function carriedDecisionFor(_effect: AgentEffect): ApprovalVerdict | null {
  const carried = AgentRun.current()?.decision ?? null;

  if (carried === null) {
    return null;
  }

  return carried.decision === "Approved" ? "Approved" : "Denied";
}
