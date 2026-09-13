import { describe, expect, it } from "vitest";


import { createDecisionCoordinationServiceTests, createRandomString, verifyNoOtherCalls } from "./DecisionCoordinationServiceTests.js";

describe("DecisionCoordinationService screen logic", () => {
  it("ShouldScreenAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const text = createRandomString();
    const expectedVerdict = createRandomString();
    guardianOrchestrationServiceMock.screen.mockResolvedValue(expectedVerdict);

    // when
    const actualVerdict = await decisionCoordinationService.screen(text);

    // then
    expect(actualVerdict).toBe(expectedVerdict);
    expect(guardianOrchestrationServiceMock.screen).toHaveBeenCalledWith(text);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1 });
    verifyNoOtherCalls(inferenceOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
