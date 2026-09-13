import { describe, expect, it } from "vitest";

import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createDecisionCoordinationServiceTests, createRandomContext, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./DecisionCoordinationServiceTests.js";

describe("DecisionCoordinationService think exceptions", () => {
  it("ShouldThrowServiceExceptionOnThinkIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    guardianOrchestrationServiceMock.screen.mockRejectedValue(serviceException);

    // when
    const thinkTask = decisionCoordinationService.think(createRandomContext());

    // then
    const actualException = await thinkTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([
    () => new AgentOrchestrationDependencyValidationException(createRandomString(), new Error(createRandomString())),
    () => new AgentOrchestrationDependencyException(createRandomString(), new Error(createRandomString())),
    () => new AgentOrchestrationServiceException(createRandomString(), new Error(createRandomString())),
  ])("ShouldRethrowLocalisedExceptionOnThinkWithoutLoggingItAgainAsync (%#)", async (build) => {
    // given
    const { guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const localisedException = build();
    guardianOrchestrationServiceMock.screen.mockRejectedValue(localisedException);

    // when
    const thinkTask = decisionCoordinationService.think(createRandomContext());

    // then
    const actualException = await thinkTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBe(localisedException);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
