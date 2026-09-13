import { describe, expect, it } from "vitest";

import type { EffectRecord } from "../../../models/brokers/effects/EffectRecord.js";
import { createEffectLedgerServiceTests, createRandomEffect, createRandomString, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService claim logic", () => {
  it("ShouldClaimEffectAsync", async () => {
    // given
    const currentDateTime = new Date();
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests(currentDateTime);
    const effect = createRandomEffect();
    const owner = createRandomString();
    const leaseMilliseconds = 60_000;

    const expectedClaim: EffectRecord = {
      idempotencyKey: effect.idempotencyKey,
      toolName: effect.toolName,
      state: "InFlight",
      owner,
      claimedOn: currentDateTime,
      leaseUntil: new Date(currentDateTime.getTime() + leaseMilliseconds),
      outcome: null,
      detail: null,
      recordedOn: null,
    };

    effectLedgerBrokerMock.insertClaim.mockResolvedValue(true);

    // when
    const actualClaimed = await effectLedgerService.claim(effect, owner, leaseMilliseconds);

    // then
    expect(actualClaimed).toBe(true);
    expect(effectLedgerBrokerMock.insertClaim.mock.calls[0]?.[0]).toEqual(expectedClaim);
    verifyNoOtherCalls(effectLedgerBrokerMock, { insertClaim: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
