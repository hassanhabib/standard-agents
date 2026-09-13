import { describe, expect, it } from "vitest";

import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import { EffectLedgerValidationException } from "../../../models/foundations/effects/exceptions/EffectLedgerValidationException.js";
import { NullEffectException } from "../../../models/foundations/effects/exceptions/NullEffectException.js";
import { createEffectLedgerServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService claim validations", () => {
  it("ShouldThrowValidationExceptionOnClaimIfEffectIsNullAndLogItAsync", async () => {
    // given
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests();
    const nullEffect = null as unknown as AgentEffect;
    const nullEffectException = new NullEffectException("Effect is null.");

    const expectedEffectLedgerValidationException = new EffectLedgerValidationException(
      "Effect ledger validation error occurred, fix the error and try again.",
      nullEffectException,
    );

    // when
    const claimTask = effectLedgerService.claim(nullEffect, createRandomString(), 60_000);

    // then
    const actualException = await claimTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(EffectLedgerValidationException);
    expectSameExceptionAs(actualException, expectedEffectLedgerValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedEffectLedgerValidationException);
    verifyNoOtherCalls(effectLedgerBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
