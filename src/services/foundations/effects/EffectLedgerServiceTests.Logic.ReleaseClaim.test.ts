import { describe, expect, it } from "vitest";


import { createEffectLedgerServiceTests, createRandomString, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService releaseClaim logic", () => {
  it("ShouldReleaseClaimAsync", async () => {
    // given
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests();
    const idempotencyKey = createRandomString();
    effectLedgerBrokerMock.deleteRecord.mockResolvedValue(undefined);

    // when
    await effectLedgerService.releaseClaim(idempotencyKey);

    // then
    expect(effectLedgerBrokerMock.deleteRecord).toHaveBeenCalledWith(idempotencyKey);
    verifyNoOtherCalls(effectLedgerBrokerMock, { deleteRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
