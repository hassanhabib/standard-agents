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

    expect(deltas.map((delta) => delta.narration)).toEqual(["Reading the entry point.", "", "", ""]);
    expect(deltas.map((delta) => delta.content)).toEqual(["", "two", " packages", ""]);
    expect(deltas.at(-1)?.completed?.content).toBe("two packages");
    expect(deltas.at(-1)?.completed?.headers["x-example-decider"]).toBe("peer-7");
  });

});
