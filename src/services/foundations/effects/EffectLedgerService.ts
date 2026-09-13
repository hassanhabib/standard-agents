import type { EffectLedgerBroker } from "../../../brokers/effects/EffectLedgerBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import type { EffectRecord } from "../../../models/brokers/effects/EffectRecord.js";
import type { EffectState } from "../../../models/brokers/effects/EffectState.js";
import { NotFoundEffectRecordException } from "../../../models/foundations/effects/exceptions/NotFoundEffectRecordException.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import { createTryCatch, type TryCatch } from "./EffectLedgerService.Exceptions.js";
import { validateEffect } from "./EffectLedgerService.Validations.js";

// The run-once ledger foundation (SPEC.md 4.9): an act is claimed before it runs and recorded
// after it, so it happens at most once and the window between is never read as a result.
export class EffectLedgerService {
  private readonly effectLedgerBroker: EffectLedgerBroker;
  private readonly timeBroker: TimeBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(effectLedgerBroker: EffectLedgerBroker, timeBroker: TimeBroker, loggingBroker: LoggingBroker) {
    this.effectLedgerBroker = effectLedgerBroker;
    this.timeBroker = timeBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public claim(effect: AgentEffect, owner: string, leaseMilliseconds: number): Promise<boolean> {
    return this.tryCatch(async () => {
      validateEffect(effect);
      const claimedOn = this.timeBroker.getCurrentDateTime();

      const claim: EffectRecord = {
        idempotencyKey: effect.idempotencyKey,
        toolName: effect.toolName,
        state: "InFlight",
        owner,
        claimedOn,
        leaseUntil: new Date(claimedOn.getTime() + leaseMilliseconds),
        outcome: null,
        detail: null,
        recordedOn: null,
      };

      return await this.effectLedgerBroker.insertClaim(claim);
    });
  }

  public retrieveRecord(idempotencyKey: string): Promise<EffectRecord | null> {
    return this.tryCatch(async () => {
      return await this.effectLedgerBroker.selectRecord(idempotencyKey);
    });
  }

  public recordOutcome(idempotencyKey: string, outcome: string): Promise<EffectRecord> {
    return this.tryCatch(async () => {
      return await this.settle(idempotencyKey, "Completed", outcome, null);
    });
  }

  public recordFailure(idempotencyKey: string, detail: string): Promise<EffectRecord> {
    return this.tryCatch(async () => {
      return await this.settle(idempotencyKey, "Failed", null, detail);
    });
  }

  // A claim released is a line struck out: the act did not happen and may be claimed again.
  public releaseClaim(idempotencyKey: string): Promise<void> {
    return this.tryCatch(async () => {
      await this.effectLedgerBroker.deleteRecord(idempotencyKey);
    });
  }

  // Both outcomes end the same way: the line is found, stamped with where it stands and when,
  // and written back. Only what it says differs.
  private async settle(
    idempotencyKey: string,
    state: EffectState,
    outcome: string | null,
    detail: string | null,
  ): Promise<EffectRecord> {
    const record = await this.effectLedgerBroker.selectRecord(idempotencyKey);

    if (record === null) {
      throw new NotFoundEffectRecordException(`Effect record with key ${idempotencyKey} was not found.`);
    }

    const settled: EffectRecord = {
      ...record,
      state,
      outcome,
      detail,
      recordedOn: this.timeBroker.getCurrentDateTime(),
    };

    await this.effectLedgerBroker.updateRecord(settled);

    return settled;
  }
}
