import { describe, expect, it } from "vitest";

import { createGenerationResult } from "../../../../brokers/generators/FunctionGeneratorBrokerV1.js";
import type { GenerationDelta } from "../../../../models/brokers/generators/v1/GenerationDelta.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import { createAgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";
import { createRandomString } from "./InferenceOrchestrationServiceTests.js";
import { createNativeInferenceTests } from "./InferenceOrchestrationServiceTests.Native.js";

describe("InferenceOrchestrationService streamed logic", () => {
  it("ShouldVoiceTheTurnAndReachTheSameDecisionTheBatchedDoorReachesAsync", async () => {
    // given
    const { brainServiceMock, loggingBrokerMock, inferenceOrchestrationService } = createNativeInferenceTests();
    const answer = createRandomString();
    const generation = createGenerationResult({ content: answer, promptTokens: 12, completionTokens: 4 });

    brainServiceMock.generateNativelyStream.mockImplementation(async (_ask: unknown, voice: (delta: GenerationDelta) => Promise<void>) => {
      await voice({ content: "", narration: "Looking first.", completed: null });
      await voice({ content: answer, narration: "", completed: null });

      return generation;
    });

    const voiced: GenerationDelta[] = [];

    // when
    const actualContext = await inferenceOrchestrationService.decideStream(
      createAgentContext("explain this repository"),
      async (delta) => {
        voiced.push(delta);
      },
    );

    // then
    expect(actualContext.directionType).toBe("ReturnResponse");
    expect(actualContext.payload).toBe(answer);
    expect(actualContext.promptTokens).toBe(12);
    expect(voiced.map((delta) => delta.narration)).toEqual(["Looking first.", ""]);
    expect(voiced.map((delta) => delta.content)).toEqual(["", answer]);

    // The trace says the same thing it says for a batched turn, so the two doors are comparable.
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Decision", "Interpreted -> ReturnResponse");
  });

  it("ShouldReadACallOutOfAStreamedTurnAsync", async () => {
    // given
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();

    brainServiceMock.generateNativelyStream.mockResolvedValue(
      createGenerationResult({
        toolCalls: [{ id: "call_9", name: "grep_files", argumentsJson: '{"q":"loader"}' }],
        finishReason: "tool_calls",
      }),
    );

    // when
    const actualContext = await inferenceOrchestrationService.decideStream(
      createAgentContext(createRandomString()),
      async () => {},
    );

    // then
    expect(actualContext.directionType).toBe("grep_files");
    expect(actualContext.payload).toBe('{"q":"loader"}');
    expect(actualContext.toolCallId).toBe("call_9");
  });

  it("ShouldReachTheBrainWithTheRunsOwnStopWhenStreamedAsync", async () => {
    // given
    // The streamed door is the one every window and every watched terminal run goes through, so a
    // stop that reached only the batched door reached almost nobody.
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    brainServiceMock.generateNativelyStream.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    const controller = new AbortController();

    // when
    await AgentRun.begin(null, controller.signal, async () => {
      await inferenceOrchestrationService.decideStream(createAgentContext(createRandomString()), async () => undefined);
    });

    // then
    expect(brainServiceMock.generateNativelyStream.mock.calls[0]?.[2]).toBe(controller.signal);
  });

  it("ShouldVoiceATextBrainsAnswerOnceSoEveryProfileCanBeStreamedAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    brainServiceMock.speaksNatively = false;
    brainServiceMock.generate.mockResolvedValue("SAY: Reading first.\nFINAL: 42");
    usageServiceMock.measure.mockResolvedValue({ promptTokens: 5, completionTokens: 2, isEstimated: true });

    const voiced: GenerationDelta[] = [];

    // when
    const actualContext = await inferenceOrchestrationService.decideStream(
      createAgentContext(createRandomString()),
      async (delta) => {
        voiced.push(delta);
      },
    );

    // then
    expect(actualContext.payload).toBe("42");
    expect(brainServiceMock.generateNativelyStream).not.toHaveBeenCalled();

    // Narration first and the answer after: the order a native brain produces them in, so a
    // consumer reading the two protocols sees one shape.
    expect(voiced).toEqual([
      { content: "", narration: "Reading first.", completed: null },
      { content: "42", narration: "", completed: null },
    ]);
  });

});
