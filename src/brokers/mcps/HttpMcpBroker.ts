import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import { HttpResponseException } from "../../models/brokers/https/HttpResponseException.js";
import { STANDARD_AGENTS_VERSION } from "../../Version.js";
import type { McpBroker } from "./McpBroker.js";

// The External mode of remote tools over HTTP (SPEC.md 4.8): the Model Context Protocol's
// Streamable HTTP transport, spoken as the protocol defines it so a server built with any of its
// SDKs answers. The session opens with the lifecycle once, before the first request.

export interface HttpMcpBrokerOptions {
  readonly relativeUrl?: string;
  readonly timeoutMilliseconds?: number;
  readonly bearerToken?: string;
  readonly apiKey?: string;
  readonly apiKeyHeader?: string;
  readonly bearerTokenProvider?: () => Promise<string>;
}

interface JsonRpcAnswer {
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code?: number; readonly message?: string };
}

const LATEST_PROTOCOL_VERSION = "2025-06-18";
const OPEN_OBJECT_SCHEMA = "{}";

export class HttpMcpBroker implements McpBroker {
  private readonly url: string;
  private readonly options: HttpMcpBrokerOptions;
  private readonly fetchResource: typeof fetch;
  private requestId = 0;
  private initialization: Promise<void> | null = null;

  public constructor(
    endpointUrl: string,
    options: HttpMcpBrokerOptions = {},
    fetchResource: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {
    this.url = new URL(options.relativeUrl ?? "", endpointUrl).toString();
    this.options = options;
    this.fetchResource = fetchResource;
  }

  public async call(_name: string, _argumentsJson: string, _signal?: AbortSignal): Promise<string> {
    throw new Error("not implemented");
  }

  public async listTools(): Promise<readonly McpTool[]> {
    await this.ensureInitialized();

    const result = await this.request("tools/list", undefined);
    const tools = (result["tools"] ?? []) as readonly Record<string, unknown>[];

    return tools.map((tool) => ({
      name: String(tool["name"]),
      description: typeof tool["description"] === "string" ? tool["description"] : "",
      inputSchemaJson: tool["inputSchema"] === undefined ? OPEN_OBJECT_SCHEMA : JSON.stringify(tool["inputSchema"]),
    }));
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize().catch((error: unknown) => {
      this.initialization = null;
      throw error;
    });

    await this.initialization;
  }

  private async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "standard-agents", version: STANDARD_AGENTS_VERSION },
    });

    await this.notify("notifications/initialized");
  }

  private async request(method: string, params: Record<string, unknown> | undefined): Promise<Record<string, unknown>> {
    this.requestId += 1;

    const response = await this.post({
      jsonrpc: "2.0",
      id: this.requestId,
      method,
      ...(params === undefined ? {} : { params }),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new HttpResponseException(response.status, body, response.headers.get("retry-after"));
    }

    const answer = JSON.parse(body) as JsonRpcAnswer;

    if (answer.error !== undefined) {
      throw new Error(answer.error.message ?? "The MCP server answered with an error.");
    }

    return answer.result ?? {};
  }

  private async notify(method: string): Promise<void> {
    const response = await this.post({ jsonrpc: "2.0", method });
    await response.text();
  }

  private async post(message: Record<string, unknown>): Promise<Response> {
    return await this.fetchResource(this.url, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(message),
    });
  }

  private async headers(): Promise<Record<string, string>> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
  }
}
