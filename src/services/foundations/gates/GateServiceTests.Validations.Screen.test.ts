import { describe, expect, it } from "vitest";

import { GateValidationException } from "../../../models/foundations/gates/exceptions/GateValidationException.js";
import { InvalidGateException } from "../../../models/foundations/gates/exceptions/InvalidGateException.js";
import { createGateServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./GateServiceTests.js";

describe("GateService screen validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnScreenIfInputIsInvalidAndLogItAsync (%j)", async (invalidInput) => {
    // given
    const { classifierBrokerMock, loggingBrokerMock, gateService } = createGateServiceTests();

    const invalidGateException = new InvalidGateException(
      "Invalid gate input. Please correct the error and try again.",
    );

    const expectedGateValidationException = new GateValidationException(
      "Gate validation error occurred, fix the error and try again.",
      invalidGateException,
    );

    // when
    const screenTask = gateService.screen(invalidInput);

    // then
    const actualException = await screenTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(GateValidationException);
    expectSameExceptionAs(actualException, expectedGateValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedGateValidationException);
    verifyNoOtherCalls(classifierBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
