import { describe, expect, it } from "vitest";


import { createRandomString, createRecollectionOrchestrationServiceTests, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService remember logic", () => {
  it("ShouldRememberAsync", async () => {
    // given
    const { memoryServiceMock, sessionServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const memory = createRandomString();
    memoryServiceMock.remember.mockResolvedValue(undefined);

    // when
    await recollectionOrchestrationService.remember(memory);

    // then
    expect(memoryServiceMock.remember).toHaveBeenCalledWith(memory);
    verifyNoOtherCalls(memoryServiceMock, { remember: 1 });
    verifyNoOtherCalls(sessionServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
