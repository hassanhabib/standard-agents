import { describe, expect, it } from "vitest";

import { InvalidJudgeException } from "../../../models/foundations/judges/exceptions/InvalidJudgeException.js";
import { InvalidJudgeScoreException } from "../../../models/foundations/judges/exceptions/InvalidJudgeScoreException.js";
import { JudgeValidationException } from "../../../models/foundations/judges/exceptions/JudgeValidationException.js";
import { createJudgeServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./JudgeServiceTests.js";

describe("JudgeService evaluate validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnEvaluateIfCandidateIsInvalidAndLogItAsync (%j)", async (invalidCandidate) => {
    // given
    const { verifierBrokerMock, loggingBrokerMock, judgeService } = createJudgeServiceTests();

    const invalidJudgeException = new InvalidJudgeException(
      "Invalid judge candidate. Please correct the error and try again.",
    );

    const expectedJudgeValidationException = new JudgeValidationException(
      "Judge validation error occurred, fix the error and try again.",
      invalidJudgeException,
    );

    // when
    const evaluateTask = judgeService.evaluate(createRandomString(), invalidCandidate);

    // then
    const actualException = await evaluateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(JudgeValidationException);
    expectSameExceptionAs(actualException, expectedJudgeValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedJudgeValidationException);
    verifyNoOtherCalls(verifierBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each(["no idea", "1.5 too confident", "-0.2 negative"])("ShouldThrowValidationExceptionOnEvaluateIfScoreIsInvalidAndLogItAsync (%j)", async (invalidVerdict) => {
    // given
    const { verifierBrokerMock, loggingBrokerMock, judgeService } = createJudgeServiceTests();

    const invalidJudgeScoreException = new InvalidJudgeScoreException(
      "Invalid judge score. The verifier must answer with a score between 0 and 1.",
    );

    const expectedJudgeValidationException = new JudgeValidationException(
      "Judge validation error occurred, fix the error and try again.",
      invalidJudgeScoreException,
    );

    verifierBrokerMock.verify.mockResolvedValue(invalidVerdict);

    // when
    const evaluateTask = judgeService.evaluate(createRandomString(), createRandomString());

    // then
    const actualException = await evaluateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(JudgeValidationException);
    expectSameExceptionAs(actualException, expectedJudgeValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedJudgeValidationException);
    verifyNoOtherCalls(verifierBrokerMock, { verify: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
