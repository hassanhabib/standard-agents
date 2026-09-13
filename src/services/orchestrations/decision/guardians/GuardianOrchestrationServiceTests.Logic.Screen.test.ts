import { describe, expect, it } from "vitest";

import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import { createGuardianOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./GuardianOrchestrationServiceTests.js";

describe("GuardianOrchestrationService screen logic", () => {
  it("ShouldScreenAsync", async () => {
    // given
    const { gateServiceMock, judgeServiceMock, contractServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const prompt = createRandomString();
    const expectedVerdict = createRandomString();
    gateServiceMock.screen.mockResolvedValue(expectedVerdict);

    // when
    const firstVerdict = await guardianOrchestrationService.screen(prompt);
    const secondVerdict = await guardianOrchestrationService.screen(prompt);

    // then
    expect(firstVerdict).toBe(expectedVerdict);
    expect(secondVerdict).toBe(expectedVerdict);
    expect(gateServiceMock.screen).toHaveBeenCalledWith(prompt);
    verifyNoOtherCalls(gateServiceMock, { screen: 2 });
    verifyNoOtherCalls(judgeServiceMock);
    verifyNoOtherCalls(contractServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldScreenOncePerRunAsync", async () => {
    // given
    const { gateServiceMock, guardianOrchestrationService } = createGuardianOrchestrationServiceTests();
    const prompt = createRandomString();
    const otherPrompt = createRandomString();
    const expectedVerdict = createRandomString();
    gateServiceMock.screen.mockResolvedValue(expectedVerdict);

    // when
    const verdicts = await AgentRun.begin(null, undefined, async () => [
      await guardianOrchestrationService.screen(prompt),
      await guardianOrchestrationService.screen(prompt),
      await guardianOrchestrationService.screen(otherPrompt),
    ]);

    // then
    expect(verdicts).toEqual([expectedVerdict, expectedVerdict, expectedVerdict]);
    expect(gateServiceMock.screen).toHaveBeenNthCalledWith(1, prompt);
    expect(gateServiceMock.screen).toHaveBeenNthCalledWith(2, otherPrompt);
    verifyNoOtherCalls(gateServiceMock, { screen: 2 });
  });

});
