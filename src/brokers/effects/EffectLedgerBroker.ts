import type { EffectRecord } from "../../models/brokers/effects/EffectRecord.js";

// The run-once ledger (SPEC.md 4.9). insertClaim is atomic: it answers false when the key is
// already claimed, which is the whole mechanism by which an act happens at most once.
export interface EffectLedgerBroker {
  insertClaim(claim: EffectRecord): Promise<boolean>;
  selectRecord(idempotencyKey: string): Promise<EffectRecord | null>;
  updateRecord(record: EffectRecord): Promise<void>;
  deleteRecord(idempotencyKey: string): Promise<void>;
}
