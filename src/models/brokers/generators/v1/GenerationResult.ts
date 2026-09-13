import type { ModelToolCall } from "./ModelToolCall.js";

// What a native generation returned (SPEC.md 6.2, 6.0 narration). headers is additive over the
// reference and carries the response headers the broker saw, so a foundation above it can read
// attribution without the broker deciding anything about it.
export interface GenerationResult {
  readonly content: string;
  readonly toolCalls: readonly ModelToolCall[];
  readonly narration: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly headers: Readonly<Record<string, string>>;

  // Why the model stopped, as the wire said it: stop, tool_calls, length, content_filter, or
  // empty when the provider named none. The tier above maps it; the broker only reports it,
  // because a refusal that arrives as an empty answer is not an answer.
  readonly finishReason: string;
}

export function hasToolCalls(generation: GenerationResult): boolean {
  return generation.toolCalls.length > 0;
}
