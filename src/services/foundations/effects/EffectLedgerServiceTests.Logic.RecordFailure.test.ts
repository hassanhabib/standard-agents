import { describe, expect, it } from "vitest";

import type { EffectRecord } from "../../../models/brokers/effects/EffectRecord.js";
import { createEffectLedgerServiceTests, createRandomRecord, createRandomString, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService recordFailure logic", () => {
  it("ShouldRecordFailureAsync", async () => {
    // given
    const currentDateTime = new Date();
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests(currentDateTime);
    const existingRecord = createRandomRecord();
    const detail = createRandomString();

    const expectedRecord: EffectRecord = {
      ...existingRecord,
      state: "Failed",
      outcome: null,
      detail,
      recordedOn: currentDateTime,
    };

    effectLedgerBrokerMock.selectRecord.mockResolvedValue(existingRecord);
    effectLedgerBrokerMock.updateRecord.mockResolvedValue(undefined);

    // when
    const actualRecord = await effectLedgerService.recordFailure(existingRecord.idempotencyKey, detail);

    // then
    expect(actualRecord).toEqual(expectedRecord);
    expect(effectLedgerBrokerMock.selectRecord).toHaveBeenCalledWith(existingRecord.idempotencyKey);
    expect(effectLedgerBrokerMock.updateRecord.mock.calls[0]?.[0]).toEqual(expectedRecord);
    verifyNoOtherCalls(effectLedgerBrokerMock, { selectRecord: 1, updateRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
