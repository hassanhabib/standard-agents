import { describe, expect, it } from "vitest";

import { InvalidReturnException } from "../../../models/foundations/returns/exceptions/InvalidReturnException.js";
import { ReturnValidationException } from "../../../models/foundations/returns/exceptions/ReturnValidationException.js";
import { createReturnServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./ReturnServiceTests.js";

describe("ReturnService return validations", () => {
  it.each(["", " "])(
    "ShouldThrowValidationExceptionOnReturnIfPayloadIsInvalidAndLogItAsync (%j)",
    async (invalidPayload) => {
      // given
      const { loggingBrokerMock, returnService } = createReturnServiceTests();

      const invalidReturnException = new InvalidReturnException(
        "Invalid return payload. Please correct the error and try again.",
      );

      const expectedReturnValidationException = new ReturnValidationException(
        "Return validation error occurred, fix the error and try again.",
        invalidReturnException,
      );

      // when
      const returnTask = returnService.return(invalidPayload);

      // then
      const actualException = await returnTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(ReturnValidationException);
      expectSameExceptionAs(actualException, expectedReturnValidationException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedReturnValidationException);
      verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
    },
  );

});
