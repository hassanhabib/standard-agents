import { describe, expect, it } from "vitest";

import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createExecutionOrchestrationServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ExecutionOrchestrationServiceTests.js";

describe("ExecutionOrchestrationService return exceptions", () => {
  it("ShouldThrowServiceExceptionOnReturnIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { returnServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    returnServiceMock.return.mockRejectedValue(serviceException);

    // when
    const returnTask = executionOrchestrationService.return(createRandomString());

    // then
    const actualException = await returnTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(returnServiceMock, { return: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
