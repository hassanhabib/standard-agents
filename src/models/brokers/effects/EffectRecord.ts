import type { EffectState } from "./EffectState.js";

// One act's line in the ledger (SPEC.md 4.9): which act, who claimed it, when, for how long,
// where it stands, and what it produced. Written before the act and updated after it.
export interface EffectRecord {
  readonly idempotencyKey: string;
  readonly toolName: string;
  readonly state: EffectState;
  readonly owner: string;
  readonly claimedOn: Date;
  readonly leaseUntil: Date;
  readonly outcome: string | null;
  readonly detail: string | null;
  readonly recordedOn: Date | null;
}
