import { describe, expect, it } from "vitest";

import { createNativeAsk } from "../../../models/foundations/brains/NativeAsk.js";
import { createRandomString } from "./BrainServiceTests.js";
import {
  createExchange,
  createNativeBrainServiceTests,
  createRandomGeneration,
  createTooLargeRejection,
  createTurn,
} from "./BrainServiceTests.Native.js";

describe("BrainService native logic", () => {
  it("ShouldBuildTheConversationFromTheHistoryAndThisPromptAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();
    const exchange = createExchange({ callId: "call_1", toolName: "read_file", argumentsJson: '{"path":"a.ts"}', result: "the file" });
    const turn = createTurn({ prompt: "read a", answer: "read it", exchanges: [exchange] });
    const generation = createRandomGeneration();
    generatorBrokerV1Mock.generate.mockResolvedValue(generation);

    const ask = createNativeAsk("now read b", { systemPrompt: "You are a test agent.", history: [turn] });

    // when
    const actualGeneration = await brainService.generateNatively(ask);

    // then
    expect(actualGeneration).toBe(generation);

    expect(generatorBrokerV1Mock.generate.mock.calls[0]?.[0]).toEqual([
      { role: "System", content: "You are a test agent.", toolCalls: [], toolCallId: "", name: "" },
      { role: "User", content: "read a", toolCalls: [], toolCallId: "", name: "" },
      { role: "Assistant", content: "", toolCalls: [{ id: "call_1", name: "read_file", argumentsJson: '{"path":"a.ts"}' }], toolCallId: "", name: "" },
      { role: "Tool", content: "the file", toolCalls: [], toolCallId: "call_1", name: "read_file" },
      { role: "Assistant", content: "read it", toolCalls: [], toolCallId: "", name: "" },
      { role: "User", content: "now read b", toolCalls: [], toolCallId: "", name: "" },
    ]);
  });

  it("ShouldSayWhetherItSpeaksNatively", () => {
    // given
    const { brainService } = createNativeBrainServiceTests();

    // when
    const actualSpeaksNatively = brainService.speaksNatively;

    // then
    expect(actualSpeaksNatively).toBe(true);
  });

  it("ShouldKeepWhatOldCallsWereAndDropWhatTheyReturnedAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests({ elisionWindow: 1 });
    const older = createExchange({ callId: "call_1", toolName: "grep_files", argumentsJson: '{"q":"x"}', result: "many matches" });
    const newest = createExchange({ callId: "call_2", toolName: "read_file", argumentsJson: '{"path":"b.ts"}', result: "the newest" });
    generatorBrokerV1Mock.generate.mockResolvedValue(createRandomGeneration());

    const ask = createNativeAsk("carry on", { exchanges: [older, newest] });

    // when
    await brainService.generateNatively(ask);

    // then
    const messages = generatorBrokerV1Mock.generate.mock.calls[0]?.[0] as Array<{ role: string; content: string; toolCalls: unknown[] }>;
    const toolMessages = messages.filter((message) => message.role === "Tool");

    expect(toolMessages[0]?.content).toBe("[result elided by client: 12 bytes]");
    expect(toolMessages[1]?.content).toBe("the newest");

    // The call itself survives: the model still knows the act happened and what it asked for.
    expect(messages.filter((message) => message.toolCalls.length > 0)).toHaveLength(2);
  });

  it("ShouldKeepTheAnswerAReplayPointsBackToAsync", async () => {
    // given
    // Watched live: a 977-line file read in pages, the first page pushed out of the window by the
    // later ones, then asked for again. The replay said its answer was above; above was a marker.
    // The model could not see the file it was told to use, and read it forty more times.
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests({ elisionWindow: 1 });

    const firstPage = createExchange({
      callId: "call_1",
      toolName: "read_file",
      argumentsJson: '{"path":"index.html"}',
      result: "lines 1 to 400",
    });

    const secondPage = createExchange({
      callId: "call_2",
      toolName: "read_file",
      argumentsJson: '{"path":"index.html","offset":401}',
      result: "lines 401 to 800",
    });

    const replay = createExchange({
      callId: "call_3",
      toolName: "read_file",
      argumentsJson: '{"path":"index.html"}',
      result: "[read_file was asked for a third time with the same arguments. Its answer is above.]",
      replayed: true,
    });

    generatorBrokerV1Mock.generate.mockResolvedValue(createRandomGeneration());
    const ask = createNativeAsk("carry on", { exchanges: [firstPage, secondPage, replay] });

    // when
    await brainService.generateNatively(ask);

    // then
    // The replay is in view, so what it points back to is in view too. The page in between was
    // not asked for again and goes the way the window says.
    const messages = generatorBrokerV1Mock.generate.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    const toolMessages = messages.filter((message) => message.role === "Tool");

    expect(toolMessages[0]?.content).toBe("lines 1 to 400");
    expect(toolMessages[1]?.content).toBe("[result elided by client: 16 bytes]");
  });

  it("ShouldCarryOnlyTheObservationsNoCallAccountsForAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();
    const exchange = createExchange({ toolName: "read_file", result: "the file" });
    generatorBrokerV1Mock.generate.mockResolvedValue(createRandomGeneration());

    const ask = createNativeAsk("carry on", {
      exchanges: [exchange],
      observations: ["read_file: the file", "delete_path: denied, nothing permits it"],
    });

    // when
    await brainService.generateNatively(ask);

    // then
    const messages = generatorBrokerV1Mock.generate.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    const last = messages[messages.length - 1];

    expect(last?.role).toBe("Assistant");
    expect(last?.content).toBe("Observations so far:\n- delete_path: denied, nothing permits it");
    expect(last?.content).not.toContain("read_file");
  });

  it("ShouldAnnounceThatTheNativeBrokerIgnoresTheRequestAsync", async () => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests({}, false);
    generatorBrokerV1Mock.generate.mockResolvedValue(createRandomGeneration());

    // when
    await brainService.generateNatively(createNativeAsk(createRandomString()));

    // then
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> broker does not honor requests; shape enforced by guardian only",
      true,
    );
  });

  it("ShouldShrinkTheWindowBeforeSendingWhenTheConversationWouldNotFitAsync", async () => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests({
      elisionWindow: 3,
      contextLength: 300,
      charactersPerToken: 1,
    });

    // Long enough that eliding one of them actually buys room: the marker costs its own bytes.
    const first = createExchange({ callId: "call_1", toolName: "read_file", result: "x".repeat(200) });
    const second = createExchange({ callId: "call_2", toolName: "read_file", result: "y".repeat(200) });
    generatorBrokerV1Mock.generate.mockResolvedValue(createRandomGeneration());

    // when
    await brainService.generateNatively(createNativeAsk("go", { exchanges: [first, second] }));

    // then
    const messages = generatorBrokerV1Mock.generate.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    const toolMessages = messages.filter((message) => message.role === "Tool");

    expect(generatorBrokerV1Mock.generate).toHaveBeenCalledTimes(1);
    expect(toolMessages[0]?.content).toBe("[result elided by client: 200 bytes]");
    expect(toolMessages[1]?.content).toBe("y".repeat(200));

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> the conversation would not fit the context; shrank the elision window to 1",
      true,
    );
  });

  it("ShouldClimbDownWhenTheProviderRefusesTheRequestAsTooLargeAsync", async () => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests({ elisionWindow: 5 });
    const generation = createRandomGeneration();

    generatorBrokerV1Mock.generate
      .mockRejectedValueOnce(createTooLargeRejection())
      .mockResolvedValueOnce(generation);

    const ask = createNativeAsk("go", { exchanges: [createExchange({ callId: "call_1" }), createExchange({ callId: "call_2" })] });

    // when
    const actualGeneration = await brainService.generateNatively(ask);

    // then
    expect(actualGeneration).toBe(generation);
    expect(generatorBrokerV1Mock.generate).toHaveBeenCalledTimes(2);

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> the provider refused the request as too large; shrank the elision window to 1",
      true,
    );

    // The second attempt gave up the older result and kept the newest.
    const second = generatorBrokerV1Mock.generate.mock.calls[1]?.[0] as Array<{ role: string; content: string }>;
    expect(second.filter((message) => message.role === "Tool")[0]?.content).toContain("elided by client");
  });

  it("ShouldRaiseAnythingThatIsNotAContextRefusalAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();
    const rejection = new Error("HTTP 401") as Error & { status: number; body: string };
    rejection.status = 401;
    rejection.body = "unauthorized";
    generatorBrokerV1Mock.generate.mockRejectedValue(rejection);

    // when
    const generateTask = brainService.generateNatively(createNativeAsk(createRandomString()));

    // then
    await expect(generateTask).rejects.toThrow();
    expect(generatorBrokerV1Mock.generate).toHaveBeenCalledTimes(1);
  });

});
