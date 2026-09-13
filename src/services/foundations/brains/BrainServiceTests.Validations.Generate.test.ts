import { describe, expect, it } from "vitest";

import { BrainValidationException } from "../../../models/foundations/brains/exceptions/BrainValidationException.js";
import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import { createBrainServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./BrainServiceTests.js";

describe("BrainService generate validations", () => {
  it.each(["", " "])(
    "ShouldThrowValidationExceptionOnGenerateIfUserPromptIsInvalidAndLogItAsync (%j)",
    async (invalidUserPrompt) => {
      // given
      const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();

      const invalidBrainException = new InvalidBrainException(
        "Invalid brain input. Please correct the error and try again.",
      );

      const expectedBrainValidationException = new BrainValidationException(
        "Brain validation error occurred, fix the error and try again.",
        invalidBrainException,
      );

      // when
      const generateTask = brainService.generate(createRandomString(), invalidUserPrompt);

      // then
      const actualBrainValidationException = await generateTask.then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(actualBrainValidationException).toBeInstanceOf(BrainValidationException);
      expectSameExceptionAs(actualBrainValidationException, expectedBrainValidationException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainValidationException);
      verifyNoOtherCalls(generatorBrokerMock);
      verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
    },
  );

});
