import type { Readable, Writable } from "node:stream";

import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import type { McpBroker } from "./McpBroker.js";

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

export class StdioMcpBroker implements McpBroker {
  public constructor(_server: StdioMcpServer, _timeoutMilliseconds = 30_000) {}

  public async call(_name: string, _argumentsJson: string, _signal?: AbortSignal): Promise<string> {
    throw new Error("not implemented");
  }

  public async listTools(): Promise<readonly McpTool[]> {
    throw new Error("not implemented");
  }
}
