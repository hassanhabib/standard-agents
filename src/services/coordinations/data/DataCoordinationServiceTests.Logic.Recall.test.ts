import { describe, expect, it } from "vitest";

import { createResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import { createDataCoordinationServiceTests, createRandomContext, createRandomString, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService recall logic", () => {
  it("ShouldRecallAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const context = createRandomContext();
    const instructions = createRandomString();
    const memories = [createRandomString()];
    const knowledge = [createRandomString(), createRandomString()];
    retrievalOrchestrationServiceMock.retrieveInstructions.mockResolvedValue(instructions);
    recollectionOrchestrationServiceMock.recallMemories.mockResolvedValue(memories);
    retrievalOrchestrationServiceMock.retrieveGrounding.mockResolvedValue(knowledge);

    const expectedContext = {
      ...context,
      systemPrompt: instructions,
      observations: [...context.observations, ...memories, ...knowledge],
    };

    // when
    const actualContext = await dataCoordinationService.recall(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(retrievalOrchestrationServiceMock.retrieveInstructions).toHaveBeenCalledWith(context.route);
    expect(retrievalOrchestrationServiceMock.retrieveGrounding).toHaveBeenCalledWith(context.prompt);
    expect(loggingBrokerMock.logPayload).toHaveBeenNthCalledWith(1, "Data", "Received prompt", context.prompt, false);
    expect(loggingBrokerMock.logPayload).toHaveBeenNthCalledWith(2, "Data", "System prompt sent to Decision", instructions, true);
    verifyNoOtherCalls(retrievalOrchestrationServiceMock, { retrieveInstructions: 1, retrieveGrounding: 1 });
    verifyNoOtherCalls(recollectionOrchestrationServiceMock, { recallMemories: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 2 });
  });

  it("ShouldAppendCallerVocabularyOnRecallIfInferenceCarriesCallerToolsAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const callerTool = { name: createRandomString(), description: createRandomString(), parametersJson: "{}" };
    const context = { ...createRandomContext(), inference: { ...createResolvedInference(), callerTools: [callerTool] } };
    const instructions = createRandomString();
    retrievalOrchestrationServiceMock.retrieveInstructions.mockResolvedValue(instructions);
    recollectionOrchestrationServiceMock.recallMemories.mockResolvedValue([]);
    retrievalOrchestrationServiceMock.retrieveGrounding.mockResolvedValue([]);

    const expectedSystemPrompt =
      `${instructions}\n\nThe caller also accepts these tool calls. Invoke them exactly like tools; ` +
      `the caller executes them, not you:\n- ${callerTool.name}: ${callerTool.description} parameters: {}`;

    // when
    const actualContext = await dataCoordinationService.recall(context);

    // then
    expect(actualContext.systemPrompt).toBe(expectedSystemPrompt);
    expect(loggingBrokerMock.logPayload).toHaveBeenNthCalledWith(2, "Data", "System prompt sent to Decision", expectedSystemPrompt, true);
  });

});
