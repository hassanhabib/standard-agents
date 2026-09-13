import { describe, expect, it } from "vitest";

import { FailedMemoryServiceException } from "../../../../models/foundations/memorys/exceptions/FailedMemoryServiceException.js";
import { MemoryDependencyException } from "../../../../models/foundations/memorys/exceptions/MemoryDependencyException.js";
import { MemoryServiceException } from "../../../../models/foundations/memorys/exceptions/MemoryServiceException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { createRandomString, createRecollectionOrchestrationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService recallMemories exceptions", () => {
  it.each([
    (inner: Error) => new MemoryDependencyException(createRandomString(), inner),
    (inner: Error) => new MemoryServiceException(createRandomString(), inner),
  ])("ShouldThrowDependencyExceptionOnRecallMemoriesIfDependencyErrorOccursAndLogItAsync (%#)", async (wrap) => {
    // given
    const { memoryServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const localException = new FailedMemoryServiceException(createRandomString(), new Error(createRandomString()));

    const expectedAgentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
      "Agent orchestration dependency error occurred, contact support.",
      localException,
    );

    memoryServiceMock.recall.mockRejectedValue(wrap(localException));

    // when
    const recallTask = recollectionOrchestrationService.recallMemories();

    // then
    const actualException = await recallTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyException);
    verifyNoOtherCalls(memoryServiceMock, { recall: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
