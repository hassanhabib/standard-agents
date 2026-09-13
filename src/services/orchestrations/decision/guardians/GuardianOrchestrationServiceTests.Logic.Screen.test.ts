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


  it("ShouldScreenNothingWhenThereIsNothingToScreenAsync", async () => {
    // given
    // A run carrying an answer to an act it already proposed, and asking for nothing new. A
    // guardian asked about nothing has nothing to screen, which is what the foundation says when
    // it refuses; this is the tier that should not have asked.
    const { gateServiceMock, guardianOrchestrationService } = createGuardianOrchestrationServiceTests();

    // when
    const actualVerdict = await guardianOrchestrationService.screen("  ");

    // then
    // Allowed, and nobody asked. A screen that refused here would end a run that is answering a
    // question the person was asked, which is the one run they most expect to go through.
    expect(actualVerdict).toBe("Allow");
    verifyNoOtherCalls(gateServiceMock);
  });

});
