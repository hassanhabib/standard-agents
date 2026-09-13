import type { EffectRecord } from "../../models/brokers/effects/EffectRecord.js";
import type { EffectLedgerBroker } from "./EffectLedgerBroker.js";

// The ledger in one process: enough for run-once within a run and across concurrent runs of one
// composition; the file ledger carries it across processes.
export class InMemoryEffectLedgerBroker implements EffectLedgerBroker {
  private readonly recordsByKey = new Map<string, EffectRecord>();

  public async insertClaim(claim: EffectRecord): Promise<boolean> {
    if (this.recordsByKey.has(claim.idempotencyKey)) {
      return false;
    }

    this.recordsByKey.set(claim.idempotencyKey, claim);

    return true;
  }

  public async selectRecord(idempotencyKey: string): Promise<EffectRecord | null> {
    return this.recordsByKey.get(idempotencyKey) ?? null;
  }

  public async updateRecord(record: EffectRecord): Promise<void> {
    this.recordsByKey.set(record.idempotencyKey, record);
  }

  public async deleteRecord(idempotencyKey: string): Promise<void> {
    this.recordsByKey.delete(idempotencyKey);
  }
}
