import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import type { McpBroker } from "./McpBroker.js";

export interface HttpMcpBrokerOptions {
  readonly relativeUrl?: string;
  readonly timeoutMilliseconds?: number;
  readonly bearerToken?: string;
  readonly apiKey?: string;
  readonly apiKeyHeader?: string;
  readonly bearerTokenProvider?: () => Promise<string>;
}

export class HttpMcpBroker implements McpBroker {
  public constructor(
    _endpointUrl: string,
    _options: HttpMcpBrokerOptions = {},
    _fetchResource: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  public async call(_name: string, _argumentsJson: string, _signal?: AbortSignal): Promise<string> {
    throw new Error("not implemented");
  }

  public async listTools(): Promise<readonly McpTool[]> {
    throw new Error("not implemented");
  }
}
