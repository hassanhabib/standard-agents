import { describe, expect, it } from "vitest";

import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createGuardianOrchestrationServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./GuardianOrchestrationServiceTests.js";

describe("GuardianOrchestrationService evaluate exceptions", () => {
  it("ShouldThrowServiceExceptionOnEvaluateIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { judgeServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    judgeServiceMock.evaluate.mockRejectedValue(serviceException);

    // when
    const evaluateTask = guardianOrchestrationService.evaluate(createRandomString(), createRandomString());

    // then
    const actualException = await evaluateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(judgeServiceMock, { evaluate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
