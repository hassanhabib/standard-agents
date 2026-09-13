import { describe, expect, it } from "vitest";

import { createPromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import { AgentCoordinationDependencyException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationDependencyException.js";
import { AgentCoordinationDependencyValidationException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationDependencyValidationException.js";
import { FailedRunManagementServiceException } from "../../../models/managements/runs/exceptions/FailedRunManagementServiceException.js";
import { RunManagementServiceException } from "../../../models/managements/runs/exceptions/RunManagementServiceException.js";
import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { AgentOrchestrationValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationValidationException.js";
import { createRandomString, createRunManagementServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RunManagementServiceTests.js";

describe("RunManagementService run exceptions", () => {
  it.each([
    (inner: Error) => new AgentOrchestrationValidationException(createRandomString(), inner),
    (inner: Error) => new AgentOrchestrationDependencyValidationException(createRandomString(), inner),
  ])("ShouldThrowDependencyValidationExceptionOnRunIfDependencyValidationErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { dataCoordinationServiceMock, loggingBrokerMock, runManagementService } = createRunManagementServiceTests();
    const localException = new Error(createRandomString());

    const expectedAgentCoordinationDependencyValidationException = new AgentCoordinationDependencyValidationException(
      "Agent coordination dependency validation error occurred, fix the error and try again.",
      localException,
    );

    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockRejectedValue(wrap(localException));

    // when
    const runTask = runManagementService.run(createPromptRequest(createRandomString()));

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentCoordinationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentCoordinationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentCoordinationDependencyValidationException);
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1 });
  });

  it.each([
    (inner: Error) => new AgentOrchestrationDependencyException(createRandomString(), inner),
    (inner: Error) => new AgentOrchestrationServiceException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnRunIfDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { dataCoordinationServiceMock, loggingBrokerMock, runManagementService } = createRunManagementServiceTests();
    const localException = new Error(createRandomString());

    const expectedAgentCoordinationDependencyException = new AgentCoordinationDependencyException(
      "Agent coordination dependency error occurred, contact support.",
      localException,
    );

    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockRejectedValue(wrap(localException));

    // when
    const runTask = runManagementService.run(createPromptRequest(createRandomString()));

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentCoordinationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentCoordinationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentCoordinationDependencyException);
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1 });
  });

  it("ShouldThrowServiceExceptionOnRunIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { dataCoordinationServiceMock, loggingBrokerMock, runManagementService } = createRunManagementServiceTests();
    const serviceException = new Error(createRandomString());

    const failedRunManagementServiceException = new FailedRunManagementServiceException(
      "Failed run management service error occurred, contact support.",
      serviceException,
    );

    const expectedRunManagementServiceException = new RunManagementServiceException(
      "Run management service error occurred, contact support.",
      failedRunManagementServiceException,
    );

    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockRejectedValue(serviceException);

    // when
    const runTask = runManagementService.run(createPromptRequest(createRandomString()));

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(RunManagementServiceException);
    expectSameExceptionAs(actualException, expectedRunManagementServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedRunManagementServiceException);
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1 });
  });

});
