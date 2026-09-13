import { NullApprovalEffectException } from "../../../models/foundations/approvals/exceptions/NullApprovalEffectException.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";

// The validation partial (SPEC-cli 3.1): no act, nothing to approve. An authority is never asked
// to approve nothing, because its yes would then attach to whatever came next.
export function validateEffect(effect: AgentEffect | null | undefined): asserts effect is AgentEffect {
  if (effect === null || effect === undefined) {
    throw new NullApprovalEffectException("Effect is null.");
  }
}
