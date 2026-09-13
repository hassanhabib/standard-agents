import { describe, expect, it } from "vitest";

import { FailedSkillDependencyException } from "../../../../models/foundations/skills/exceptions/FailedSkillDependencyException.js";
import { SkillDependencyException } from "../../../../models/foundations/skills/exceptions/SkillDependencyException.js";
import { SkillServiceException } from "../../../../models/foundations/skills/exceptions/SkillServiceException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createRandomString, createRetrievalOrchestrationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RetrievalOrchestrationServiceTests.js";

describe("RetrievalOrchestrationService retrieveInstructions exceptions", () => {
  it.each([
    (inner: Error) => new SkillDependencyException(createRandomString(), inner),
    (inner: Error) => new SkillServiceException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnRetrieveInstructionsIfDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { skillServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const localException = new FailedSkillDependencyException(createRandomString(), new Error(createRandomString()));
    const dependencyException = wrap(localException);

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    skillServiceMock.retrieveSkills.mockRejectedValue(dependencyException);

    // when
    const retrieveTask = retrievalOrchestrationService.retrieveInstructions(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowServiceExceptionOnRetrieveInstructionsIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { skillServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    skillServiceMock.retrieveSkills.mockRejectedValue(serviceException);

    // when
    const retrieveTask = retrievalOrchestrationService.retrieveInstructions(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
