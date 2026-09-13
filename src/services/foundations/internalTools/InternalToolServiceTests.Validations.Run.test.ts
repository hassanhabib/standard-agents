import { describe, expect, it } from "vitest";

import { InternalToolValidationException } from "../../../models/foundations/internalTools/exceptions/InternalToolValidationException.js";
import { InvalidInternalToolException } from "../../../models/foundations/internalTools/exceptions/InvalidInternalToolException.js";
import { createInternalToolServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./InternalToolServiceTests.js";

describe("InternalToolService run validations", () => {
  it.each(["", " "])(
    "ShouldThrowValidationExceptionOnRunIfNameIsInvalidAndLogItAsync (%j)",
    async (invalidName) => {
      // given
      const { toolBrokerMock, loggingBrokerMock, internalToolService } = createInternalToolServiceTests();

      const invalidInternalToolException = new InvalidInternalToolException(
        "Invalid internal tool. Please correct the error and try again.",
      );

      const expectedInternalToolValidationException = new InternalToolValidationException(
        "Internal tool validation error occurred, fix the error and try again.",
        invalidInternalToolException,
      );

      // when
      const runTask = internalToolService.run(invalidName, createRandomString());

      // then
      const actualException = await runTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(InternalToolValidationException);
      expectSameExceptionAs(actualException, expectedInternalToolValidationException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedInternalToolValidationException);
      verifyNoOtherCalls(toolBrokerMock);
      verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
    },
  );

});
