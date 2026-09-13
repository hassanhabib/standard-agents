import { describe, expect, it } from "vitest";


import { createJudgeServiceTests, createRandomString, verifyNoOtherCalls } from "./JudgeServiceTests.js";

describe("JudgeService evaluate logic", () => {
  it("ShouldEvaluateAsync", async () => {
    // given
    const { verifierBrokerMock, loggingBrokerMock, judgeService } = createJudgeServiceTests();
    const task = createRandomString();
    const candidate = createRandomString();
    const reason = createRandomString();
    verifierBrokerMock.verify.mockResolvedValue(`0.9 ${reason}`);

    // when
    const actualJudgement = await judgeService.evaluate(task, candidate);

    // then
    expect(actualJudgement).toEqual({ score: 0.9, reason });
    expect(verifierBrokerMock.verify).toHaveBeenCalledWith(task, candidate);
    verifyNoOtherCalls(verifierBrokerMock, { verify: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
