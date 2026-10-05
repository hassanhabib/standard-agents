import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import { STANDARD_AGENTS_VERSION } from "../../Version.js";
import type { McpBroker } from "./McpBroker.js";

// The External mode of remote tools over a process's standard streams (SPEC.md 4.8): the Model
// Context Protocol's stdio transport, one JSON-RPC message per line, the lifecycle first.

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

  public async next(): Promise<string | null> {
    const line = this.lines.shift();

    if (line !== undefined) {
      return line;
    }

    if (this.isEnded) {
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

interface Connection {
  readonly lines: LineQueue;
  readonly input: Writable;
}

export class StdioMcpBroker implements McpBroker {
  private readonly server: StdioMcpServer;
  private connection: Connection | null = null;
  private requestId = 0;

  public constructor(server: StdioMcpServer, _timeoutMilliseconds = 30_000) {
    this.server = server;
  }

  // As over HTTP: the arguments travel as the object the model wrote, and nothing the tool
  // returns is dropped.
  public async call(name: string, argumentsJson: string, _signal?: AbortSignal): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: JSON.parse(argumentsJson) as unknown });
    const content = (result["content"] ?? []) as readonly JsonObject[];
    const text = content.map((block) => textOf(block)).join("");

    return text.length === 0 && result["structuredContent"] !== undefined ? JSON.stringify(result["structuredContent"]) : text;
  }

  // The whole catalog, page by page, as the HTTP broker reads it.
  public async listTools(): Promise<readonly McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.request("tools/list", cursor === undefined ? undefined : { cursor });
      const pageTools = (page["tools"] ?? []) as readonly JsonObject[];

      tools.push(...pageTools.map((tool) => ({
        name: String(tool["name"]),
        description: typeof tool["description"] === "string" ? tool["description"] : "",
        inputSchemaJson: tool["inputSchema"] === undefined ? OPEN_OBJECT_SCHEMA : JSON.stringify(tool["inputSchema"]),
      })));

      cursor = typeof page["nextCursor"] === "string" && page["nextCursor"].length > 0 ? page["nextCursor"] : undefined;
    } while (cursor !== undefined);

    return tools;
  }

  private async request(method: string, params: JsonObject | undefined): Promise<JsonObject> {
    const connection = await this.connect();
    const answer = await this.exchange(connection, method, params);
    const error = answer["error"] as { message?: string } | undefined;

    if (error !== undefined) {
      throw new Error(error.message ?? "The MCP server answered with an error.");
    }

    return (answer["result"] ?? {}) as JsonObject;
  }

  private async connect(): Promise<Connection> {
    if (this.connection !== null) {
      return this.connection;
    }

    const streams = this.server as StdioMcpStreams;
    const connection: Connection = { lines: new LineQueue(streams.output), input: streams.input };

    await this.exchange(connection, "initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "standard-agents", version: STANDARD_AGENTS_VERSION },
    });

    write(connection, { jsonrpc: "2.0", method: "notifications/initialized" });
    this.connection = connection;

    return connection;
  }

  private async exchange(connection: Connection, method: string, params: JsonObject | undefined): Promise<JsonObject> {
    this.requestId += 1;
    const id = this.requestId;

    write(connection, { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });

    for (;;) {
      const line = await connection.lines.next();

      if (line === null) {
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
