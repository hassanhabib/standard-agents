import { describe, expect, it } from "vitest";

import { createInternalToolServiceTests, createRandomString, verifyNoOtherCalls } from "./InternalToolServiceTests.js";

describe("InternalToolService handles logic", () => {
  it.each([true, false])("ShouldHandlesAsync (%s)", async (brokerHasTool) => {
    // given
    const { toolBrokerMock, loggingBrokerMock, internalToolService } = createInternalToolServiceTests();
    const toolName = createRandomString();
    toolBrokerMock.has.mockResolvedValue(brokerHasTool);

    // when
    const actualHandles = await internalToolService.handles(toolName);

    // then
    expect(actualHandles).toBe(brokerHasTool);
    expect(toolBrokerMock.has).toHaveBeenCalledWith(toolName);
    verifyNoOtherCalls(toolBrokerMock, { has: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
