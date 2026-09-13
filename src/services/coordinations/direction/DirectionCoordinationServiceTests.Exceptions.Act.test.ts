import { describe, expect, it } from "vitest";

import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createDirectionCoordinationServiceTests, createRandomString, expectSameExceptionAs, toolContext, verifyNoOtherCalls } from "./DirectionCoordinationServiceTests.js";

describe("DirectionCoordinationService act exceptions", () => {
  it("ShouldThrowServiceExceptionOnActIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    perimeterOrchestrationServiceMock.authorize.mockRejectedValue(serviceException);

    // when
    const actTask = directionCoordinationService.act(toolContext());

    // then
    const actualException = await actTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([
    () => new AgentOrchestrationDependencyValidationException(createRandomString(), new Error(createRandomString())),
    () => new AgentOrchestrationDependencyException(createRandomString(), new Error(createRandomString())),
    () => new AgentOrchestrationServiceException(createRandomString(), new Error(createRandomString())),
  ])("ShouldRethrowLocalisedExceptionOnActWithoutLoggingItAgainAsync (%#)", async (build) => {
    // given
    const { perimeterOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const localisedException = build();
    perimeterOrchestrationServiceMock.authorize.mockRejectedValue(localisedException);

    // when
    const actTask = directionCoordinationService.act(toolContext());

    // then
    const actualException = await actTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBe(localisedException);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
