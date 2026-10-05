import { describe, expect, it } from "vitest";

import { acceptedReply, createHttpMcpBrokerTests, INITIALIZE_RESULT, jsonReply, methodOf } from "./HttpMcpBrokerTests.js";

describe("HttpMcpBroker transport logic", () => {
  it("ShouldCarryTheServersCredentialsOnEveryRequestAsync", async () => {
    // given — a server wanting an API key in a header of its own naming, and an access token that
    // changes between requests, as an OAuth token does
    let issued = 0;

    const { requests, mcpBroker } = createHttpMcpBrokerTests(
      (request) => (methodOf(request) === "initialize" ? jsonReply(INITIALIZE_RESULT) : methodOf(request) === "tools/list" ? jsonReply({ tools: [] }) : acceptedReply()),
      {
        apiKey: "psk-1",
        apiKeyHeader: "X-Tools-Key",
        bearerToken: "stale-static-token",
        bearerTokenProvider: async () => {
          issued += 1;

          return `token-${String(issued)}`;
        },
      },
    );

    // when
    await mcpBroker.listTools();

    // then — the key on every request, and the provider asked on every request, winning over the
    // static token
    expect(requests.map((request) => request.headers["x-tools-key"])).toEqual(["psk-1", "psk-1", "psk-1"]);
    expect(requests.map((request) => request.headers["authorization"])).toEqual(["Bearer token-1", "Bearer token-2", "Bearer token-3"]);
  });

  it("ShouldStopWaitingWhenTheCallIsCancelledOrTakesTooLongAsync", async () => {
    // given — a server that never answers a call, only gives up when its request is aborted
    const { mcpBroker } = createHttpMcpBrokerTests(
      async (request) => {
        switch (methodOf(request)) {
          case "initialize":
            return jsonReply(INITIALIZE_RESULT);
          case "notifications/initialized":
            return acceptedReply();
          default:
            return await new Promise<Response>((_resolve, reject) => {
              request.signal?.addEventListener("abort", () => reject(new Error("aborted")));
            });
        }
      },
      { timeoutMilliseconds: 50 },
    );

    const cancellation = new AbortController();

    // when
    const cancelledCall = mcpBroker.call("lookup", "{}", cancellation.signal);
    cancellation.abort();
    const slowCall = mcpBroker.call("lookup", "{}");

    // then — the caller's Stop reaches the call in flight, and the timeout ends a call nobody stopped
    await expect(cancelledCall).rejects.toThrow();
    await expect(slowCall).rejects.toThrow();
  });
});
