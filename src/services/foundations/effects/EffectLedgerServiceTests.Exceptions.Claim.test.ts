import { describe, expect, it } from "vitest";

import { EffectLedgerServiceException } from "../../../models/foundations/effects/exceptions/EffectLedgerServiceException.js";
import { FailedEffectLedgerServiceException } from "../../../models/foundations/effects/exceptions/FailedEffectLedgerServiceException.js";
import { createEffectLedgerServiceTests, createRandomEffect, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService claim exceptions", () => {
  it("ShouldThrowServiceExceptionOnClaimIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests();
    const serviceException = new Error(createRandomString());

    const failedEffectLedgerServiceException = new FailedEffectLedgerServiceException(
      "Failed effect ledger service error occurred, contact support.",
      serviceException,
    );

    const expectedEffectLedgerServiceException = new EffectLedgerServiceException(
      "Effect ledger service error occurred, contact support.",
      failedEffectLedgerServiceException,
    );

    effectLedgerBrokerMock.insertClaim.mockRejectedValue(serviceException);

    // when
    const claimTask = effectLedgerService.claim(createRandomEffect(), createRandomString(), 60_000);

    // then
    const actualException = await claimTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(EffectLedgerServiceException);
    expectSameExceptionAs(actualException, expectedEffectLedgerServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedEffectLedgerServiceException);
    verifyNoOtherCalls(effectLedgerBrokerMock, { insertClaim: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
