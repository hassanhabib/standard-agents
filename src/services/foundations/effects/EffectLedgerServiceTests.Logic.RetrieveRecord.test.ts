import { describe, expect, it } from "vitest";


import { createEffectLedgerServiceTests, createRandomRecord, createRandomString, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService retrieveRecord logic", () => {
  it("ShouldRetrieveRecordAsync", async () => {
    // given
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests();
    const idempotencyKey = createRandomString();
    const expectedRecord = createRandomRecord();
    effectLedgerBrokerMock.selectRecord.mockResolvedValue(expectedRecord);

    // when
    const actualRecord = await effectLedgerService.retrieveRecord(idempotencyKey);

    // then
    expect(actualRecord).toEqual(expectedRecord);
    expect(effectLedgerBrokerMock.selectRecord).toHaveBeenCalledWith(idempotencyKey);
    verifyNoOtherCalls(effectLedgerBrokerMock, { selectRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
