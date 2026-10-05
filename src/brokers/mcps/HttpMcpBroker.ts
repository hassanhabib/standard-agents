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
const DEFAULT_TIMEOUT_MILLISECONDS = 30_000;
const DEFAULT_API_KEY_HEADER = "X-Api-Key";

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

  // The arguments travel as the object the model wrote. Nothing the tool returns is dropped: what
  // the brain cannot read as text reaches it as a marker of what came back, and a result carried
  // only as structured content reaches it as that JSON.
  public async call(name: string, argumentsJson: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();

    const result = await this.request("tools/call", { name, arguments: JSON.parse(argumentsJson) as unknown }, signal);
    const content = (result["content"] ?? []) as readonly Record<string, unknown>[];
    const text = content.map((block) => textOf(block)).join("");

    return text.length === 0 && result["structuredContent"] !== undefined ? JSON.stringify(result["structuredContent"]) : text;
  }

  // The whole catalog, page by page: a catalog read to its first page shows the agent some of the
  // server's tools and gives no sign that the rest exist. A cursor seen twice ends the walk.
  public async listTools(): Promise<readonly McpTool[]> {
    await this.ensureInitialized();

    const tools: McpTool[] = [];
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await this.request("tools/list", cursor === undefined ? undefined : { cursor }, undefined);
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

    const initializeMessage = this.message("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "standard-agents", version: STANDARD_AGENTS_VERSION },
    });

    await this.withDeadline(undefined, async (deadline) => {
      const response = await this.post(initializeMessage, deadline);
      const answer = await readAnswer(response);

      if (answer.error?.code === METHOD_NOT_FOUND) {
        return;
      }

      const result = resultOf(answer);
      this.sessionId = response.headers.get("mcp-session-id");
      this.protocolVersion = typeof result["protocolVersion"] === "string" ? result["protocolVersion"] : null;

      const notification = await this.post({ jsonrpc: "2.0", method: "notifications/initialized" }, deadline);
      await notification.text();
    });
  }

  // A session the server has ended answers 404 (the protocol's word for it): a new one is opened,
  // once, by whichever request found it gone, and the request is sent again on it.
  private async request(
    method: string,
    params: Record<string, unknown> | undefined,
    signal: AbortSignal | undefined,
  ): Promise<Record<string, unknown>> {
    const message = this.message(method, params);
    const sentSessionId = this.sessionId;

    const answer = await this.withDeadline(signal, async (deadline) => {
      const response = await this.post(message, deadline);

      if (response.status === 404 && sentSessionId !== null) {
        await response.text();

        return null;
      }

      return await readAnswer(response);
    });

    if (answer !== null) {
      return resultOf(answer);
    }

    await this.renewSession(sentSessionId);

    return resultOf(await this.withDeadline(signal, async (deadline) => await readAnswer(await this.post(message, deadline))));
  }

  private async renewSession(expiredSessionId: string | null): Promise<void> {
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

  // One exchange, bounded twice: by the caller's Stop, and by the timeout, so a server that never
  // answers cannot hold a run forever. The bound covers reading the answer, not only sending.
  private async withDeadline<T>(signal: AbortSignal | undefined, exchange: (deadline: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeoutMilliseconds = this.options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;

    const timer = setTimeout(() => {
      controller.abort(new Error(`The MCP server did not answer within ${String(timeoutMilliseconds)} ms.`));
    }, timeoutMilliseconds);

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

  private async post(message: Record<string, unknown>, deadline: AbortSignal): Promise<Response> {
    deadline.throwIfAborted();

    return await this.fetchResource(this.url, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(message),
      signal: deadline,
    });
  }

  // The credentials ride every request. A token provider is asked each time, because the access
  // token from composition time expires, and it wins over a static token.
  private async headers(): Promise<Record<string, string>> {
    const bearerToken = this.options.bearerTokenProvider === undefined
      ? this.options.bearerToken
      : await this.options.bearerTokenProvider();

    return {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(this.sessionId === null ? {} : { "Mcp-Session-Id": this.sessionId }),
      ...(this.protocolVersion === null ? {} : { "MCP-Protocol-Version": this.protocolVersion }),
      ...(this.options.apiKey === undefined ? {} : { [this.options.apiKeyHeader ?? DEFAULT_API_KEY_HEADER]: this.options.apiKey }),
      ...(bearerToken === undefined || bearerToken.length === 0 ? {} : { Authorization: `Bearer ${bearerToken}` }),
    };
  }
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

function textOf(block: Record<string, unknown>): string {
  const resource = block["resource"] as Record<string, unknown> | undefined;

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
