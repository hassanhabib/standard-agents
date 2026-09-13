import { describe, expect, it } from "vitest";

import { FailedJudgeServiceException } from "../../../models/foundations/judges/exceptions/FailedJudgeServiceException.js";
import { JudgeServiceException } from "../../../models/foundations/judges/exceptions/JudgeServiceException.js";
import { createJudgeServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./JudgeServiceTests.js";

describe("JudgeService evaluate exceptions", () => {
  it("ShouldThrowServiceExceptionOnEvaluateIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { verifierBrokerMock, loggingBrokerMock, judgeService } = createJudgeServiceTests();
    const serviceException = new Error(createRandomString());

    const failedJudgeServiceException = new FailedJudgeServiceException(
      "Failed judge service error occurred, contact support.",
      serviceException,
    );

    const expectedJudgeServiceException = new JudgeServiceException(
      "Judge service error occurred, contact support.",
      failedJudgeServiceException,
    );

    verifierBrokerMock.verify.mockRejectedValue(serviceException);

    // when
    const evaluateTask = judgeService.evaluate(createRandomString(), createRandomString());

    // then
    const actualException = await evaluateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(JudgeServiceException);
    expectSameExceptionAs(actualException, expectedJudgeServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedJudgeServiceException);
    verifyNoOtherCalls(verifierBrokerMock, { verify: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
