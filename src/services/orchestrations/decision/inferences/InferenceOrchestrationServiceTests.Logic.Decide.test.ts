import { describe, expect, it } from "vitest";

import { createResolvedInference } from "../../../../models/brokers/generators/ResolvedInference.js";
import { createRandomContext, createRandomString, createRandomUsage, createInferenceOrchestrationServiceTests, verifyNoOtherCalls } from "./InferenceOrchestrationServiceTests.js";

describe("InferenceOrchestrationService decide logic", () => {
  it("ShouldDecideFinalAnswerAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const answer = `${createRandomString()}\n${createRandomString()}`;
    const reply = `FINAL: ${answer}`;
    const usage = createRandomUsage();
    const expectedUserMessage = `Task: ${context.prompt}`;
    brainServiceMock.generate.mockResolvedValue(reply);
    usageServiceMock.measure.mockResolvedValue(usage);

    const expectedContext = {
      ...context,
      intent: "Respond",
      directionType: "ReturnResponse",
      payload: answer,
      rawReply: reply,
      narration: "",
      transferring: false,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      usageIsEstimated: true,
    };

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(brainServiceMock.generate).toHaveBeenCalledWith(context.systemPrompt, expectedUserMessage);
    expect(usageServiceMock.measure).toHaveBeenCalledWith(context.systemPrompt + expectedUserMessage, reply);
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Decision", "Brain replied", reply, true);
    expect(loggingBrokerMock.logProcess).toHaveBeenNthCalledWith(1, "Decision", `Brain -> ${usage.promptTokens + usage.completionTokens} tokens (counted)`, true);
    expect(loggingBrokerMock.logProcess).toHaveBeenNthCalledWith(2, "Decision", "Interpreted -> ReturnResponse");
    verifyNoOtherCalls(brainServiceMock, { generate: 1 });
    verifyNoOtherCalls(usageServiceMock, { measure: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1, logProcess: 2 });
  });

  it("ShouldDecideActionOnFirstLineAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const toolName = createRandomString();
    const toolInput = `${createRandomString()}: keeps its own colon`;
    const reply = `ACTION: ${toolName}: ${toolInput}\nFINAL: wrong`;
    const usage = createRandomUsage();
    brainServiceMock.generate.mockResolvedValue(reply);
    usageServiceMock.measure.mockResolvedValue(usage);

    const expectedContext = {
      ...context,
      intent: toolName,
      directionType: toolName,
      payload: toolInput,
      rawReply: reply,
      narration: "",
      transferring: false,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      usageIsEstimated: true,
    };

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(loggingBrokerMock.logProcess).toHaveBeenNthCalledWith(2, "Decision", `Interpreted -> ${toolName}`);
    verifyNoOtherCalls(brainServiceMock, { generate: 1 });
    verifyNoOtherCalls(usageServiceMock, { measure: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1, logProcess: 2 });
  });

  it("ShouldDecideAnswerOnDecideIfActionNamesNoToolAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    brainServiceMock.generate.mockResolvedValue("  ACTION:  ");
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.directionType).toBe("ReturnResponse");
    expect(actualContext.intent).toBe("Respond");
    expect(actualContext.payload).toBe("ACTION:");
    expect(actualContext.rawReply).toBe("ACTION:");
  });

  it("ShouldDecideStructuredToolCallAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const toolName = createRandomString();
    const expression = createRandomString();
    const reply = `TOOL: { "tool": "${toolName}", "arguments": { "expression": "${expression}" } }\nFINAL: wrong`;
    brainServiceMock.generate.mockResolvedValue(reply);
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.directionType).toBe(toolName);
    expect(actualContext.intent).toBe(toolName);
    expect(actualContext.payload).toBe(JSON.stringify({ expression }));
    expect(actualContext.transferring).toBe(false);
  });

  it("ShouldDecideAnswerOnDecideIfToolCallIsMalformedAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    brainServiceMock.generate.mockResolvedValue("TOOL: not a call");
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.directionType).toBe("ReturnResponse");
    expect(actualContext.payload).toBe("TOOL: not a call");
  });

  it("ShouldDecideTransferWithTaskAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const agentName = createRandomString();
    const task = createRandomString();
    brainServiceMock.generate.mockResolvedValue(`TRANSFER: ${agentName}: ${task}`);
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.directionType).toBe(agentName);
    expect(actualContext.intent).toBe(agentName);
    expect(actualContext.payload).toBe(task);
    expect(actualContext.transferring).toBe(true);
  });

  it("ShouldDecideTransferWithDefaultTaskAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const agentName = createRandomString();
    brainServiceMock.generate.mockResolvedValue(`TRANSFER: ${agentName}`);
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.directionType).toBe(agentName);
    expect(actualContext.payload).toBe("answer the user's request in full.");
    expect(actualContext.transferring).toBe(true);
  });

  it("ShouldPeelNarrationBeforeTheActOnDecideAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const narration = createRandomString();
    const toolName = createRandomString();
    const toolInput = createRandomString();
    brainServiceMock.generate.mockResolvedValue(`SAY: ${narration}\nACTION: ${toolName}: ${toolInput}`);
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.narration).toBe(narration);
    expect(actualContext.directionType).toBe(toolName);
    expect(actualContext.payload).toBe(toolInput);
  });

  it("ShouldPeelNarrationWithNoChoiceOnDecideAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = createRandomContext();
    const narration = createRandomString();
    brainServiceMock.generate.mockResolvedValue(`SAY: ${narration}`);
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.narration).toBe(narration);
    expect(actualContext.directionType).toBe("ReturnResponse");
    expect(actualContext.payload).toBe("");
  });

  it("ShouldShowHistoryAndObservationsOnDecideAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const context = {
      ...createRandomContext(),
      history: [
        { prompt: createRandomString(), answer: createRandomString(), exchanges: [] },
        { prompt: createRandomString(), answer: createRandomString(), exchanges: [] },
      ],
      observations: [createRandomString(), createRandomString()],
    };

    const expectedUserMessage =
      "Conversation so far:\n\n" +
      `User: ${context.history[0]?.prompt}\nYou: ${context.history[0]?.answer}\n` +
      `User: ${context.history[1]?.prompt}\nYou: ${context.history[1]?.answer}\n` +
      "\n" +
      `Task: ${context.prompt}` +
      "\n\nObservations so far:\n" +
      `- ${context.observations[0]}\n- ${context.observations[1]}\n`;

    brainServiceMock.generate.mockResolvedValue("FINAL: done");
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    await inferenceOrchestrationService.decide(context);

    // then
    expect(brainServiceMock.generate).toHaveBeenCalledWith(context.systemPrompt, expectedUserMessage);
    expect(usageServiceMock.measure).toHaveBeenCalledWith(context.systemPrompt + expectedUserMessage, "FINAL: done");
  });

  it("ShouldHandInferenceToBrainOnDecideIfContextCarriesItAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } =
      createInferenceOrchestrationServiceTests();

    const inference = { ...createResolvedInference(), temperature: 0.2, maxTokens: 64 };
    const context = { ...createRandomContext(), inference };
    brainServiceMock.generate.mockResolvedValue("FINAL: done");
    usageServiceMock.measure.mockResolvedValue(createRandomUsage());

    // when
    await inferenceOrchestrationService.decide(context);

    // then
    expect(brainServiceMock.generate).toHaveBeenCalledWith(context.systemPrompt, `Task: ${context.prompt}`, inference);
    verifyNoOtherCalls(brainServiceMock, { generate: 1 });
  });

});
