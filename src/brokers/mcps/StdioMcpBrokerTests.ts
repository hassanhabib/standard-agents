import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";

// A protocol server on the other end of a process's standard streams, in memory: every line the
// broker writes is recorded, and the script answers it with nothing (a notification), or with
// several lines (a server that speaks before it answers).

export interface ScriptedStdioServer {
  readonly output: PassThrough;
  readonly input: PassThrough;
  readonly lines: Record<string, unknown>[];
  end(): void;
}

export const INITIALIZE_RESULT = {
  protocolVersion: "2025-06-18",
  capabilities: { tools: {} },
  serverInfo: { name: "students", version: "1.0.0" },
};

export function createScriptedStdioServer(respond: (message: Record<string, unknown>) => readonly string[]): ScriptedStdioServer {
  const output = new PassThrough();
  const input = new PassThrough();
  const lines: Record<string, unknown>[] = [];

  createInterface({ input }).on("line", (line) => {
    const message = JSON.parse(line) as Record<string, unknown>;
    lines.push(message);

    for (const answer of respond(message)) {
      output.write(`${answer}\n`);
    }
  });

  return { output, input, lines, end: () => output.end() };
}

export function answer(message: Record<string, unknown>, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id: message["id"], result });
}

export function methodOf(message: Record<string, unknown>): string {
  return String(message["method"]);
}
