import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";
import type { ConversationMessage } from "../../models/brokers/generators/v1/ConversationMessage.js";
import type { GenerationDelta } from "../../models/brokers/generators/v1/GenerationDelta.js";
import type { GenerationResult } from "../../models/brokers/generators/v1/GenerationResult.js";
import type { ModelToolCall } from "../../models/brokers/generators/v1/ModelToolCall.js";
import type { ToolDefinition } from "../../models/brokers/generators/v1/ToolDefinition.js";
import { HttpResponseException } from "../../models/brokers/https/HttpResponseException.js";
import { STANDARD_AGENTS_VERSION } from "../../Version.js";
import type { GeneratorBrokerV1 } from "./GeneratorBrokerV1.js";
import { applyFrame, completeGeneration, createStreamState, readFrames } from "./ServerSentEvents.js";

// The External mode of the native brain (SPEC.md 4.8, 6.2): an OpenAI-compatible chat completion
// carrying tools as schemas. The base URL is the /v1/ root and the broker owns the route, so a
// URL that already names chat/completions would reach it twice and is refused at composition.
//
// A broker forwards and does not decide. What it may not do is send a field the core owns under
// another name, so seed and stop are never mapped here however the resolved inference carries
// them, and the passthrough is applied last but cannot introduce a key the composition stripped.
export class HttpGeneratorBrokerV1 implements GeneratorBrokerV1 {
  public readonly honorsRequest = true;
  protected readonly apiUrl: string;
  protected readonly apiKey: string;
  protected readonly userAgent: string;
  protected readonly fetchResource: typeof fetch;
  private readonly model: string;

  public constructor(
    apiUrl: string,
    apiKey: string,
    model: string,
    userAgent = `standard-agents/${STANDARD_AGENTS_VERSION}`,
    fetchResource: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {
    this.apiUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
    this.apiKey = apiKey;
    this.model = model;
    this.userAgent = userAgent;
    this.fetchResource = fetchResource;
  }

  public async generate(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    const response = await this.fetchResource(`${this.apiUrl}chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": this.userAgent,
      },
      body: JSON.stringify(this.composeBody(messages, tools, inference)),
      ...(signal === undefined ? {} : { signal }),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new HttpResponseException(response.status, body);
    }

    return readGeneration(JSON.parse(body) as ChatCompletionResponse, readHeaders(response));
  }

  // The same turn as an event stream. The socket is this broker's; what the bytes mean belongs to
  // the reader beside it, which is why the wire can be replayed from a transcript without a
  // server standing up.
  public async *generateStream(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ): AsyncGenerator<GenerationDelta> {
    const response = await this.fetchResource(`${this.apiUrl}chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": this.userAgent,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(this.composeBody(messages, tools, inference, true)),
      ...(signal === undefined ? {} : { signal }),
    });

    if (!response.ok) {
      throw new HttpResponseException(response.status, await response.text());
    }

    const state = createStreamState();

    for await (const payload of readFrames(decoded(response))) {
      const delta = applyFrame(state, payload);

      if (delta !== null) {
        yield delta;
      }
    }

    // Raises rather than yielding when the stream never finished, so the last thing a consumer
    // receives is either the whole generation or the reason there is none.
    yield { content: "", narration: "", completed: completeGeneration(state, readHeaders(response)) };
  }

  private composeBody(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    stream = false,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      stream,
      messages: messages.map((message) => wireMessage(message)),
    };

    // Omitted when empty rather than sent as an empty array: a provider that reads the presence of
    // the field as an invitation to call something should not be invited by an empty offer.
    if (tools.length > 0) {
      body["tools"] = tools.map((tool) => wireTool(tool));
      body["tool_choice"] = "auto";
    }

    if (inference !== undefined) {
      body["temperature"] = inference.temperature;
      body["max_tokens"] = inference.maxTokens;
    }

    // The caller's opaque passthrough, already stripped of every key the core owns
    // (SPEC.md 4.13), so this cannot displace the model, the messages or the tools above.
    return { ...body, ...passthrough(inference) };
  }
}

interface WireToolCall {
  readonly id?: string;
  readonly function?: { readonly name?: string; readonly arguments?: string };
}

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string | null;
      readonly narration?: string | null;
      readonly tool_calls?: readonly WireToolCall[];
    };
    readonly finish_reason?: string | null;
  }>;
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

function readGeneration(completion: ChatCompletionResponse, headers: Readonly<Record<string, string>>): GenerationResult {
  const choice = completion.choices?.[0];
  const message = choice?.message;

  return {
    content: message?.content ?? "",
    toolCalls: (message?.tool_calls ?? []).map((call) => readToolCall(call)),

    // Narration is a first-class field beside the content, not a line inside it, so an agent that
    // says what it is doing never has that sentence mistaken for its answer (SPEC.md 6.0).
    narration: message?.narration ?? "",
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
    headers,
    finishReason: choice?.finish_reason ?? "",
  };
}

function readToolCall(call: WireToolCall): ModelToolCall {
  return {
    id: call.id ?? "",
    name: call.function?.name ?? "",
    argumentsJson: call.function?.arguments ?? "",
  };
}

// Every response header, lowercased. The attribution headers ride here when the provider sends
// them, and are never assumed when it does not (PLAN.md 5.1).
function readHeaders(response: Response): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};

  response.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });

  return headers;
}

function wireMessage(message: ConversationMessage): Record<string, unknown> {
  if (message.role === "Tool") {
    return { role: "tool", tool_call_id: message.toolCallId, name: message.name, content: message.content };
  }

  if (message.role === "Assistant" && message.toolCalls.length > 0) {
    return {
      role: "assistant",

      // Null rather than empty: a turn that only called a tool said nothing, and an empty string
      // is a thing said.
      content: message.content.length > 0 ? message.content : null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.argumentsJson },
      })),
    };
  }

  return { role: message.role.toLowerCase(), content: message.content };
}

function wireTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: JSON.parse(tool.parametersJson.trim().length > 0 ? tool.parametersJson : "{}") as unknown,
    },
  };
}

// The response body as text, chunk by chunk as it arrives. A body the runtime did not give is an
// empty stream, which the reader reports as a turn that never finished.
async function* decoded(response: Response): AsyncGenerator<string> {
  if (response.body === null) {
    return;
  }

  const decoder = new TextDecoder();

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    yield decoder.decode(chunk, { stream: true });
  }

  const tail = decoder.decode();

  if (tail.length > 0) {
    yield tail;
  }
}

function passthrough(inference?: ResolvedInference): Record<string, unknown> {
  const json = inference?.providerOptionsJson;

  if (json === undefined || json === null || json.trim().length === 0) {
    return {};
  }

  return JSON.parse(json) as Record<string, unknown>;
}
