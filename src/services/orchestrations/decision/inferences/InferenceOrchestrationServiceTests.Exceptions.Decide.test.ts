import { describe, expect, it } from "vitest";

import { BrainDependencyException } from "../../../../models/foundations/brains/exceptions/BrainDependencyException.js";
import { BrainDependencyValidationException } from "../../../../models/foundations/brains/exceptions/BrainDependencyValidationException.js";
import { BrainServiceException } from "../../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { BrainValidationException } from "../../../../models/foundations/brains/exceptions/BrainValidationException.js";
import { FailedBrainServiceException } from "../../../../models/foundations/brains/exceptions/FailedBrainServiceException.js";
import { InvalidBrainException } from "../../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import { UsageServiceException } from "../../../../models/foundations/usages/exceptions/UsageServiceException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createRandomContext, createRandomString, createInferenceOrchestrationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./InferenceOrchestrationServiceTests.js";

describe("InferenceOrchestrationService decide exceptions", () => {
  it.each([
    (inner: Error) => new BrainValidationException(createRandomString(), inner),
    (inner: Error) => new BrainDependencyValidationException(createRandomString(), inner),
  ])("ShouldThrowDependencyValidationExceptionOnDecideIfDependencyValidationErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const localException = new InvalidBrainException(createRandomString());

    const expectedAgentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
      "Agent orchestration dependency validation error occurred, fix the error and try again.",
      localException,
    );

    brainServiceMock.generate.mockRejectedValue(wrap(localException));

    // when
    const decideTask = inferenceOrchestrationService.decide(createRandomContext());

    // then
    const actualException = await decideTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyValidationException);
    verifyNoOtherCalls(brainServiceMock, { generate: 1 });
    verifyNoOtherCalls(usageServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([
    (inner: Error) => new BrainDependencyException(createRandomString(), inner),
    (inner: Error) => new BrainServiceException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnDecideIfBrainDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { brainServiceMock, loggingBrokerMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const localException = new FailedBrainServiceException(createRandomString(), new Error(createRandomString()));

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    brainServiceMock.generate.mockRejectedValue(wrap(localException));

    // when
    const decideTask = inferenceOrchestrationService.decide(createRandomContext());

    // then
    const actualException = await decideTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(brainServiceMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowDependencyExceptionOnDecideIfUsageDependencyErrorOccursAndLogItAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const localException = new Error(createRandomString());

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    brainServiceMock.generate.mockResolvedValue("FINAL: done");
    usageServiceMock.measure.mockRejectedValue(new UsageServiceException(createRandomString(), localException));

    // when
    const decideTask = inferenceOrchestrationService.decide(createRandomContext());

    // then
    const actualException = await decideTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(usageServiceMock, { measure: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowServiceExceptionOnDecideIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { brainServiceMock, loggingBrokerMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    brainServiceMock.generate.mockRejectedValue(serviceException);

    // when
    const decideTask = inferenceOrchestrationService.decide(createRandomContext());

    // then
    const actualException = await decideTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(brainServiceMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
