import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";
import type { ConversationMessage } from "../../models/brokers/generators/v1/ConversationMessage.js";
import type { GenerationDelta } from "../../models/brokers/generators/v1/GenerationDelta.js";
import type { GenerationResult } from "../../models/brokers/generators/v1/GenerationResult.js";
import type { ToolDefinition } from "../../models/brokers/generators/v1/ToolDefinition.js";

// The Decision nature's brain, V1: the native protocol (SPEC.md 6.2). Where V0 passes one system
// prompt and one user prompt and reads a line of text back, V1 passes the conversation as
// messages and the tools as schemas, and reads back a structured choice: prose, or a call.
//
// The two live side by side rather than one replacing the other. A small local model reads the
// text protocol better than it reads a tool schema, and the deployment picks. honorsRequest says
// whether the broker applies the resolved inference or ignores it, so the foundation can announce
// the degradation rather than let a caller believe a value took effect (SPEC.md 4.13).
export interface GeneratorBrokerV1 {
  readonly honorsRequest: boolean;

  generate(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ): Promise<GenerationResult>;

  // The same turn, delivered as it arrives. The last delta carries the whole generation, so a
  // caller that only wants the answer awaits the end of the sequence and reads it there, and one
  // that voices narration live reads each delta's own piece. A turn that never finished raises
  // rather than yielding a last delta, because a truncated stream is not a short answer.
  generateStream(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ): AsyncIterable<GenerationDelta>;
}
