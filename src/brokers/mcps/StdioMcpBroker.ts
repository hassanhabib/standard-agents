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

  public async call(_name: string, _argumentsJson: string, _signal?: AbortSignal): Promise<string> {
    throw new Error("not implemented");
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

      const message = JSON.parse(line) as JsonObject;

      if (message["id"] === id) {
        return message;
      }
    }
  }
}

function write(connection: Connection, message: JsonObject): void {
  connection.input.write(`${JSON.stringify(message)}\n`);
}
