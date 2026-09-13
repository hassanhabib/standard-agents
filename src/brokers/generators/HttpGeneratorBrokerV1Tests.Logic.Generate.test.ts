import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { userMessage } from "../../models/brokers/generators/v1/ConversationMessage.js";
import { createHttpGeneratorBrokerV1Tests, jsonResponse } from "./HttpGeneratorBrokerV1Tests.js";

describe("HttpGeneratorBrokerV1 generate logic", () => {
  const globalFetch = globalThis.fetch;

  beforeEach(() => {
    // A broker that reaches for the global instead of the fetch it was handed fails here rather
    // than reaching the network, so the miss is a red test and never a flaky one.
    globalThis.fetch = (() => {
      throw new Error("the broker posted through the global fetch");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  it("ShouldPostThroughTheFetchItWasGivenAsync", async () => {
    // given
    const answer = "the repository holds two packages";

    const { requests, generatorBroker } = createHttpGeneratorBrokerV1Tests(() =>
      jsonResponse({
        choices: [{ message: { content: answer }, finish_reason: "stop" }],
        usage: { prompt_tokens: 11, completion_tokens: 4 },
      }));

    // when
    const generation = await generatorBroker.generate([userMessage("explain this repository")], []);

    // then
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/v1/chat/completions");
    expect(requests[0]?.method).toBe("POST");
    expect(requests[0]?.headers["authorization"]).toBe("Bearer key_a_test_key");
    expect(requests[0]?.headers["user-agent"]).toBe("tests/1.0");
    expect(requests[0]?.body["model"]).toBe("example-model");
    expect(requests[0]?.body["stream"]).toBe(false);

    expect(generation.content).toBe(answer);
    expect(generation.finishReason).toBe("stop");
    expect(generation.headers["x-example-decider"]).toBe("peer-7");
  });

});
