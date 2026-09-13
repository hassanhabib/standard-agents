import { describe, expect, it } from "vitest";


import { createExecutionOrchestrationServiceTests, createRandomString, verifyNoOtherCalls } from "./ExecutionOrchestrationServiceTests.js";

describe("ExecutionOrchestrationService return logic", () => {
  it("ShouldReturnAsync", async () => {
    // given
    const { internalToolServiceMock, externalToolServiceMock, returnServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const payload = createRandomString();
    returnServiceMock.return.mockResolvedValue(payload);

    // when
    const actualResult = await executionOrchestrationService.return(payload);

    // then
    expect(actualResult).toBe(payload);
    expect(returnServiceMock.return).toHaveBeenCalledWith(payload);
    verifyNoOtherCalls(returnServiceMock, { return: 1 });
    verifyNoOtherCalls(internalToolServiceMock);
    verifyNoOtherCalls(externalToolServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
