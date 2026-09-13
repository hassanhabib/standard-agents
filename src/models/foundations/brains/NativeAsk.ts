import type { ResolvedInference } from "../../brokers/generators/ResolvedInference.js";
import type { ToolDefinition } from "../../brokers/generators/v1/ToolDefinition.js";
import type { AgentTurn } from "../../brokers/sessions/AgentTurn.js";
import type { ToolExchange } from "../../orchestrations/agents/ToolExchange.js";

// What one native turn is asked with (SPEC.md 6.2, 17.1). The V0 brain is handed a system prompt
// and a user prompt already written out; the V1 brain is handed the pieces, because the
// conversation it must build is structured and the structure is what the provider reads.
export interface NativeAsk {
  readonly systemPrompt: string;
  readonly prompt: string;

  // The conversation before this prompt, oldest first, each turn carrying the calls it made.
  readonly history: readonly AgentTurn[];

  // This run's calls, which are not yet a turn because the run has not ended.
  readonly exchanges: readonly ToolExchange[];

  // What the loop observed this run. An observation an exchange already accounts for is not
  // repeated; only what no call answers for needs saying again.
  readonly observations: readonly string[];
  readonly tools: readonly ToolDefinition[];
  readonly inference: ResolvedInference | null;
}

export function createNativeAsk(prompt: string, overrides: Partial<NativeAsk> = {}): NativeAsk {
  return {
    systemPrompt: "",
    prompt,
    history: [],
    exchanges: [],
    observations: [],
    tools: [],
    inference: null,
    ...overrides,
  };
}

// What the deployment established about the window the conversation must fit through, and how
// much of an old call's result is worth carrying (SPEC.md 10.3).
export interface NativeOptions {
  // How many of the most recent calls keep their result. Older calls keep what they were and lose
  // what they returned, because a result already reasoned over is worth less than the room it
  // costs.
  readonly elisionWindow: number;

  // What the profile's probe reported, or null when it reported nothing. Null means the provider
  // is the only judge of what fits, which is a fine answer: it is the one that has to read it.
  readonly contextLength: number | null;

  readonly maxHistoryTurns: number;

  // Only an estimate, and named as one. A real count needs the provider's tokenizer, which a
  // foundation does not hold; this exists to climb down before a request that obviously will not
  // fit is sent, not to predict the provider's arithmetic.
  readonly charactersPerToken: number;
}

export const DEFAULT_ELISION_WINDOW = 3;

export function createNativeOptions(overrides: Partial<NativeOptions> = {}): NativeOptions {
  return {
    elisionWindow: DEFAULT_ELISION_WINDOW,
    contextLength: null,
    maxHistoryTurns: 20,
    charactersPerToken: 4,
    ...overrides,
  };
}
