import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";
import type { ConversationMessage } from "../../models/brokers/generators/v1/ConversationMessage.js";
import type { GenerationDelta } from "../../models/brokers/generators/v1/GenerationDelta.js";
import type { GenerationResult } from "../../models/brokers/generators/v1/GenerationResult.js";
import type { ToolDefinition } from "../../models/brokers/generators/v1/ToolDefinition.js";
import type { GeneratorBrokerV1 } from "./GeneratorBrokerV1.js";

// The Custom mode of the native brain (SPEC.md 4.8), and the seam the conformance runner scripts.
// honorsRequest is false by default because a function given no inference cannot have applied one;
// a host whose function does read it says so, and the degradation notice stops.
export class FunctionGeneratorBrokerV1 implements GeneratorBrokerV1 {
  public readonly honorsRequest: boolean;
  private readonly generateResult: (
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ) => Promise<GenerationResult>;

  public constructor(
    generateResult: (
      messages: readonly ConversationMessage[],
      tools: readonly ToolDefinition[],
      inference?: ResolvedInference,
      signal?: AbortSignal,
    ) => Promise<GenerationResult>,
    honorsRequest = false,
  ) {
    this.generateResult = generateResult;
    this.honorsRequest = honorsRequest;
  }

  public async generate(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    return await this.generateResult(messages, tools, inference, signal);
  }

  // A function has nothing to stream, so the whole generation arrives as the one delta that
  // carries it. The seam is honoured rather than refused, which is what lets a scripted brain
  // drive the streamed door and the batched one through the same loop.
  public async *generateStream(
    messages: readonly ConversationMessage[],
    tools: readonly ToolDefinition[],
    inference?: ResolvedInference,
    signal?: AbortSignal,
  ): AsyncGenerator<GenerationDelta> {
    const completed = await this.generateResult(messages, tools, inference, signal);

    if (completed.narration.length > 0) {
      yield { content: "", narration: completed.narration, completed: null };
    }

    if (completed.content.length > 0) {
      yield { content: completed.content, narration: "", completed: null };
    }

    yield { content: "", narration: "", completed };
  }
}

// The empty generation, so a host writing a function or a test writing a double states only what
// it means to state. Every member is present; nothing below reads an absent field.
export function createGenerationResult(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    content: "",
    toolCalls: [],
    narration: "",
    promptTokens: 0,
    completionTokens: 0,
    headers: {},
    finishReason: "stop",
    ...overrides,
  };
}
