import { describe, expect, it } from "vitest";


import { createExecutionOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./ExecutionOrchestrationServiceTests.js";

describe("ExecutionOrchestrationService handlesLocally logic", () => {
  it("ShouldSayWhetherToolIsHandledLocallyAsync", async () => {
    // given
    const { internalToolServiceMock, externalToolServiceMock, returnServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const toolName = createRandomString();
    internalToolServiceMock.handles.mockResolvedValue(true);

    // when
    const actualHandled = await executionOrchestrationService.handlesLocally(toolName);

    // then
    expect(actualHandled).toBe(true);
    expect(internalToolServiceMock.handles).toHaveBeenCalledWith(toolName);
    verifyNoOtherCalls(internalToolServiceMock, { handles: 1 });
    verifyNoOtherCalls(externalToolServiceMock);
    verifyNoOtherCalls(returnServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
