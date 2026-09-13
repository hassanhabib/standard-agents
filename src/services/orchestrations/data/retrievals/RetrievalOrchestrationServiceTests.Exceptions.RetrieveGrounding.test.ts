import { describe, expect, it } from "vitest";

import { InvalidKnowledgeException } from "../../../../models/foundations/knowledges/exceptions/InvalidKnowledgeException.js";
import { KnowledgeValidationException } from "../../../../models/foundations/knowledges/exceptions/KnowledgeValidationException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { createRandomString, createRetrievalOrchestrationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RetrievalOrchestrationServiceTests.js";

describe("RetrievalOrchestrationService retrieveGrounding exceptions", () => {
  it("ShouldThrowDependencyValidationExceptionOnRetrieveGroundingIfDependencyValidationErrorOccursAndLogItAsync", async () => {
    // given
    const { knowledgeServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const invalidKnowledgeException = new InvalidKnowledgeException(createRandomString());
    const knowledgeValidationException = new KnowledgeValidationException(createRandomString(), invalidKnowledgeException);

    const expectedAgentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
      "Agent orchestration dependency validation error occurred, fix the error and try again.",
      invalidKnowledgeException,
    );

    knowledgeServiceMock.retrieve.mockRejectedValue(knowledgeValidationException);

    // when
    const retrieveTask = retrievalOrchestrationService.retrieveGrounding(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyValidationException);
    verifyNoOtherCalls(knowledgeServiceMock, { retrieve: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
