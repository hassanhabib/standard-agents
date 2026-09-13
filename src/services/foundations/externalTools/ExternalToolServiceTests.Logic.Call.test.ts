import { describe, expect, it } from "vitest";


import { createExternalToolServiceTests, createRandomString, verifyNoOtherCalls } from "./ExternalToolServiceTests.js";

describe("ExternalToolService call logic", () => {
  it("ShouldCallExternalToolAsync", async () => {
    // given
    const { mcpBrokerMock, loggingBrokerMock, externalToolService } = createExternalToolServiceTests();
    const name = createRandomString();
    const argumentsJson = createRandomString();
    const signal = new AbortController().signal;
    const expectedResult = createRandomString();
    mcpBrokerMock.call.mockResolvedValue(expectedResult);

    // when
    const actualResult = await externalToolService.call(name, argumentsJson, signal);

    // then
    expect(actualResult).toBe(expectedResult);
    expect(mcpBrokerMock.call).toHaveBeenCalledWith(name, argumentsJson, signal);
    verifyNoOtherCalls(mcpBrokerMock, { call: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
