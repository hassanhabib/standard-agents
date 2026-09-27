import type { GenerationResult } from "../../../../models/brokers/generators/v1/GenerationResult.js";
import type { ToolDefinition } from "../../../../models/brokers/generators/v1/ToolDefinition.js";
import { createNativeAsk, type NativeAsk } from "../../../../models/foundations/brains/NativeAsk.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import type { AgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";

// The native protocol's half of this region (SPEC.md 6.2). The text protocol reads a line and
// decides what it meant; this reads a structure and decides the same thing. What differs is only
// where the intent was written down, which is why both end in one context the tier above reads
// without knowing which protocol produced it.

const RETURN_RESPONSE_DIRECTION = "ReturnResponse";
const RESPOND_INTENT = "Respond";
const REFUSE_DIRECTION = "Refuse";
const CONTENT_FILTER = "content_filter";
const FILTERED_MESSAGE = "I'm not able to help with that.";

export function buildAsk(context: AgentContext, toolDefinitions: readonly ToolDefinition[]): NativeAsk {
  return createNativeAsk(context.prompt, {
    systemPrompt: context.systemPrompt,
    history: context.history,
    exchanges: context.toolExchanges,
    observations: context.observations,
    tools: offeredTools(context, toolDefinitions),
    inference: context.inference,
  });
}

// What this run may be told about: the composition's advertised tools, narrowed by the run's
// offering when selection made one, plus the caller's own vocabulary. The same opt-in the text
// catalog applies, applied to the schemas, so a model told about a tool on one protocol is told
// about it on the other (SPEC.md 6.1, 4.15).
function offeredTools(context: AgentContext, toolDefinitions: readonly ToolDefinition[]): readonly ToolDefinition[] {
  const offered = AgentRun.current()?.offeredTools ?? null;

  const configured = offered === null
    ? toolDefinitions
    : toolDefinitions.filter((tool) => offered.some((name) => name.toLowerCase() === tool.name.toLowerCase()));

  return [...configured, ...remoteTools(toolDefinitions, offered), ...(context.inference?.callerTools ?? [])];
}

// The servers' tools as the Brain sees them offered (SPEC.md 4.8 External). Discovered at the top
// of the run and carried on it, so this tier reads them where it already reads the run's offering
// rather than growing a dependency on the Data nature two tiers away.
//
// They are not decoration on the text catalog. A model speaking natively never reads that catalog:
// it is handed schemas, and a tool that is not among them does not exist to it.
//
// A description is the advertisement opt-in, the same one the catalog applies (SPEC.md 6.1): an
// undescribed tool stays callable and unlisted, because a model handed a schema with nothing to
// read will call it to find out what it does.
//
// A name a configured tool already owns stays the configured tool's. A call carries a name and
// nothing else, so a name offered twice is a call with two meanings, and the agent's own tool is
// the one under the agent's own controls.
//
// And a run under selection is offered what selection offered (SPEC.md 4.15). Selection judged the
// agent's described tools and its servers' together; a remote one that came back as a schema anyway
// would make the offering a suggestion, which is not what a perimeter is.
function remoteTools(
  toolDefinitions: readonly ToolDefinition[],
  offered: readonly string[] | null,
): readonly ToolDefinition[] {
  const taken = new Set(toolDefinitions.map((tool) => tool.name.toLowerCase()));

  return (AgentRun.current()?.remoteTools ?? [])
    .filter((tool) => tool.description.trim().length > 0)
    .filter((tool) => !taken.has(tool.name.toLowerCase()))
    .filter((tool) => offered === null || offered.some((name) => name.toLowerCase() === tool.name.toLowerCase()))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJson: tool.inputSchemaJson,
    }));
}

// One reading of a structured answer. A generation carrying calls is an act; a generation carrying
// prose is an answer; a generation the provider filtered is a refusal, and it is a refusal here
// rather than an empty answer, because the difference is the only thing the caller can act on.
export function interpretNatively(context: AgentContext, generation: GenerationResult): AgentContext {
  const decided = {
    ...context,
    rawReply: generation.content,
    narration: generation.narration,
    promptTokens: generation.promptTokens,
    completionTokens: generation.completionTokens,

    // Reported, not counted: the provider said what this cost.
    usageIsEstimated: false,
  };

  if (generation.finishReason === CONTENT_FILTER) {
    return {
      ...decided,
      intent: REFUSE_DIRECTION,
      directionType: REFUSE_DIRECTION,
      payload: FILTERED_MESSAGE,
    };
  }

  const call = generation.toolCalls[0];

  if (call === undefined) {
    return {
      ...decided,
      intent: RESPOND_INTENT,
      directionType: RETURN_RESPONSE_DIRECTION,
      payload: generation.content,
      toolCallId: "",
    };
  }

  return {
    ...decided,
    intent: call.name,
    directionType: call.name,
    payload: call.argumentsJson,

    // The id the answer must come back under. One act per turn is the loop's shape, so the id of
    // the call it performs is the only one it can honour.
    toolCallId: call.id,

    // What the model said while calling is kept beside what it did, so the assistant turn a later
    // conversation replays carries both.
    assistantContent: generation.content,
  };
}

// A model may propose several calls in one turn. The loop performs one act per turn, so the rest
// are dropped and named, because a call silently discarded is a call the model will keep making.
export function droppedCallIds(generation: GenerationResult): readonly string[] {
  return generation.toolCalls.slice(1).map((call) => call.id);
}

// Everything a native call put in front of the model, as text to count when the provider did not
// say what it cost: the instructions, the conversation and the calls in it, what this run observed,
// the prompt, and the tools it was offered, whose schemas are prompt as much as anything else is.
export function whatWasSent(ask: NativeAsk): string {
  const exchanges = (all: NativeAsk["exchanges"]): string[] =>
    all.flatMap((exchange) => [exchange.assistantContent ?? "", exchange.toolName, exchange.argumentsJson, exchange.result]);

  return [
    ask.systemPrompt,
    ...ask.history.flatMap((turn) => [turn.prompt, ...exchanges(turn.exchanges), turn.answer]),
    ...exchanges(ask.exchanges),
    ...ask.observations,
    ask.prompt,
    ...ask.tools.flatMap((tool) => [tool.name, tool.description, tool.parametersJson]),
  ]
    .filter((part) => part.length > 0)
    .join("\n");
}

// Everything the model wrote back: its words, its narration, and each call with its arguments.
export function whatCameBack(generation: GenerationResult): string {
  return [
    generation.narration,
    generation.content,
    ...generation.toolCalls.flatMap((call) => [call.name, call.argumentsJson]),
  ]
    .filter((part) => part.length > 0)
    .join("\n");
}
