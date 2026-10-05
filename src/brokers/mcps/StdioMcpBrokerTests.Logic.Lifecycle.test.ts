import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { StdioMcpBroker } from "./StdioMcpBroker.js";
import { answer, createScriptedStdioServer, INITIALIZE_RESULT, methodOf } from "./StdioMcpBrokerTests.js";

// A real stdio MCP server, as a script the current Node runs: it answers the lifecycle, lists one
// tool, and answers that tool with the argument it was given, its first command-line argument and
// one environment variable, so a test can prove all three reached the process.
const STUDENTS_SERVER = `
import { createInterface } from "node:readline";

const school = process.env.STUDENTS_SCHOOL ?? "no school";
const term = process.argv[2] ?? "no term";

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);

  if (message.id === undefined) {
    return;
  }

  const result =
    message.method === "initialize"
      ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "students", version: "1.0.0" } }
      : message.method === "tools/list"
        ? { tools: [{ name: "find_student", description: "Finds a student by their id.", inputSchema: { type: "object" } }] }
        : { content: [{ type: "text", text: "student " + message.params.arguments.id + " is Hassan, at " + school + ", for the " + term + " term" }] };

  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");
});
`;

function writeStudentsServer(): string {
  const path = join(mkdtempSync(join(tmpdir(), "standard-agents-mcp-")), "students-server.mjs");
  writeFileSync(path, STUDENTS_SERVER);

  return path;
}

describe("StdioMcpBroker lifecycle logic", () => {
  it("ShouldCarryOnWhenTheServerHasNoInitializeAsync", async () => {
    // given — a server older than the lifecycle: it knows its tools, not initialize
    const server = createScriptedStdioServer((message) =>
      methodOf(message) === "initialize"
        ? [JSON.stringify({ jsonrpc: "2.0", id: message["id"], error: { code: -32601, message: "Method not found" } })]
        : methodOf(message) === "tools/list"
          ? [answer(message, { tools: [{ name: "lookup" }] })]
          : [],
    );

    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input });

    // when
    const actualTools = await mcpBroker.listTools();

    // then — its tools still reach the agent, and nothing announces a session that never opened
    expect(actualTools.map((tool) => tool.name)).toEqual(["lookup"]);
    expect(server.lines.map(methodOf)).not.toContain("notifications/initialized");
  });

  it("ShouldThrowWhenTheServerEndsItsOutputBeforeAnsweringAsync", async () => {
    // given — a server process that exits before it answers anything
    const server = createScriptedStdioServer(() => []);
    server.end();

    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input });

    // when
    const listToolsAsync = mcpBroker.listTools();

    // then — a dependency that went away, never an empty catalog
    await expect(listToolsAsync).rejects.toThrow("ended its output");
  });

  it("ShouldStopWaitingWhenTheCallIsCancelledOrTakesTooLongAsync", async () => {
    // given — a server that answers the lifecycle and never answers a call
    const server = createScriptedStdioServer((message) => (methodOf(message) === "initialize" ? [answer(message, INITIALIZE_RESULT)] : []));
    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input }, 50);
    await mcpBroker.listTools().catch(() => undefined);
    const cancellation = new AbortController();

    // when
    const cancelledCall = mcpBroker.call("lookup", "{}", cancellation.signal);
    cancellation.abort();
    const slowCall = mcpBroker.call("lookup", "{}");

    // then — the caller's Stop reaches the call in flight, and the timeout ends a call nobody stopped
    await expect(cancelledCall).rejects.toThrow();
    await expect(slowCall).rejects.toThrow();
  });

  it("ShouldStartTheServerAsAProcessWithItsArgumentsAndEnvironmentAsync", async () => {
    // given — a real server process the broker starts itself
    const mcpBroker = new StdioMcpBroker({
      command: process.execPath,
      args: [writeStudentsServer(), "fall"],
      env: { STUDENTS_SCHOOL: "Redmond High" },
    });

    // when
    const actualTools = await mcpBroker.listTools();
    const actualText = await mcpBroker.call("find_student", JSON.stringify({ id: 1 }));

    // then
    expect(actualTools.map((tool) => tool.name)).toEqual(["find_student"]);
    expect(actualText).toBe("student 1 is Hassan, at Redmond High, for the fall term");
  });
});
