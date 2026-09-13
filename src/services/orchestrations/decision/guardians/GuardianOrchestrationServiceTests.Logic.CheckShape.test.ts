import { describe, expect, it } from "vitest";


import { createGuardianOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./GuardianOrchestrationServiceTests.js";

describe("GuardianOrchestrationService checkShape logic", () => {
  it("ShouldCheckShapeAsync", async () => {
    // given
    const { gateServiceMock, judgeServiceMock, contractServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const answer = createRandomString();
    const schema = createRandomString();
    const expectedVerdict = { satisfied: false, reason: createRandomString() };
    contractServiceMock.check.mockResolvedValue(expectedVerdict);

    // when
    const actualVerdict = await guardianOrchestrationService.checkShape(answer, schema);

    // then
    expect(actualVerdict).toEqual(expectedVerdict);
    expect(contractServiceMock.check).toHaveBeenCalledWith(answer, schema);
    verifyNoOtherCalls(contractServiceMock, { check: 1 });
    verifyNoOtherCalls(gateServiceMock);
    verifyNoOtherCalls(judgeServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
