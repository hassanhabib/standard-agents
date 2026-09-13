import { describe, expect, it } from "vitest";

import { createGenerationResult } from "../../../brokers/generators/FunctionGeneratorBrokerV1.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { createNativeAsk } from "../../../models/foundations/brains/NativeAsk.js";
import { createRandomString } from "./BrainServiceTests.js";
import { createExchange, createNativeBrainServiceTests } from "./BrainServiceTests.Native.js";

describe("BrainService native streaming", () => {
  it("ShouldVoiceEachPieceAndReturnTheWholeGenerationAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();
    const completed = createGenerationResult({ content: "Hello there.", promptTokens: 8, completionTokens: 3 });

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "", narration: "Reading first.", completed: null };
      yield { content: "Hello ", narration: "", completed: null };
      yield { content: "there.", narration: "", completed: null };
      yield { content: "", narration: "", completed };
    });

    const voiced: Array<{ content: string; narration: string }> = [];

    // when
    const actualGeneration = await brainService.generateNativelyStream(createNativeAsk("say hello"), async (delta) => {
      voiced.push({ content: delta.content, narration: delta.narration });
    });

    // then
    expect(actualGeneration).toBe(completed);

    expect(voiced).toEqual([
      { content: "", narration: "Reading first." },
      { content: "Hello ", narration: "" },
      { content: "there.", narration: "" },
    ]);
  });

  it("ShouldClimbDownBeforeStreamingWhenTheConversationWouldNotFitAsync", async () => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests({
      elisionWindow: 3,
      contextLength: 300,
      charactersPerToken: 1,
    });

    const completed = createGenerationResult({ content: "ok" });

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "", narration: "", completed };
    });

    const first = createExchange({ callId: "call_1", toolName: "read_file", result: "x".repeat(200) });
    const second = createExchange({ callId: "call_2", toolName: "read_file", result: "y".repeat(200) });

    // when
    await brainService.generateNativelyStream(
      createNativeAsk("go", { exchanges: [first, second] }),
      async () => {},
    );

    // then
    const messages = generatorBrokerV1Mock.generateStream.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    expect(messages.filter((message) => message.role === "Tool")[0]?.content).toBe("[result elided by client: 200 bytes]");

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> the conversation would not fit the context; shrank the elision window to 1",
      true,
    );
  });

  it("ShouldRefuseAStreamThatEndedWithoutCompletingTheTurnAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "half an ans", narration: "", completed: null };
    });

    // when
    const streamTask = brainService.generateNativelyStream(createNativeAsk(createRandomString()), async () => {});

    // then
    const actualException = await streamTask.then(() => undefined, (error: unknown) => error);

    // The truncation is localised by the brain family, and what it was survives as the inner cause.
    expect(actualException).toBeInstanceOf(BrainServiceException);
    expect(String(actualException)).toContain("Brain service error");
  });

});
