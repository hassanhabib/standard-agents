import { describe, expect, it } from "vitest";

import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { AgentOrchestrationValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationValidationException.js";
import { NullAgentContextException } from "../../../models/orchestrations/agents/exceptions/NullAgentContextException.js";
import { createDirectionCoordinationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./DirectionCoordinationServiceTests.js";

describe("DirectionCoordinationService act validations", () => {
  it("ShouldThrowValidationExceptionOnActIfContextIsNullAndLogItAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const nullContext = null as unknown as AgentContext;
    const nullAgentContextException = new NullAgentContextException("Agent context is null.");

    const expectedAgentOrchestrationValidationException = new AgentOrchestrationValidationException(
      "Agent orchestration validation error occurred, fix the error and try again.",
      nullAgentContextException,
    );

    // when
    const actTask = directionCoordinationService.act(nullContext);

    // then
    const actualException = await actTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationValidationException);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock);
    verifyNoOtherCalls(executionOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
