import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { StandardAgent } from "./StandardAgent.js";
import { createRandomString, createScriptedBrain } from "./StandardAgentTests.js";

// The agent against a real MCP server on a real socket: the lifecycle, the catalog and the call
// cross the wire as the protocol shapes them, and the server answers from its own state.

let server: Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server === null) {
      resolve();

      return;
    }

    server.close(() => {
      resolve();
    });
  });

  server = null;
});

async function startStudentsServer(): Promise<string> {
  server = createServer((request, response) => {
    let body = "";

    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    request.on("end", () => {
      const message = JSON.parse(body) as { id?: number; method: string; params?: { arguments?: { id?: number } } };

      if (message.id === undefined) {
        response.writeHead(202).end();

        return;
      }

      const result =
        message.method === "initialize"
          ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "students", version: "1.0.0" } }
          : message.method === "tools/list"
            ? { tools: [{ name: "find_student", description: "Finds a student by their id.", inputSchema: { type: "object" } }] }
            : { content: [{ type: "text", text: `student ${String(message.params?.arguments?.id)} is Hassan` }] };

      response.writeHead(200, { "content-type": "application/json", "mcp-session-id": "session-1" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
    });
  });

  await new Promise<void>((resolve) => {
    server?.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/`;
}

describe("StandardAgent remote server logic", () => {
  it("ShouldReachAnMcpServerByUrlAndCallItsToolAsync", async () => {
    // given
    const endpointUrl = await startStudentsServer();
    const brain = createScriptedBrain(['ACTION: find_student: {"id":1}', "FINAL: done"]);
    const agent = new StandardAgent().onBrain(brain.generate).mcp(endpointUrl, { relativeUrl: "mcp" });

    // when
    await agent.processPrompt(createRandomString());

    // then — the tool was found in the server's catalog, called, and its answer came back
    expect(brain.calls[1]?.userPrompt).toContain("student 1 is Hassan");
  });

  it("ShouldStartAnMcpServerProcessAndCallItsToolAsync", async () => {
    // given — a real MCP server process the agent starts itself, with an argument and an
    // environment variable it must pass through
    const serverPath = join(mkdtempSync(join(tmpdir(), "standard-agents-mcp-")), "students-server.mjs");

    writeFileSync(
      serverPath,
      [
        'import { createInterface } from "node:readline";',
        'createInterface({ input: process.stdin }).on("line", (line) => {',
        "  const message = JSON.parse(line);",
        "  if (message.id === undefined) return;",
        '  const result = message.method === "initialize"',
        '    ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "students", version: "1.0.0" } }',
        '    : message.method === "tools/list"',
        '      ? { tools: [{ name: "find_student", description: "Finds a student by their id.", inputSchema: { type: "object" } }] }',
        '      : { content: [{ type: "text", text: "student " + message.params.arguments.id + " is Hassan, at " + process.env.STUDENTS_SCHOOL + ", for the " + process.argv[2] + " term" }] };',
        '  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");',
        "});",
      ].join("\n"),
    );

    const brain = createScriptedBrain(['ACTION: find_student: {"id":1}', "FINAL: done"]);

    const agent = new StandardAgent()
      .onBrain(brain.generate)
      .mcpProcess(process.execPath, [serverPath, "fall"], { env: { STUDENTS_SCHOOL: "Redmond High" } });

    // when
    await agent.processPrompt(createRandomString());

    // then — the process's catalog was read, its tool called, and the answer reached the brain
    expect(brain.calls[1]?.userPrompt).toContain("student 1 is Hassan, at Redmond High, for the fall term");
  });
});
