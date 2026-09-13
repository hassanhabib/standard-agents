import { describe, expect, it } from "vitest";


import { createRandomString, createRecollectionOrchestrationServiceTests, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService recallMemories logic", () => {
  it("ShouldRecallMemoriesAsync", async () => {
    // given
    const { memoryServiceMock, sessionServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const expectedMemories = [createRandomString(), createRandomString(), createRandomString()];
    memoryServiceMock.recall.mockResolvedValue(expectedMemories);

    // when
    const actualMemories = await recollectionOrchestrationService.recallMemories();

    // then
    expect(actualMemories).toEqual(expectedMemories);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Data", "Recalled 3 memories");
    verifyNoOtherCalls(memoryServiceMock, { recall: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
    verifyNoOtherCalls(sessionServiceMock);
  });

});
