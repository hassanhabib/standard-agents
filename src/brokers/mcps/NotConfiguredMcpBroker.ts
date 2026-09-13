import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import type { McpBroker } from "./McpBroker.js";

// No remote servers configured: the catalog is empty and a call names what is missing.
export class NotConfiguredMcpBroker implements McpBroker {
  public async call(name: string, _argumentsJson: string, _signal?: AbortSignal): Promise<string> {
    return `[external '${name}' not configured]`;
  }

  public async listTools(): Promise<readonly McpTool[]> {
    return [];
  }
}
