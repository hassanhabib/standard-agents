import { describe, expect, it } from "vitest";

import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { AgentOrchestrationValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationValidationException.js";
import { NullAgentContextException } from "../../../models/orchestrations/agents/exceptions/NullAgentContextException.js";
import { createDataCoordinationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService recall validations", () => {
  it("ShouldThrowValidationExceptionOnRecallIfContextIsNullAndLogItAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const nullContext = null as unknown as AgentContext;
    const nullAgentContextException = new NullAgentContextException("Agent context is null.");

    const expectedAgentOrchestrationValidationException = new AgentOrchestrationValidationException(
      "Agent orchestration validation error occurred, fix the error and try again.",
      nullAgentContextException,
    );

    // when
    const recallTask = dataCoordinationService.recall(nullContext);

    // then
    const actualException = await recallTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationValidationException);
    verifyNoOtherCalls(retrievalOrchestrationServiceMock);
    verifyNoOtherCalls(recollectionOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
