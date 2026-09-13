import { describe, expect, it } from "vitest";

import { FailedGateServiceException } from "../../../../models/foundations/gates/exceptions/FailedGateServiceException.js";
import { GateDependencyException } from "../../../../models/foundations/gates/exceptions/GateDependencyException.js";
import { GateDependencyValidationException } from "../../../../models/foundations/gates/exceptions/GateDependencyValidationException.js";
import { GateServiceException } from "../../../../models/foundations/gates/exceptions/GateServiceException.js";
import { GateValidationException } from "../../../../models/foundations/gates/exceptions/GateValidationException.js";
import { InvalidGateException } from "../../../../models/foundations/gates/exceptions/InvalidGateException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { createGuardianOrchestrationServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./GuardianOrchestrationServiceTests.js";

describe("GuardianOrchestrationService screen exceptions", () => {
  it.each([
    (inner: Error) => new GateValidationException(createRandomString(), inner),
    (inner: Error) => new GateDependencyValidationException(createRandomString(), inner),
  ])("ShouldThrowDependencyValidationExceptionOnScreenIfDependencyValidationErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { gateServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const localException = new InvalidGateException(createRandomString());

    const expectedAgentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
      "Agent orchestration dependency validation error occurred, fix the error and try again.",
      localException,
    );

    gateServiceMock.screen.mockRejectedValue(wrap(localException));

    // when
    const screenTask = guardianOrchestrationService.screen(createRandomString());

    // then
    const actualException = await screenTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyValidationException);
    verifyNoOtherCalls(gateServiceMock, { screen: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([
    (inner: Error) => new GateDependencyException(createRandomString(), inner),
    (inner: Error) => new GateServiceException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnScreenIfDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { gateServiceMock, loggingBrokerMock, guardianOrchestrationService } =
      createGuardianOrchestrationServiceTests();

    const localException = new FailedGateServiceException(createRandomString(), new Error(createRandomString()));

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    gateServiceMock.screen.mockRejectedValue(wrap(localException));

    // when
    const screenTask = guardianOrchestrationService.screen(createRandomString());

    // then
    const actualException = await screenTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(gateServiceMock, { screen: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
