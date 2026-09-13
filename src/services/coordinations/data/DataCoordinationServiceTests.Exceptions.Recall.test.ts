import { describe, expect, it } from "vitest";

import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createDataCoordinationServiceTests, createRandomContext, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService recall exceptions", () => {
  it("ShouldThrowServiceExceptionOnRecallIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    retrievalOrchestrationServiceMock.retrieveInstructions.mockRejectedValue(serviceException);

    // when
    const recallTask = dataCoordinationService.recall(createRandomContext());

    // then
    const actualException = await recallTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(retrievalOrchestrationServiceMock, { retrieveInstructions: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1, logError: 1 });
  });

  it.each([
    () => new AgentOrchestrationDependencyValidationException(createRandomString(), new Error(createRandomString())),
    () => new AgentOrchestrationDependencyException(createRandomString(), new Error(createRandomString())),
    () => new AgentOrchestrationServiceException(createRandomString(), new Error(createRandomString())),
  ])("ShouldRethrowLocalisedExceptionOnRecallWithoutLoggingItAgainAsync (%#)", async (build) => {
    // given
    const { retrievalOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const localisedException = build();
    retrievalOrchestrationServiceMock.retrieveInstructions.mockRejectedValue(localisedException);

    // when
    const recallTask = dataCoordinationService.recall(createRandomContext());

    // then
    const actualException = await recallTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBe(localisedException);
    verifyNoOtherCalls(retrievalOrchestrationServiceMock, { retrieveInstructions: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1 });
  });

});
