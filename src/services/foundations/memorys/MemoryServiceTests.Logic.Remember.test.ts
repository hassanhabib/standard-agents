import { describe, expect, it } from "vitest";


import { createMemoryServiceTests, createRandomString, verifyNoOtherCalls } from "./MemoryServiceTests.js";

describe("MemoryService remember logic", () => {
  it("ShouldRememberMemoryAsync", async () => {
    // given
    const { memoryBrokerMock, loggingBrokerMock, memoryService } = createMemoryServiceTests();
    const memory = createRandomString();
    memoryBrokerMock.insertMemory.mockResolvedValue(undefined);

    // when
    await memoryService.remember(memory);

    // then
    expect(memoryBrokerMock.insertMemory).toHaveBeenCalledWith(memory);
    verifyNoOtherCalls(memoryBrokerMock, { insertMemory: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
