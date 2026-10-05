import { HttpMcpBroker, type HttpMcpBrokerOptions } from "./HttpMcpBroker.js";

// A protocol server in a fetch: every request the broker puts on the wire is recorded as
// primitives, and the script answers it, so a test says what crossed the wire without a server.

export interface RecordedMcpRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Record<string, unknown>;
  readonly signal: AbortSignal | null;
}

export interface HttpMcpBrokerTestContext {
  readonly requests: RecordedMcpRequest[];
  readonly mcpBroker: HttpMcpBroker;
}

export const ENDPOINT_URL = "https://mcp.example.test/";

export function createHttpMcpBrokerTests(
  respond: (request: RecordedMcpRequest) => Response | Promise<Response>,
  options: HttpMcpBrokerOptions = {},
): HttpMcpBrokerTestContext {
  const requests: RecordedMcpRequest[] = [];

  const fetchResource: typeof fetch = async (input, init) => {
    const request = readRequest(String(input), init ?? {});
    requests.push(request);

    return await respond(request);
  };

  return { requests, mcpBroker: new HttpMcpBroker(ENDPOINT_URL, options, fetchResource) };
}

export function methodOf(request: RecordedMcpRequest): string {
  return String(request.body["method"]);
}

export function jsonReply(result: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

export function errorReply(code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code, message } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export function eventStreamReply(transcript: string): Response {
  return new Response(transcript, { status: 200, headers: { "content-type": "text/event-stream" } });
}

export function acceptedReply(): Response {
  return new Response(null, { status: 202 });
}

export const INITIALIZE_RESULT = {
  protocolVersion: "2025-06-18",
  capabilities: { tools: {} },
  serverInfo: { name: "students", version: "1.0.0" },
};

function readRequest(url: string, init: RequestInit): RecordedMcpRequest {
  const headers: Record<string, string> = {};

  new Headers(init.headers ?? {}).forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });

  return {
    url,
    headers,
    body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
    signal: init.signal ?? null,
  };
}
