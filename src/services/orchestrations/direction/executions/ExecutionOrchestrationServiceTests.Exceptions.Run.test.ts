import { describe, expect, it } from "vitest";

import { ExternalToolDependencyException } from "../../../../models/foundations/externalTools/exceptions/ExternalToolDependencyException.js";
import { FailedInternalToolDependencyException } from "../../../../models/foundations/internalTools/exceptions/FailedInternalToolDependencyException.js";
import { InternalToolDependencyException } from "../../../../models/foundations/internalTools/exceptions/InternalToolDependencyException.js";
import { InternalToolServiceException } from "../../../../models/foundations/internalTools/exceptions/InternalToolServiceException.js";
import { InternalToolValidationException } from "../../../../models/foundations/internalTools/exceptions/InternalToolValidationException.js";
import { InvalidInternalToolException } from "../../../../models/foundations/internalTools/exceptions/InvalidInternalToolException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { createExecutionOrchestrationServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ExecutionOrchestrationServiceTests.js";

describe("ExecutionOrchestrationService run exceptions", () => {
  it("ShouldThrowDependencyValidationExceptionOnRunIfDependencyValidationErrorOccursAndLogItAsync", async () => {
    // given
    const { internalToolServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const localException = new InvalidInternalToolException(createRandomString());

    const expectedAgentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
      "Agent orchestration dependency validation error occurred, fix the error and try again.",
      localException,
    );

    internalToolServiceMock.handles.mockRejectedValue(new InternalToolValidationException(createRandomString(), localException));

    // when
    const runTask = executionOrchestrationService.run(createRandomString(), createRandomString());

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyValidationException);
    verifyNoOtherCalls(internalToolServiceMock, { handles: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([
    (inner: Error) => new InternalToolDependencyException(createRandomString(), inner),
    (inner: Error) => new InternalToolServiceException(createRandomString(), inner),
    (inner: Error) => new ExternalToolDependencyException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnRunIfDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { internalToolServiceMock, loggingBrokerMock, executionOrchestrationService } =
      createExecutionOrchestrationServiceTests();

    const localException = new FailedInternalToolDependencyException(createRandomString(), new Error(createRandomString()));

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    internalToolServiceMock.handles.mockRejectedValue(wrap(localException));

    // when
    const runTask = executionOrchestrationService.run(createRandomString(), createRandomString());

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(internalToolServiceMock, { handles: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
