import { describe, expect, it } from "vitest";

import { acceptedReply, createHttpMcpBrokerTests, INITIALIZE_RESULT, jsonReply, methodOf } from "./HttpMcpBrokerTests.js";

describe("HttpMcpBroker session logic", () => {
  it("ShouldCarryTheSessionAndTheNegotiatedVersionAfterInitializeAsync", async () => {
    // given — a server that opens a session and settles on an older protocol version
    const { requests, mcpBroker } = createHttpMcpBrokerTests((request) => {
      switch (methodOf(request)) {
        case "initialize":
          return jsonReply({ ...INITIALIZE_RESULT, protocolVersion: "2025-03-26" }, { headers: { "mcp-session-id": "session-7" } });
        case "notifications/initialized":
          return acceptedReply();
        default:
          return jsonReply({ tools: [] });
      }
    });

    // when
    await mcpBroker.listTools();

    // then — initialize opens the session; everything after it carries the session and the
    // version the server chose
    expect(requests[0]?.headers["mcp-session-id"]).toBeUndefined();

    for (const request of requests.slice(1)) {
      expect(request.headers["mcp-session-id"]).toBe("session-7");
      expect(request.headers["mcp-protocol-version"]).toBe("2025-03-26");
    }
  });

  it("ShouldStartANewSessionWhenTheServerForgetsTheOldOneAsync", async () => {
    // given — a server that ends its first session after one listing, answering 404 to it from
    // then on, as the protocol says a server that terminated a session does
    let openedSessions = 0;
    let listings = 0;

    const { requests, mcpBroker } = createHttpMcpBrokerTests((request) => {
      switch (methodOf(request)) {
        case "initialize":
          openedSessions += 1;

          return jsonReply(INITIALIZE_RESULT, { headers: { "mcp-session-id": `session-${String(openedSessions)}` } });
        case "notifications/initialized":
          return acceptedReply();
        default:
          listings += 1;

          return request.headers["mcp-session-id"] === "session-1" && listings > 1
            ? new Response(null, { status: 404 })
            : jsonReply({ tools: [{ name: "lookup" }] });
      }
    });

    await mcpBroker.listTools();

    // when
    const actualTools = await mcpBroker.listTools();

    // then — a fresh initialize without the dead session, and the listing retried on the new one
    expect(actualTools.map((tool) => tool.name)).toEqual(["lookup"]);
    expect(openedSessions).toBe(2);

    const reinitialize = requests.filter((request) => methodOf(request) === "initialize")[1];
    expect(reinitialize?.headers["mcp-session-id"]).toBeUndefined();
    expect(requests.at(-1)?.headers["mcp-session-id"]).toBe("session-2");
  });
});
