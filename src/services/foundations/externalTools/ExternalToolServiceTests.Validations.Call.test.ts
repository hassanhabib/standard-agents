import { describe, expect, it } from "vitest";

import { ExternalToolValidationException } from "../../../models/foundations/externalTools/exceptions/ExternalToolValidationException.js";
import { InvalidExternalToolException } from "../../../models/foundations/externalTools/exceptions/InvalidExternalToolException.js";
import { createExternalToolServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ExternalToolServiceTests.js";

describe("ExternalToolService call validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnCallIfNameIsInvalidAndLogItAsync (%j)", async (invalidName) => {
    // given
    const { mcpBrokerMock, loggingBrokerMock, externalToolService } = createExternalToolServiceTests();

    const invalidExternalToolException = new InvalidExternalToolException(
      "Invalid external tool name. Please correct the error and try again.",
    );

    const expectedExternalToolValidationException = new ExternalToolValidationException(
      "External tool validation error occurred, fix the error and try again.",
      invalidExternalToolException,
    );

    // when
    const callTask = externalToolService.call(invalidName, createRandomString());

    // then
    const actualException = await callTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(ExternalToolValidationException);
    expectSameExceptionAs(actualException, expectedExternalToolValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedExternalToolValidationException);
    verifyNoOtherCalls(mcpBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
