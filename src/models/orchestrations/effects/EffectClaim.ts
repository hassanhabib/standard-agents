import type { EffectRecord } from "../../brokers/effects/EffectRecord.js";
import type { EffectClaimVerdict } from "./EffectClaimVerdict.js";

// The perimeter's answer to whether an act may run (SPEC.md 4.9): the verdict, the recorded
// outcome when the verdict is to replay it, and the prior record when there is one to reconcile.
export interface EffectClaim {
  readonly verdict: EffectClaimVerdict;
  readonly outcome: string | null;
  readonly record: EffectRecord | null;
}
