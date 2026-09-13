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

export function createRunOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    maxTurns: DEFAULT_MAX_TURNS,
    maxHistoryTurns: DEFAULT_MAX_HISTORY_TURNS,
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
