import { describe, expect, it } from "vitest";

import { FailedPolicyServiceException } from "../../../../models/foundations/policies/exceptions/FailedPolicyServiceException.js";
import { NullPolicyEffectException } from "../../../../models/foundations/policies/exceptions/NullPolicyEffectException.js";
import { PolicyDependencyException } from "../../../../models/foundations/policies/exceptions/PolicyDependencyException.js";
import { PolicyServiceException } from "../../../../models/foundations/policies/exceptions/PolicyServiceException.js";
import { PolicyValidationException } from "../../../../models/foundations/policies/exceptions/PolicyValidationException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { createPerimeterOrchestrationServiceTests, createRandomEffect, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./PerimeterOrchestrationServiceTests.js";

describe("PerimeterOrchestrationService authorize exceptions", () => {
  it("ShouldThrowDependencyValidationExceptionOnAuthorizeIfDependencyValidationErrorOccursAndLogItAsync", async () => {
    // given
    const { policyServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const localException = new NullPolicyEffectException(createRandomString());

    const expectedAgentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
      "Agent orchestration dependency validation error occurred, fix the error and try again.",
      localException,
    );

    policyServiceMock.authorize.mockRejectedValue(new PolicyValidationException(createRandomString(), localException));

    // when
    const authorizeTask = perimeterOrchestrationService.authorize(createRandomEffect());

    // then
    const actualException = await authorizeTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyValidationException);
    verifyNoOtherCalls(policyServiceMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([
    (inner: Error) => new PolicyDependencyException(createRandomString(), inner),
    (inner: Error) => new PolicyServiceException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnAuthorizeIfDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { policyServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const localException = new FailedPolicyServiceException(createRandomString(), new Error(createRandomString()));

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    policyServiceMock.authorize.mockRejectedValue(wrap(localException));

    // when
    const authorizeTask = perimeterOrchestrationService.authorize(createRandomEffect());

    // then
    const actualException = await authorizeTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(policyServiceMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
