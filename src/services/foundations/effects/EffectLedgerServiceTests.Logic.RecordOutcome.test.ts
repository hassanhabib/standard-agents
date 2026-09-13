import { describe, expect, it } from "vitest";

import type { EffectRecord } from "../../../models/brokers/effects/EffectRecord.js";
import { createEffectLedgerServiceTests, createRandomRecord, createRandomString, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService recordOutcome logic", () => {
  it("ShouldRecordOutcomeAsync", async () => {
    // given
    const currentDateTime = new Date();
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests(currentDateTime);
    const existingRecord = createRandomRecord();
    const outcome = createRandomString();

    const expectedRecord: EffectRecord = {
      ...existingRecord,
      state: "Completed",
      outcome,
      detail: null,
      recordedOn: currentDateTime,
    };

    effectLedgerBrokerMock.selectRecord.mockResolvedValue(existingRecord);
    effectLedgerBrokerMock.updateRecord.mockResolvedValue(undefined);

    // when
    const actualRecord = await effectLedgerService.recordOutcome(existingRecord.idempotencyKey, outcome);

    // then
    expect(actualRecord).toEqual(expectedRecord);
    expect(effectLedgerBrokerMock.selectRecord).toHaveBeenCalledWith(existingRecord.idempotencyKey);
    expect(effectLedgerBrokerMock.updateRecord.mock.calls[0]?.[0]).toEqual(expectedRecord);
    verifyNoOtherCalls(effectLedgerBrokerMock, { selectRecord: 1, updateRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
