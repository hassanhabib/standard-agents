import { HttpGeneratorBrokerV1 } from "./HttpGeneratorBrokerV1.js";

// The wire the broker actually put on the socket, read back as primitives so a test can say what
// was posted without standing a server up.
export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Record<string, unknown>;
}

export interface HttpGeneratorBrokerV1TestContext {
  readonly requests: RecordedRequest[];
  readonly generatorBroker: HttpGeneratorBrokerV1;
}

export const API_URL = "https://api.example.test/v1/";
export const API_KEY = "key_a_test_key";
export const MODEL = "example-model";
export const USER_AGENT = "tests/1.0";

export function createHttpGeneratorBrokerV1Tests(respondWith: () => Response): HttpGeneratorBrokerV1TestContext {
  const requests: RecordedRequest[] = [];

  const fetchResource: typeof fetch = async (input, init) => {
    requests.push(readRequest(String(input), init ?? {}));

    return respondWith();
  };

  return {
    requests,
    generatorBroker: new HttpGeneratorBrokerV1(API_URL, API_KEY, MODEL, USER_AGENT, fetchResource),
  };
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "x-example-decider": "peer-7" },
  });
}

export function streamResponse(transcript: string, status = 200): Response {
  return new Response(transcript, {
    status,
    headers: { "content-type": "text/event-stream", "x-example-decider": "peer-7" },
  });
}

function readRequest(url: string, init: RequestInit): RecordedRequest {
  const headers: Record<string, string> = {};

  new Headers(init.headers ?? {}).forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });

  return {
    url,
    method: init.method ?? "GET",
    headers,
    body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
  };
}
