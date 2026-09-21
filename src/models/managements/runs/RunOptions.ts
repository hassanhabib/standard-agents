import type { AgentBudget } from "../../coordinations/agents/AgentBudget.js";
import type { PrincipalResolver } from "../../coordinations/agents/PrincipalResolver.js";
import type { ToolNarration } from "../../coordinations/agents/ToolNarration.js";
import type { ToolSelector } from "../../coordinations/agents/ToolSelector.js";

// What the deployment established, snapshotted at composition so precedence can be resolved at
// the top of each run. A null knob means the host expressed no opinion, which is exactly what
// lets a request's value take effect (SPEC.md 4.13).
export interface RunOptions {
  readonly maxTurns: number;
  readonly maxHistoryTurns: number;

  // How many times a run may ask for the same act, with the same arguments, before the loop ends
  // it. The run-once perimeter answers the second ask with a replay and a note, and the third
  // with the note alone; a model still asking after that is going in circles, and a turn cap of
  // sixty-four is sixty turns of the same question. Above the default turn cap, so a deployment
  // on the default never meets this and the cap stays the loop's first breaker.
  readonly identicalCallLimit: number;
  readonly budget: AgentBudget | null;
  readonly screenToolOutput: boolean;
  readonly contractSchema: string | null;
  readonly configuredTemperature: number | null;
  readonly configuredMaxTokens: number | null;
  readonly configuredToolNames: readonly string[];
  readonly describedToolNames: readonly string[];
  readonly toolNarrations: ReadonlyMap<string, ToolNarration>;
  readonly toolSelector: ToolSelector | null;
  readonly principalResolver: PrincipalResolver | null;
}

export const DEFAULT_MAX_TURNS = 7;
export const DEFAULT_MAX_HISTORY_TURNS = 20;
export const DEFAULT_IDENTICAL_CALL_LIMIT = 8;

export function createRunOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    maxTurns: DEFAULT_MAX_TURNS,
    maxHistoryTurns: DEFAULT_MAX_HISTORY_TURNS,
    identicalCallLimit: DEFAULT_IDENTICAL_CALL_LIMIT,
    budget: null,
    screenToolOutput: false,
    contractSchema: null,
    configuredTemperature: null,
    configuredMaxTokens: null,
    configuredToolNames: [],
    describedToolNames: [],
    toolNarrations: new Map(),
    toolSelector: null,
    principalResolver: null,
    ...overrides,
  };
}
