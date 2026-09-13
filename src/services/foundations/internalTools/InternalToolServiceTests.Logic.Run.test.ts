import { describe, expect, it } from "vitest";

import { createInternalToolServiceTests, createRandomString, verifyNoOtherCalls } from "./InternalToolServiceTests.js";

describe("InternalToolService run logic", () => {
  it("ShouldRunAsync", async () => {
    // given
    const { toolBrokerMock, loggingBrokerMock, internalToolService } = createInternalToolServiceTests();
    const toolName = createRandomString();
    const toolInput = createRandomString();
    const expectedOutput = createRandomString();
    toolBrokerMock.run.mockResolvedValue(expectedOutput);

    // when
    const actualOutput = await internalToolService.run(toolName, toolInput);

    // then
    expect(actualOutput).toBe(expectedOutput);
    expect(toolBrokerMock.run).toHaveBeenCalledWith(toolName, toolInput);
    verifyNoOtherCalls(toolBrokerMock, { run: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
