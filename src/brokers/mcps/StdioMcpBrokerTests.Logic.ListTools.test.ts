import { describe, expect, it } from "vitest";

import { StdioMcpBroker } from "./StdioMcpBroker.js";
import { answer, createScriptedStdioServer, INITIALIZE_RESULT, methodOf } from "./StdioMcpBrokerTests.js";

const FIND_STUDENT = {
  name: "find_student",
  description: "Finds a student by their id.",
  inputSchema: { type: "object", properties: { id: { type: "integer" } } },
};

describe("StdioMcpBroker list tools logic", () => {
  it("ShouldInitializeOverStandardInputThenListEveryPageAsync", async () => {
    // given — a server that expects the lifecycle first, and pages its catalog
    const server = createScriptedStdioServer((message) => {
      const cursor = (message["params"] as { cursor?: string } | undefined)?.cursor;

      switch (methodOf(message)) {
        case "initialize":
          return [answer(message, INITIALIZE_RESULT)];
        case "tools/list":
          return cursor === undefined
            ? [answer(message, { tools: [FIND_STUDENT], nextCursor: "page-2" })]
            : [answer(message, { tools: [{ name: "second" }] })];
        default:
          return [];
      }
    });

    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input });

    // when
    const actualTools = await mcpBroker.listTools();

    // then — initialize, the initialized notification, then every page of the catalog
    expect(server.lines.map(methodOf)).toEqual(["initialize", "notifications/initialized", "tools/list", "tools/list"]);
    expect(server.lines[0]?.["params"]).toMatchObject({ protocolVersion: "2025-06-18", clientInfo: { name: "standard-agents" } });
    expect(server.lines[1]?.["id"]).toBeUndefined();

    expect(actualTools).toEqual([
      { name: "find_student", description: "Finds a student by their id.", inputSchemaJson: JSON.stringify(FIND_STUDENT.inputSchema) },
      { name: "second", description: "", inputSchemaJson: "{}" },
    ]);
  });
});
