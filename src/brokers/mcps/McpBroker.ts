import type { McpTool } from "../../models/brokers/mcps/McpTool.js";

// The Direction nature's external tools (SPEC.md 4.8 External): remote servers speaking the Model
// Context Protocol. The signal reaches a call in flight so Stop is not a turn-boundary promise.
export interface McpBroker {
  call(name: string, argumentsJson: string, signal?: AbortSignal): Promise<string>;
  listTools(): Promise<readonly McpTool[]>;
}
