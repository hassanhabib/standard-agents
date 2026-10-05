import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, extname, join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import { STANDARD_AGENTS_VERSION } from "../../Version.js";
import type { McpBroker } from "./McpBroker.js";

// The External mode of remote tools over a process's standard streams (SPEC.md 4.8): the Model
// Context Protocol's stdio transport, one JSON-RPC message per line, the lifecycle first. The
// server is either streams the host already holds, or a command this broker starts itself.

export interface StdioMcpStreams {
  readonly output: Readable;
  readonly input: Writable;
}

export interface StdioMcpCommand {
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly cwd?: string;
}

export type StdioMcpServer = StdioMcpStreams | StdioMcpCommand;

type JsonObject = Record<string, unknown>;

const LATEST_PROTOCOL_VERSION = "2025-06-18";
const OPEN_OBJECT_SCHEMA = "{}";
const METHOD_NOT_FOUND = -32601;
const DEFAULT_TIMEOUT_MILLISECONDS = 30_000;

// Every server process this module started, stopped when the host exits: a process server is the
// host's to end, and an orphan keeps running after nobody can reach it.
const startedProcesses = new Set<ChildProcess>();

process.once("exit", () => {
  for (const child of startedProcesses) {
    child.kill();
  }
});

// The server's output as a queue of lines. A reader waits for the next line; a line nobody is
// waiting for waits for its reader. Nothing is lost between reads, which is what lets a reader
// that gave up leave the next answer for the next reader.
class LineQueue {
  private readonly lines: string[] = [];
  private readonly waiters: ((line: string | null) => void)[] = [];
  private isEnded = false;

  public constructor(output: Readable) {
    const reader = createInterface({ input: output });

    reader.on("line", (line) => {
      const waiter = this.waiters.shift();

      if (waiter === undefined) {
        this.lines.push(line);
      } else {
        waiter(line);
      }
    });

    reader.on("close", () => {
      this.isEnded = true;

      for (const waiter of this.waiters.splice(0)) {
        waiter(null);
      }
    });
  }

  public async next(deadline: AbortSignal): Promise<string | null> {
    deadline.throwIfAborted();

    const line = this.lines.shift();

    if (line !== undefined) {
      return line;
    }

    if (this.isEnded) {
      return null;
    }

    return await new Promise<string | null>((resolve, reject) => {
      const waiter = (nextLine: string | null): void => {
        deadline.removeEventListener("abort", giveUp);
        resolve(nextLine);
      };

      const giveUp = (): void => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(deadline.reason as Error);
      };

      this.waiters.push(waiter);
      deadline.addEventListener("abort", giveUp, { once: true });
    });
  }
}

interface Connection {
  readonly lines: LineQueue;
  readonly input: Writable;
}

export class StdioMcpBroker implements McpBroker {
  private readonly server: StdioMcpServer;
  private readonly timeoutMilliseconds: number;
  private connection: Promise<Connection> | null = null;
  private exchanges: Promise<unknown> = Promise.resolve();
  private requestId = 0;

  public constructor(server: StdioMcpServer, timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS) {
    this.server = server;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  // As over HTTP: the arguments travel as the object the model wrote, and nothing the tool
  // returns is dropped.
  public async call(name: string, argumentsJson: string, signal?: AbortSignal): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: JSON.parse(argumentsJson) as unknown }, signal);
    const content = (result["content"] ?? []) as readonly JsonObject[];
    const text = content.map((block) => textOf(block)).join("");

    return text.length === 0 && result["structuredContent"] !== undefined ? JSON.stringify(result["structuredContent"]) : text;
  }

  // The whole catalog, page by page, as the HTTP broker reads it. A cursor seen twice ends the walk.
  public async listTools(): Promise<readonly McpTool[]> {
    const tools: McpTool[] = [];
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await this.request("tools/list", cursor === undefined ? undefined : { cursor }, undefined);
      const pageTools = (page["tools"] ?? []) as readonly JsonObject[];

      tools.push(...pageTools.map((tool) => ({
        name: String(tool["name"]),
        description: typeof tool["description"] === "string" ? tool["description"] : "",
        inputSchemaJson: tool["inputSchema"] === undefined ? OPEN_OBJECT_SCHEMA : JSON.stringify(tool["inputSchema"]),
      })));

      cursor = typeof page["nextCursor"] === "string" && page["nextCursor"].length > 0 ? page["nextCursor"] : undefined;
    } while (cursor !== undefined && isFirstVisit(visitedCursors, cursor));

    return tools;
  }

  private async request(method: string, params: JsonObject | undefined, signal: AbortSignal | undefined): Promise<JsonObject> {
    const connection = await this.connect();
    const answer = await this.serialized(async () =>
      await this.withDeadline(signal, (deadline) => this.exchange(connection, method, params, deadline)));
    const error = answer["error"] as { message?: string } | undefined;

    if (error !== undefined) {
      throw new Error(error.message ?? "The MCP server answered with an error.");
    }

    return (answer["result"] ?? {}) as JsonObject;
  }

  // One connection at a time, opened with the lifecycle; a connection whose output ended is
  // dropped, so the next request starts the server again.
  private async connect(): Promise<Connection> {
    this.connection ??= this.open().catch((error: unknown) => {
      this.connection = null;
      throw error;
    });

    return await this.connection;
  }

  private async open(): Promise<Connection> {
    const connection = "command" in this.server ? startServerProcess(this.server) : streamsOf(this.server);

    const answer = await this.serialized(async () => await this.withDeadline(undefined, (deadline) =>
      this.exchange(connection, "initialize", {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "standard-agents", version: STANDARD_AGENTS_VERSION },
      }, deadline)));

    const error = answer["error"] as { code?: number; message?: string } | undefined;

    // A server older than the lifecycle refuses initialize as an unknown method and still answers
    // everything else, so it is used without a session rather than failed.
    if (error !== undefined && error.code !== METHOD_NOT_FOUND) {
      throw new Error(error.message ?? "The MCP server refused to initialize.");
    }

    if (error === undefined) {
      write(connection, { jsonrpc: "2.0", method: "notifications/initialized" });
    }

    return connection;
  }

  // One exchange at a time on the one pair of streams, so an answer is never read by the request
  // it does not belong to.
  private async serialized<T>(exchange: () => Promise<T>): Promise<T> {
    const turn = this.exchanges.then(exchange, exchange);
    this.exchanges = turn.catch(() => undefined);

    return await turn;
  }

  // One exchange, bounded twice: by the caller's Stop, and by the timeout, so a server that never
  // answers cannot hold a run forever.
  private async withDeadline<T>(signal: AbortSignal | undefined, exchange: (deadline: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort(new Error(`The MCP server did not answer within ${String(this.timeoutMilliseconds)} ms.`));
    }, this.timeoutMilliseconds);

    const stop = (): void => {
      controller.abort(signal?.reason);
    };

    if (signal?.aborted === true) {
      stop();
    }

    signal?.addEventListener("abort", stop, { once: true });

    try {
      return await exchange(controller.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    }
  }

  private async exchange(connection: Connection, method: string, params: JsonObject | undefined, deadline: AbortSignal): Promise<JsonObject> {
    deadline.throwIfAborted();

    this.requestId += 1;
    const id = this.requestId;

    write(connection, { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });

    for (;;) {
      const line = await connection.lines.next(deadline);

      if (line === null) {
        this.connection = null;

        throw new Error("The MCP server ended its output before answering.");
      }

      // A line that is not a message (a server logging to the wrong stream), a notification, and
      // the server's own requests are not this request's answer, even when an id collides.
      const message = toMessage(line);

      if (message !== null && message["method"] !== undefined) {
        answerServer(connection, message);
      } else if (message !== null && message["id"] === id) {
        return message;
      }
    }
  }
}

function streamsOf(server: StdioMcpStreams): Connection {
  return { lines: new LineQueue(server.output), input: server.input };
}

// The server started as a process: its error stream drained so a chatty server never blocks, its
// pipes released so a finished host is free to exit, and the process stopped when the host exits.
// On Windows a launcher script (npx.cmd, a .bat) only starts through the shell, every argument
// quoted, because Node refuses to start one directly.
function startServerProcess(server: StdioMcpCommand): Connection {
  const command = resolveCommand(server.command);
  const throughShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const args = server.args ?? [];

  const child = spawn(throughShell ? quoteForShell(command) : command, throughShell ? args.map(quoteForShell) : [...args], {
    env: { ...process.env, ...server.env },
    cwd: server.cwd,
    shell: throughShell,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const output = child.stdout;
  const input = child.stdin;

  if (output === null || input === null) {
    throw new Error(`The MCP server '${server.command}' did not start with standard streams.`);
  }

  startedProcesses.add(child);
  child.once("exit", () => startedProcesses.delete(child));
  child.once("error", () => output.destroy());
  child.stderr?.resume();
  input.on("error", () => undefined);

  for (const stream of [child.stdin, child.stdout, child.stderr]) {
    (stream as { unref?: () => void } | null)?.unref?.();
  }

  child.unref();

  return { lines: new LineQueue(output), input };
}

// A bare command resolves the way a shell would resolve it: through PATH, and on Windows through
// PATHEXT, so "npx" finds npx.cmd.
function resolveCommand(command: string): string {
  if (process.platform !== "win32" || extname(command) !== "") {
    return command;
  }

  const directories = (process.env["PATH"] ?? "").split(delimiter).filter((directory) => directory.length > 0);
  const extensions = (process.env["PATHEXT"] ?? ".EXE;.CMD;.BAT").split(";").filter((extension) => extension.length > 0);

  const candidates = directories.flatMap((directory) => extensions.map((extension) => join(directory, command + extension)));

  return candidates.find((candidate) => existsSync(candidate)) ?? command;
}

function quoteForShell(argument: string): string {
  return `"${argument.replaceAll('"', '""')}"`;
}

function isFirstVisit(visitedCursors: Set<string>, cursor: string): boolean {
  if (visitedCursors.has(cursor)) {
    return false;
  }

  visitedCursors.add(cursor);

  return true;
}

function write(connection: Connection, message: JsonObject): void {
  connection.input.write(`${JSON.stringify(message)}\n`);
}

function toMessage(line: string): JsonObject | null {
  try {
    const message = JSON.parse(line) as unknown;

    return typeof message === "object" && message !== null && !Array.isArray(message) ? (message as JsonObject) : null;
  } catch {
    return null;
  }
}

// The server's own requests are answered so it is never left waiting: a liveness ping with an
// empty result, anything else as a method this client does not offer. A notification needs none.
function answerServer(connection: Connection, serverMessage: JsonObject): void {
  if (serverMessage["id"] === undefined) {
    return;
  }

  const answer = serverMessage["method"] === "ping"
    ? { jsonrpc: "2.0", id: serverMessage["id"], result: {} }
    : { jsonrpc: "2.0", id: serverMessage["id"], error: { code: METHOD_NOT_FOUND, message: "The client does not offer this method." } };

  write(connection, answer);
}

function textOf(block: JsonObject): string {
  const resource = block["resource"] as JsonObject | undefined;

  switch (block["type"]) {
    case "text":
      return typeof block["text"] === "string" ? block["text"] : "";
    case "resource":
      return typeof resource?.["text"] === "string" ? resource["text"] : `[resource ${String(resource?.["uri"])}]`;
    case "resource_link":
      return `[resource_link ${String(block["name"])}: ${String(block["uri"])}]`;
    default:
      return `[${String(block["type"])} ${String(block["mimeType"])}]`;
  }
}
