import { NullPolicyEffectException } from "../../../models/foundations/policies/exceptions/NullPolicyEffectException.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";

// The validation partial (SPEC-cli 3.1): no act, nothing to authorize. The policy is never asked
// about nothing, because a policy asked about nothing might say yes.
export function validateEffect(effect: AgentEffect | null | undefined): asserts effect is AgentEffect {
  if (effect === null || effect === undefined) {
    throw new NullPolicyEffectException("Effect is null.");
  }
}
