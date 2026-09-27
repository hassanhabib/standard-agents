import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GenerationDelta } from "../../models/brokers/generators/v1/GenerationDelta.js";
import { userMessage } from "../../models/brokers/generators/v1/ConversationMessage.js";
import { createHttpGeneratorBrokerV1Tests, streamResponse } from "./HttpGeneratorBrokerV1Tests.js";

describe("HttpGeneratorBrokerV1 generateStream logic", () => {
  const globalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("the broker streamed through the global fetch");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  it("ShouldStreamThroughTheFetchItWasGivenAsync", async () => {
    // given
    const transcript = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      "",
      'data: {"choices":[{"delta":{"narration":"Reading the entry point."}}]}',
      "",
      'data: {"choices":[{"delta":{"content":"two"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":" packages"},"finish_reason":"stop"}]}',
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n");

    const { requests, generatorBroker } = createHttpGeneratorBrokerV1Tests(() => streamResponse(transcript));

    // when
    const deltas: GenerationDelta[] = [];

    for await (const delta of generatorBroker.generateStream([userMessage("explain this repository")], [])) {
      deltas.push(delta);
    }

    // then
    expect(requests[0]?.headers["accept"]).toBe("text/event-stream");
    expect(requests[0]?.body["stream"]).toBe(true);

    // What was said, in order, rather than every piece: a stream may say it has begun with an empty
    // piece before it says anything.
    expect(deltas.map((delta) => delta.narration).filter((said) => said.length > 0)).toEqual(["Reading the entry point."]);
    expect(deltas.map((delta) => delta.content).filter((said) => said.length > 0)).toEqual(["two", " packages"]);
    expect(deltas.at(-1)?.completed?.content).toBe("two packages");
    expect(deltas.at(-1)?.completed?.headers["x-example-decider"]).toBe("peer-7");
  });

  it("ShouldSayTheStreamHasBegunAsSoonAsTheServiceAnswersAsync", async () => {
    // given
    // A turn that is a tool call, from a Host on somebody's own hardware: the role frame at once,
    // then the call's arguments frame by frame, and not one word of content. Nothing was handed up
    // until the whole turn had finished, so the brain's first-piece clock ran out on a Host that
    // had answered in two seconds and was plainly working.
    const transcript = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      "",
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_file","arguments":"{\\"path\\":"}}]}}]}',
      "",
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"a.txt\\"}"}}]},"finish_reason":"tool_calls"}]}',
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n");

    const { generatorBroker } = createHttpGeneratorBrokerV1Tests(() => streamResponse(transcript));

    // when
    const deltas: GenerationDelta[] = [];

    for await (const delta of generatorBroker.generateStream([userMessage("read a.txt")], [])) {
      deltas.push(delta);
    }

    // then
    // The first thing handed up is an empty piece saying the stream has begun, before the turn is
    // complete, and the turn itself still arrives whole at the end.
    expect(deltas[0]).toEqual({ content: "", narration: "", completed: null });
    expect(deltas.at(-1)?.completed?.toolCalls[0]?.name).toBe("read_file");
  });
});
