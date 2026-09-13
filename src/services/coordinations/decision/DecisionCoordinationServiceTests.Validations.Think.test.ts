import { describe, expect, it } from "vitest";

import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { AgentOrchestrationValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationValidationException.js";
import { NullAgentContextException } from "../../../models/orchestrations/agents/exceptions/NullAgentContextException.js";
import { createDecisionCoordinationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./DecisionCoordinationServiceTests.js";

describe("DecisionCoordinationService think validations", () => {
  it("ShouldThrowValidationExceptionOnThinkIfContextIsNullAndLogItAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const nullContext = null as unknown as AgentContext;
    const nullAgentContextException = new NullAgentContextException("Agent context is null.");

    const expectedAgentOrchestrationValidationException = new AgentOrchestrationValidationException(
      "Agent orchestration validation error occurred, fix the error and try again.",
      nullAgentContextException,
    );

    // when
    const thinkTask = decisionCoordinationService.think(nullContext);

    // then
    const actualException = await thinkTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationValidationException);
    verifyNoOtherCalls(guardianOrchestrationServiceMock);
    verifyNoOtherCalls(inferenceOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
