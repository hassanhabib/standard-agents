import { describe, expect, it } from "vitest";

import { StreamInterruptedException } from "../../models/brokers/generators/v1/StreamInterruptedException.js";
import { applyFrame, completeGeneration, createStreamState, readFrames } from "./ServerSentEvents.js";

async function* streamOf(chunks: readonly string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collect(frames: AsyncIterable<string>): Promise<string[]> {
  const payloads: string[] = [];

  for await (const payload of frames) {
    payloads.push(payload);
  }

  return payloads;
}

describe("ServerSentEvents", () => {
  it("ShouldReadTheFramesABlankLineSeparatesAsync", async () => {
    // given
    const stream = streamOf(['data: {"a":1}\n\ndata: {"b":2}\n\n']);

    // when
    const actualPayloads = await collect(readFrames(stream));

    // then
    expect(actualPayloads).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("ShouldToleratePlatformLineEndingsAndPassOverWhatCarriesNoDataAsync", async () => {
    // given
    const stream = streamOf([': keep-alive\r\n\r\nevent: message\r\ndata: {"a":1}\r\n\r\n:\r\n\r\ndata: [DONE]\r\n\r\n']);

    // when
    const actualPayloads = await collect(readFrames(stream));

    // then
    expect(actualPayloads).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("ShouldReadAFrameAChunkBoundaryCutInHalfAsync", async () => {
    // given
    const stream = streamOf(['data: {"content":"hel', 'lo wor', 'ld"}\n\ndata: [DO', "NE]\n\n"]);

    // when
    const actualPayloads = await collect(readFrames(stream));

    // then
    expect(actualPayloads).toEqual(['{"content":"hello world"}', "[DONE]"]);
  });

  it("ShouldDeliverALastFrameTheStreamNeverClosedWithABlankLineAsync", async () => {
    // given
    const stream = streamOf(['data: {"a":1}']);

    // when
    const actualPayloads = await collect(readFrames(stream));

    // then
    expect(actualPayloads).toEqual(['{"a":1}']);
  });

  it("ShouldRefuseToCompleteAStreamThatClosedBeforeTheTerminalFrameAsync", async () => {
    // given
    const state = createStreamState();
    applyFrame(state, '{"choices":[{"delta":{"content":"half an ans"}}]}');

    // when
    const completeAction = (): unknown => completeGeneration(state, {});

    // then
    expect(completeAction).toThrow(StreamInterruptedException);

    try {
      completeAction();
    } catch (error: unknown) {
      expect((error as StreamInterruptedException).reason).toBe("truncated");
    }
  });

  it("ShouldSayWhatEachFrameCarriedAndKeepTheWholeAnswerAsync", async () => {
    // given
    const state = createStreamState();

    // when
    const opening = applyFrame(state, '{"choices":[{"delta":{"role":"assistant"}}]}');
    const said = applyFrame(state, '{"choices":[{"delta":{"narration":"Reading the entry point."}}]}');
    const first = applyFrame(state, '{"choices":[{"delta":{"content":"Hello "}}]}');
    const second = applyFrame(state, '{"choices":[{"delta":{"content":"there."},"finish_reason":"stop"}]}');
    applyFrame(state, '{"usage":{"prompt_tokens":11,"completion_tokens":4}}');
    applyFrame(state, "[DONE]");

    // then
    expect(opening).toBeNull();
    expect(said).toEqual({ content: "", narration: "Reading the entry point.", completed: null });
    expect(first).toEqual({ content: "Hello ", narration: "", completed: null });
    expect(second).toEqual({ content: "there.", narration: "", completed: null });

    expect(completeGeneration(state, { "x-example-decider": "peer-7" })).toEqual({
      content: "Hello there.",
      toolCalls: [],
      narration: "",
      promptTokens: 11,
      completionTokens: 4,
      headers: { "x-example-decider": "peer-7" },
      finishReason: "stop",
    });
  });

  it("ShouldAccumulateACallWhoseArgumentsArriveInPiecesAsync", async () => {
    // given
    const state = createStreamState();

    // when
    applyFrame(state, '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_file","arguments":"{\\"path\\":"}}]}}]}');
    applyFrame(state, '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"src/a.ts\\"}"}}]},"finish_reason":"tool_calls"}]}');
    applyFrame(state, "[DONE]");

    // then
    const actualGeneration = completeGeneration(state, {});
    expect(actualGeneration.toolCalls).toEqual([{ id: "call_1", name: "read_file", argumentsJson: '{"path":"src/a.ts"}' }]);
    expect(actualGeneration.finishReason).toBe("tool_calls");
  });

  it("ShouldKeepTwoCallsApartByTheirIndexAsync", async () => {
    // given
    const state = createStreamState();

    // when
    applyFrame(
      state,
      '{"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"second","arguments":"{}"}},{"index":0,"id":"a","function":{"name":"first","arguments":"{}"}}]}}]}',
    );
    applyFrame(state, "[DONE]");

    // then
    expect(completeGeneration(state, {}).toolCalls).toEqual([
      { id: "a", name: "first", argumentsJson: "{}" },
      { id: "b", name: "second", argumentsJson: "{}" },
    ]);
  });

  it("ShouldFailTheTurnOnAnErrorFrameHoweverMuchArrivedBeforeItAsync", async () => {
    // given
    const state = createStreamState();
    applyFrame(state, '{"choices":[{"delta":{"content":"partial"}}]}');

    // when
    const applyAction = (): unknown => applyFrame(state, '{"error":{"message":"upstream capacity","code":"service_busy"}}');

    // then
    expect(applyAction).toThrow(StreamInterruptedException);
    expect(applyAction).toThrow("upstream capacity");

    try {
      applyAction();
    } catch (error: unknown) {
      expect((error as StreamInterruptedException).reason).toBe("failed");
    }
  });

});
