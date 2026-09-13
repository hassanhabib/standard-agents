import { describe, expect, it } from "vitest";

import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createRandomString, createRecollectionOrchestrationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService recallSession exceptions", () => {
  it("ShouldThrowServiceExceptionOnRecallSessionIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { sessionServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    sessionServiceMock.retrieve.mockRejectedValue(serviceException);

    // when
    const recallTask = recollectionOrchestrationService.recallSession(createRandomString());

    // then
    const actualException = await recallTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(sessionServiceMock, { retrieve: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
