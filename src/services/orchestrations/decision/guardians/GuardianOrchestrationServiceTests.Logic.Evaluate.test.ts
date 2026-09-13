import { describe, expect, it } from "vitest";


import { createGuardianOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./GuardianOrchestrationServiceTests.js";

describe("GuardianOrchestrationService evaluate logic", () => {
  it("ShouldEvaluateAsync", async () => {
    // given
    const { gateServiceMock, judgeServiceMock, contractServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const task = createRandomString();
    const candidate = createRandomString();
    const expectedJudgement = { score: 0.8, reason: createRandomString() };
    judgeServiceMock.evaluate.mockResolvedValue(expectedJudgement);

    // when
    const actualJudgement = await guardianOrchestrationService.evaluate(task, candidate);

    // then
    expect(actualJudgement).toEqual(expectedJudgement);
    expect(judgeServiceMock.evaluate).toHaveBeenCalledWith(task, candidate);
    verifyNoOtherCalls(judgeServiceMock, { evaluate: 1 });
    verifyNoOtherCalls(gateServiceMock);
    verifyNoOtherCalls(contractServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
