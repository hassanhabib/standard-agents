import { describe, expect, it } from "vitest";

import { EffectLedgerValidationException } from "../../../models/foundations/effects/exceptions/EffectLedgerValidationException.js";
import { NotFoundEffectRecordException } from "../../../models/foundations/effects/exceptions/NotFoundEffectRecordException.js";
import { createEffectLedgerServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./EffectLedgerServiceTests.js";

describe("EffectLedgerService recordOutcome validations", () => {
  it("ShouldThrowValidationExceptionOnRecordOutcomeIfRecordIsNotFoundAndLogItAsync", async () => {
    // given
    const { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService } = createEffectLedgerServiceTests();
    const idempotencyKey = createRandomString();

    const notFoundEffectRecordException = new NotFoundEffectRecordException(
      `Effect record with key ${idempotencyKey} was not found.`,
    );

    const expectedEffectLedgerValidationException = new EffectLedgerValidationException(
      "Effect ledger validation error occurred, fix the error and try again.",
      notFoundEffectRecordException,
    );

    effectLedgerBrokerMock.selectRecord.mockResolvedValue(null);

    // when
    const recordTask = effectLedgerService.recordOutcome(idempotencyKey, createRandomString());

    // then
    const actualException = await recordTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(EffectLedgerValidationException);
    expectSameExceptionAs(actualException, expectedEffectLedgerValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedEffectLedgerValidationException);
    verifyNoOtherCalls(effectLedgerBrokerMock, { selectRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
