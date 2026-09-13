import { NullEffectException } from "../../../models/foundations/effects/exceptions/NullEffectException.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";

// The validation partial (SPEC-cli 3.1): no act, nothing to claim. A ledger line for nothing
// would be a claim no act could ever complete.
export function validateEffect(effect: AgentEffect | null | undefined): asserts effect is AgentEffect {
  if (effect === null || effect === undefined) {
    throw new NullEffectException("Effect is null.");
  }
}
