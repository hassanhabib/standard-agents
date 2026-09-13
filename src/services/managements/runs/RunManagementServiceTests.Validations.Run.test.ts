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


  it("ShouldLetARunWithNoPromptThroughWhenItCarriesAnAnswerToAHeldActAsync", async () => {
    // given
    // A resumed run answering an act it already proposed. There is no new ask here: the person
    // pressed Allow on a card, which is not a sentence, and a client that had to invent one would
    // be writing words into somebody's conversation and showing them back as theirs.
    const { dataCoordinationServiceMock, runManagementService } = createRunManagementServiceTests();
    dataCoordinationServiceMock.recallSession.mockResolvedValue(null);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);

    const resumed = {
      ...createPromptRequest("", "a-session"),
      decision: { idempotencyKey: "the-key-the-answer-is-for", decision: "Approved" as const },
    };

    // when
    const actualException = await runManagementService.run(resumed).then(() => undefined, (error: unknown) => error);

    // then
    // Not refused for the prompt. What happens after this is the loop's business; what matters
    // here is that an empty ask carrying an answer is a legitimate request.
    expect(actualException).not.toBeInstanceOf(AgentCoordinationValidationException);
  });

});
