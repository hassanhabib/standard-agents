import { describe, expect, it } from "vitest";


import { createExecutionOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./ExecutionOrchestrationServiceTests.js";

describe("ExecutionOrchestrationService run logic", () => {
  it("ShouldRunLocalToolAsync", async () => {
    // given
    const { internalToolServiceMock, externalToolServiceMock, returnServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const toolName = createRandomString();
    const payload = createRandomString();
    const expectedOutput = createRandomString();
    internalToolServiceMock.handles.mockResolvedValue(true);
    internalToolServiceMock.run.mockResolvedValue(expectedOutput);

    // when
    const actualOutput = await executionOrchestrationService.run(toolName, payload);

    // then
    expect(actualOutput).toBe(expectedOutput);
    expect(internalToolServiceMock.handles).toHaveBeenCalledWith(toolName);
    expect(internalToolServiceMock.run).toHaveBeenCalledWith(toolName, payload);
    verifyNoOtherCalls(internalToolServiceMock, { handles: 1, run: 1 });
    verifyNoOtherCalls(externalToolServiceMock);
    verifyNoOtherCalls(returnServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRunExternalToolWhenNoLocalToolAnswersAsync", async () => {
    // given
    const { internalToolServiceMock, externalToolServiceMock, returnServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const toolName = createRandomString();
    const payload = createRandomString();
    const signal = new AbortController().signal;
    const expectedOutput = createRandomString();
    internalToolServiceMock.handles.mockResolvedValue(false);
    externalToolServiceMock.call.mockResolvedValue(expectedOutput);

    // when
    const actualOutput = await executionOrchestrationService.run(toolName, payload, signal);

    // then
    expect(actualOutput).toBe(expectedOutput);
    expect(externalToolServiceMock.call).toHaveBeenCalledWith(toolName, payload, signal);
    verifyNoOtherCalls(internalToolServiceMock, { handles: 1 });
    verifyNoOtherCalls(externalToolServiceMock, { call: 1 });
    verifyNoOtherCalls(returnServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
