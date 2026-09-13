import { describe, expect, it } from "vitest";


import { createGuardianOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./GuardianOrchestrationServiceTests.js";

describe("GuardianOrchestrationService detectConflict logic", () => {
  it("ShouldDetectConflictAsync", async () => {
    // given
    const { gateServiceMock, judgeServiceMock, contractServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const instructions = createRandomString();
    const expectedVerdict = createRandomString();
    gateServiceMock.detectConflict.mockResolvedValue(expectedVerdict);

    // when
    const actualVerdict = await guardianOrchestrationService.detectConflict(instructions);

    // then
    expect(actualVerdict).toBe(expectedVerdict);
    expect(gateServiceMock.detectConflict).toHaveBeenCalledWith(instructions);
    verifyNoOtherCalls(gateServiceMock, { detectConflict: 1 });
    verifyNoOtherCalls(judgeServiceMock);
    verifyNoOtherCalls(contractServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
