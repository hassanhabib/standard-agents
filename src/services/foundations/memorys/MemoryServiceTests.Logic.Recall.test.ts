import { describe, expect, it } from "vitest";


import { createMemoryServiceTests, createRandomString, verifyNoOtherCalls } from "./MemoryServiceTests.js";

describe("MemoryService recall logic", () => {
  it("ShouldRecallMemoriesAsync", async () => {
    // given
    const { memoryBrokerMock, loggingBrokerMock, memoryService } = createMemoryServiceTests();
    const expectedMemories = [createRandomString(), createRandomString()];
    memoryBrokerMock.selectMemories.mockResolvedValue(expectedMemories);

    // when
    const actualMemories = await memoryService.recall();

    // then
    expect(actualMemories).toEqual(expectedMemories);
    verifyNoOtherCalls(memoryBrokerMock, { selectMemories: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
