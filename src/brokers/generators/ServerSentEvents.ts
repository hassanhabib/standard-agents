import type { GenerationDelta } from "../../models/brokers/generators/v1/GenerationDelta.js";
import type { GenerationResult } from "../../models/brokers/generators/v1/GenerationResult.js";
import type { ModelToolCall } from "../../models/brokers/generators/v1/ModelToolCall.js";
import { StreamInterruptedException } from "../../models/brokers/generators/v1/StreamInterruptedException.js";

// The server-sent event reader for a streamed generation (PLAN.md 5.1). Pure over text: the
// broker owns the socket and this owns what the bytes mean, which is why it can be read back
// against a recorded transcript without a server.
//
// The wire is line-oriented and forgiving by design. Frames are separated by a blank line, CRLF
// and LF are both tolerated because a proxy may rewrite either, a line beginning with a colon is
// a comment and a keep-alive is exactly that, and `data: [DONE]` is terminal.

const DONE = "[DONE]";

export interface StreamState {
  content: string;
  toolCallsByIndex: Map<number, ModelToolCall>;
  promptTokens: number;
  completionTokens: number;
  finishReason: string;
  terminated: boolean;
}

export function createStreamState(): StreamState {
  return {
    content: "",
    toolCallsByIndex: new Map(),
    promptTokens: 0,
    completionTokens: 0,
    finishReason: "",
    terminated: false,
  };
}

// Frames out of a stream of arbitrary chunks. A chunk boundary can fall anywhere, including the
// middle of a JSON string, so the buffer is what is parsed and a partial frame simply waits.
export async function* readFrames(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = "";

  for await (const chunk of chunks) {
    buffer += chunk;

    for (;;) {
      const boundary = nextBoundary(buffer);

      if (boundary === null) {
        break;
      }

      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      const payload = readPayload(frame);

      if (payload !== null) {
        yield payload;
      }
    }
  }

  // A stream that ends without its blank line still delivered its last frame; the socket closing
  // is the boundary. Whether that stream was terminated is the terminal frame's business, not
  // this one's.
  const payload = readPayload(buffer);

  if (payload !== null) {
    yield payload;
  }
}

// The payload of one frame, or null when the frame carries none: a comment, a keep-alive, an
// event name without data, or the blank remainder after the last boundary. Multiple data lines in
// one frame are joined with a newline, which is what the event-stream format says they mean.
function readPayload(frame: string): string | null {
  const dataLines: string[] = [];

  for (const rawLine of frame.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (line.length === 0 || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  return dataLines.length === 0 ? null : dataLines.join("\n");
}

function nextBoundary(buffer: string): { index: number; length: number } | null {
  const positions = [
    { index: buffer.indexOf("\r\n\r\n"), length: 4 },
    { index: buffer.indexOf("\n\n"), length: 2 },
  ].filter((position) => position.index >= 0);

  if (positions.length === 0) {
    return null;
  }

  return positions.reduce((earliest, position) => (position.index < earliest.index ? position : earliest));
}

interface WireDelta {
  readonly content?: string | null;
  readonly narration?: string | null;
  readonly tool_calls?: ReadonlyArray<{
    readonly index?: number;
    readonly id?: string;
    readonly function?: { readonly name?: string; readonly arguments?: string };
  }>;
}

interface WireFrame {
  readonly choices?: ReadonlyArray<{ readonly delta?: WireDelta; readonly finish_reason?: string | null }>;
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
  readonly error?: { readonly message?: string; readonly code?: string };
}

// One frame applied to the state, and the piece it carried for a consumer to voice. Null when the
// frame moved the state without producing anything to say, which is what an opening role frame,
// a usage frame and the terminal frame all do.
export function applyFrame(state: StreamState, payload: string): GenerationDelta | null {
  if (payload === DONE) {
    state.terminated = true;

    return null;
  }

  const frame = JSON.parse(payload) as WireFrame;

  // An error frame before the terminal one is a failed turn, whatever arrived before it. It is
  // raised rather than returned so no caller can mistake a half-written answer for an answer.
  if (frame.error !== undefined) {
    throw new StreamInterruptedException("failed", frame.error.message ?? "the provider sent an error frame");
  }

  if (frame.usage !== undefined) {
    state.promptTokens = frame.usage.prompt_tokens ?? state.promptTokens;
    state.completionTokens = frame.usage.completion_tokens ?? state.completionTokens;
  }

  const choice = frame.choices?.[0];

  if (choice === undefined) {
    return null;
  }

  if (typeof choice.finish_reason === "string" && choice.finish_reason.length > 0) {
    state.finishReason = choice.finish_reason;
  }

  const delta = choice.delta;

  if (delta === undefined) {
    return null;
  }

  accumulateToolCalls(state, delta);

  const content = delta.content ?? "";
  const narration = delta.narration ?? "";
  state.content += content;

  return content.length === 0 && narration.length === 0 ? null : { content, narration, completed: null };
}

// Accumulated by index, because a provider may split one call's arguments across frames and the
// index is the only thing that says which call a fragment belongs to. Some providers send one complete
// delta, and this reads that as the degenerate case of the same rule.
function accumulateToolCalls(state: StreamState, delta: WireDelta): void {
  for (const [position, call] of (delta.tool_calls ?? []).entries()) {
    const index = call.index ?? position;
    const existing = state.toolCallsByIndex.get(index);

    state.toolCallsByIndex.set(index, {
      id: call.id ?? existing?.id ?? "",
      name: call.function?.name ?? existing?.name ?? "",
      argumentsJson: `${existing?.argumentsJson ?? ""}${call.function?.arguments ?? ""}`,
    });
  }
}

// The generation the stream delivered. A stream that never carried its terminal frame is a
// truncated turn and raises here, because the alternative is handing back everything that did
// arrive as though the model had finished saying it.
export function completeGeneration(state: StreamState, headers: Readonly<Record<string, string>>): GenerationResult {
  if (!state.terminated) {
    throw new StreamInterruptedException("truncated", "the stream closed before the provider finished the turn");
  }

  return {
    content: state.content,
    toolCalls: [...state.toolCallsByIndex.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, call]) => call),
    narration: "",
    promptTokens: state.promptTokens,
    completionTokens: state.completionTokens,
    headers,
    finishReason: state.finishReason,
  };
}
