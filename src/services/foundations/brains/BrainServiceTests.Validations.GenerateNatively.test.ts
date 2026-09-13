import { describe, expect, it } from "vitest";

import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import { BrainValidationException } from "../../../models/foundations/brains/exceptions/BrainValidationException.js";
import { ContextTooLargeException } from "../../../models/foundations/brains/exceptions/ContextTooLargeException.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { FailedBrainServiceException } from "../../../models/foundations/brains/exceptions/FailedBrainServiceException.js";
import { createNativeAsk } from "../../../models/foundations/brains/NativeAsk.js";
import { createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./BrainServiceTests.js";
import { createExchange, createNativeBrainServiceTests } from "./BrainServiceTests.Native.js";

describe("BrainService native validations", () => {
  it("ShouldThrowContextTooLargeWhenThereIsNothingLeftToGiveUpAsync", async () => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests({
      contextLength: 1,
      charactersPerToken: 1,
    });

    const contextTooLargeException = new ContextTooLargeException(
      "The conversation is too large for this model's context, and every reduction the client can make has been made.",
    );

    const failedBrainServiceException = new FailedBrainServiceException(
      "Failed brain service error occurred, contact support.",
      contextTooLargeException,
    );

    const expectedBrainServiceException = new BrainServiceException(
      "Brain service error occurred, contact support.",
      failedBrainServiceException,
    );

    // when
    const generateTask = brainService.generateNatively(createNativeAsk("a prompt longer than one character"));

    // then
    const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(BrainServiceException);
    expectSameExceptionAs(actualException, expectedBrainServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainServiceException);
    verifyNoOtherCalls(generatorBrokerV1Mock);
  });

  it.each(["", " "])("ShouldThrowValidationExceptionOnGenerateNativelyIfPromptIsInvalidAndLogItAsync (%j)", async (invalidPrompt) => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests();
    const invalidBrainException = new InvalidBrainException("Invalid brain input. Please correct the error and try again.");

    const expectedBrainValidationException = new BrainValidationException(
      "Brain validation error occurred, fix the error and try again.",
      invalidBrainException,
    );

    // when
    const generateTask = brainService.generateNatively(createNativeAsk(invalidPrompt));

    // then
    const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(BrainValidationException);
    expectSameExceptionAs(actualException, expectedBrainValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainValidationException);
    verifyNoOtherCalls(generatorBrokerV1Mock);
  });

  it.each(["", "call id with spaces", "a".repeat(65), "call/../1"])(
    "ShouldThrowValidationExceptionIfACallIdIsNotOnTheWiresAlphabetAsync (%j)",
    async (invalidCallId) => {
      // given
      const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests();

      const expectedBrainValidationException = new BrainValidationException(
        "Brain validation error occurred, fix the error and try again.",
        new InvalidBrainException("Invalid brain input. Please correct the error and try again."),
      );

      const ask = createNativeAsk(createRandomString(), { exchanges: [createExchange({ callId: invalidCallId })] });

      // when
      const generateTask = brainService.generateNatively(ask);

      // then
      const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(BrainValidationException);
      expectSameExceptionAs(actualException, expectedBrainValidationException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainValidationException);
      verifyNoOtherCalls(generatorBrokerV1Mock);
    },
  );

});
