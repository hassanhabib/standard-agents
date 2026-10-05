import { describe, expect, it } from "vitest";

import {
  acceptedReply,
  createHttpMcpBrokerTests,
  ENDPOINT_URL,
  errorReply,
  eventStreamReply,
  INITIALIZE_RESULT,
  jsonReply,
  methodOf,
} from "./HttpMcpBrokerTests.js";

const FIND_STUDENT = {
  name: "find_student",
  description: "Finds a student by their id.",
  inputSchema: { type: "object", properties: { id: { type: "integer" } } },
};

describe("HttpMcpBroker list tools logic", () => {
  it("ShouldInitializeOnceThenListToolsAcceptingJsonAndEventStreamsAsync", async () => {
    // given — a server that expects the lifecycle the protocol defines
    const { requests, mcpBroker } = createHttpMcpBrokerTests((request) => {
      switch (methodOf(request)) {
        case "initialize":
          return jsonReply(INITIALIZE_RESULT);
        case "notifications/initialized":
          return acceptedReply();
        default:
          return jsonReply({ tools: [FIND_STUDENT] });
      }
    });

    // when
    const actualTools = await mcpBroker.listTools();
    await mcpBroker.listTools();

    // then — initialize, the initialized notification, then the work, once only
    expect(requests.map(methodOf)).toEqual(["initialize", "notifications/initialized", "tools/list", "tools/list"]);
    expect(requests[0]?.body["params"]).toMatchObject({ protocolVersion: "2025-06-18", clientInfo: { name: "standard-agents" } });
    expect(requests[1]?.body["id"]).toBeUndefined();

    for (const request of requests) {
      expect(request.url).toBe(ENDPOINT_URL);
      expect(request.headers["accept"]).toContain("application/json");
      expect(request.headers["accept"]).toContain("text/event-stream");
    }

    expect(actualTools).toEqual([
      { name: "find_student", description: "Finds a student by their id.", inputSchemaJson: JSON.stringify(FIND_STUDENT.inputSchema) },
    ]);
  });

  it("ShouldReadTheReplyFromAnEventStreamPastANotificationAsync", async () => {
    // given — a server answering as the official SDKs do: an event stream, where a notification
    // may arrive before the response it carries
    const notification = { jsonrpc: "2.0", method: "notifications/message", params: { level: "info" } };
    const listing = { jsonrpc: "2.0", id: 3, result: { tools: [FIND_STUDENT] } };
    const initialization = { jsonrpc: "2.0", id: 1, result: INITIALIZE_RESULT };

    const { mcpBroker } = createHttpMcpBrokerTests((request) => {
      switch (methodOf(request)) {
        case "initialize":
          return eventStreamReply(`event: message\ndata: ${JSON.stringify(initialization)}\n\n`);
        case "tools/list":
          return eventStreamReply(
            `event: message\ndata: ${JSON.stringify(notification)}\n\n` +
              `event: message\ndata: ${JSON.stringify(listing)}\n\n`,
          );
        default:
          return acceptedReply();
      }
    });

    // when
    const actualTools = await mcpBroker.listTools();

    // then
    expect(actualTools.map((tool) => tool.name)).toEqual(["find_student"]);
  });

  it("ShouldCarryOnWithoutASessionWhenTheServerHasNoInitializeAsync", async () => {
    // given — a server older than the lifecycle: it knows its tools, not initialize
    const { requests, mcpBroker } = createHttpMcpBrokerTests((request) =>
      methodOf(request) === "initialize" ? errorReply(-32601, "Method not found") : jsonReply({ tools: [{ name: "lookup" }] }),
    );

    // when
    const actualTools = await mcpBroker.listTools();

    // then — its tools still reach the agent, and nothing announces a session that never opened
    expect(actualTools.map((tool) => tool.name)).toEqual(["lookup"]);
    expect(requests.map(methodOf)).not.toContain("notifications/initialized");
  });

  it("ShouldFollowTheCursorUntilTheCatalogEndsAsync", async () => {
    // given — a server that pages its catalog, as servers with many tools do
    const { requests, mcpBroker } = createHttpMcpBrokerTests((request) => {
      const cursor = (request.body["params"] as { cursor?: string } | undefined)?.cursor;

      switch (methodOf(request)) {
        case "initialize":
          return jsonReply(INITIALIZE_RESULT);
        case "tools/list":
          return cursor === undefined
            ? jsonReply({ tools: [{ name: "first" }], nextCursor: "page-2" })
            : jsonReply({ tools: [{ name: "second" }] });
        default:
          return acceptedReply();
      }
    });

    // when
    const actualTools = await mcpBroker.listTools();

    // then — every page reaches the agent, in order, and the walk stops where the server says
    expect(actualTools.map((tool) => tool.name)).toEqual(["first", "second"]);
    expect(requests.filter((request) => methodOf(request) === "tools/list")).toHaveLength(2);
  });
});
