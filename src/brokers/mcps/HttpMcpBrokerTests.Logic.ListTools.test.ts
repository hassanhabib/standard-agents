import { describe, expect, it } from "vitest";

import {
  acceptedReply,
  createHttpMcpBrokerTests,
  ENDPOINT_URL,
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
});
