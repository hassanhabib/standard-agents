import { describe, expect, it } from "vitest";

import { createPromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import { AgentCoordinationValidationException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationValidationException.js";
import { InvalidAgentException } from "../../../models/coordinations/agents/exceptions/InvalidAgentException.js";
import { createRunManagementServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RunManagementServiceTests.js";

describe("RunManagementService run validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnRunIfPromptIsInvalidAndLogItAsync (%j)", async (invalidPrompt) => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const invalidAgentException = new InvalidAgentException("Invalid prompt. Please correct the error and try again.");

    const expectedAgentCoordinationValidationException = new AgentCoordinationValidationException(
      "Agent coordination validation error occurred, fix the error and try again.",
      invalidAgentException,
    );

    // when
    const runTask = runManagementService.run(createPromptRequest(invalidPrompt));

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentCoordinationValidationException);
    expectSameExceptionAs(actualException, expectedAgentCoordinationValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentCoordinationValidationException);
    verifyNoOtherCalls(dataCoordinationServiceMock);
    verifyNoOtherCalls(decisionCoordinationServiceMock);
    verifyNoOtherCalls(directionCoordinationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
