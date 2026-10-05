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
const METHOD_NOT_FOUND = -32601;
const FRAME_BOUNDARY = "\n\n";

export class HttpMcpBroker implements McpBroker {
  private readonly url: string;
  private readonly options: HttpMcpBrokerOptions;
  private readonly fetchResource: typeof fetch;
  private requestId = 0;
  private initialization: Promise<void> | null = null;
  private sessionId: string | null = null;
  private protocolVersion: string | null = null;

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

  // The whole catalog, page by page: a catalog read to its first page shows the agent some of the
  // server's tools and gives no sign that the rest exist. A cursor seen twice ends the walk.
  public async listTools(): Promise<readonly McpTool[]> {
    await this.ensureInitialized();

    const tools: McpTool[] = [];
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await this.request("tools/list", cursor === undefined ? undefined : { cursor });
      const pageTools = (page["tools"] ?? []) as readonly Record<string, unknown>[];

      tools.push(...pageTools.map((tool) => ({
        name: String(tool["name"]),
        description: typeof tool["description"] === "string" ? tool["description"] : "",
        inputSchemaJson: tool["inputSchema"] === undefined ? OPEN_OBJECT_SCHEMA : JSON.stringify(tool["inputSchema"]),
      })));

      cursor = typeof page["nextCursor"] === "string" && page["nextCursor"].length > 0 ? page["nextCursor"] : undefined;
    } while (cursor !== undefined && isFirstVisit(visitedCursors, cursor));

    return tools;
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize().catch((error: unknown) => {
      this.initialization = null;
      throw error;
    });

    await this.initialization;
  }

  // A server older than the lifecycle refuses initialize as an unknown method and still answers
  // everything else, so it is used without a session rather than failed.
  private async initialize(): Promise<void> {
    this.sessionId = null;
    this.protocolVersion = null;

    const response = await this.post(this.message("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "standard-agents", version: STANDARD_AGENTS_VERSION },
    }));

    const answer = await readAnswer(response);

    if (answer.error?.code === METHOD_NOT_FOUND) {
      return;
    }

    const result = resultOf(answer);
    this.sessionId = response.headers.get("mcp-session-id");
    this.protocolVersion = typeof result["protocolVersion"] === "string" ? result["protocolVersion"] : null;

    await this.notify("notifications/initialized");
  }

  // A session the server has ended answers 404 (the protocol's word for it): a new one is opened,
  // once, by whichever request found it gone, and the request is sent again on it.
  private async request(method: string, params: Record<string, unknown> | undefined): Promise<Record<string, unknown>> {
    const message = this.message(method, params);
    const sentSessionId = this.sessionId;
    const response = await this.post(message);

    if (response.status === 404 && sentSessionId !== null) {
      await response.text();
      await this.renewSession(sentSessionId);

      return await readResult(await this.post(message));
    }

    return await readResult(response);
  }

  private async renewSession(expiredSessionId: string): Promise<void> {
    if (this.sessionId === expiredSessionId) {
      this.initialization = null;
    }

    await this.ensureInitialized();
  }

  private message(method: string, params: Record<string, unknown> | undefined): Record<string, unknown> {
    this.requestId += 1;

    return {
      jsonrpc: "2.0",
      id: this.requestId,
      method,
      ...(params === undefined ? {} : { params }),
    };
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
      ...(this.sessionId === null ? {} : { "Mcp-Session-Id": this.sessionId }),
      ...(this.protocolVersion === null ? {} : { "MCP-Protocol-Version": this.protocolVersion }),
    };
  }
}

async function readResult(response: Response): Promise<Record<string, unknown>> {
  return resultOf(await readAnswer(response));
}

async function readAnswer(response: Response): Promise<JsonRpcAnswer> {
  if (!response.ok) {
    throw new HttpResponseException(response.status, await response.text(), response.headers.get("retry-after"));
  }

  return isEventStream(response)
    ? await readAnswerFromEventStream(response)
    : (JSON.parse(await response.text()) as JsonRpcAnswer);
}

function resultOf(answer: JsonRpcAnswer): Record<string, unknown> {
  if (answer.error !== undefined) {
    throw new Error(answer.error.message ?? "The MCP server answered with an error.");
  }

  return answer.result ?? {};
}

function isFirstVisit(visitedCursors: Set<string>, cursor: string): boolean {
  if (visitedCursors.has(cursor)) {
    return false;
  }

  visitedCursors.add(cursor);

  return true;
}

function isEventStream(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").startsWith("text/event-stream");
}

// The answer out of an event stream: frames separated by a blank line, a frame's data lines
// joined, and anything that is not the answer (a notification, a progress report, a comment)
// passed over. Read as it arrives and abandoned once answered, because a server may hold the
// stream open after it has said what this request was waiting for.
async function readAnswerFromEventStream(response: Response): Promise<JsonRpcAnswer> {
  const reader = response.body?.getReader();

  if (reader === undefined) {
    throw new Error("The MCP server answered with an empty event stream.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? FRAME_BOUNDARY : decoder.decode(value, { stream: true });
      buffer = buffer.replaceAll("\r\n", "\n");

      let boundary = buffer.indexOf(FRAME_BOUNDARY);

      while (boundary >= 0) {
        const answer = answerInFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + FRAME_BOUNDARY.length);

        if (answer !== null) {
          return answer;
        }

        boundary = buffer.indexOf(FRAME_BOUNDARY);
      }

      if (done) {
        throw new Error("The MCP server closed its event stream without an answer.");
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function answerInFrame(frame: string): JsonRpcAnswer | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n");

  if (data.length === 0) {
    return null;
  }

  const message = JSON.parse(data) as JsonRpcAnswer & { readonly method?: string };
  const isAnswer = message.method === undefined && (message.result !== undefined || message.error !== undefined);

  return isAnswer ? message : null;
}
