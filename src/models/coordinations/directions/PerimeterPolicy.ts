import type { AgentEffect } from "../../orchestrations/effects/AgentEffect.js";
import type { AgentPrincipal } from "../../orchestrations/effects/AgentPrincipal.js";
import type { PermissionMode } from "../../orchestrations/effects/PermissionMode.js";
import type { RiskLevel } from "../../orchestrations/effects/RiskLevel.js";

// The perimeter's standing orders, as one datum (SPEC.md 4.9): what mode permission runs in,
// what each tool declared about itself, and the host's own hooks for who is acting and what is
// explicitly permitted. Policy is Data; these ride together as a value the perimeter consults.
export interface PerimeterPolicy {
  // What permission means when nothing named the act.
  readonly mode: PermissionMode;

  // The tools whose acts require approval before running.
  readonly irreversibleTools: readonly string[];

  // Risk the host declared per tool, overriding what the tool says of itself.
  readonly declaredRisk: ReadonlyMap<string, RiskLevel>;

  // Risk each tool declares about itself, read once at composition.
  readonly toolRisk: ReadonlyMap<string, RiskLevel>;

  // Each tool's own reading of what an act touches. The tool is the only thing that knows what
  // its arguments mean; the framework never parses them.
  readonly toolScope: ReadonlyMap<string, (input: string) => string>;

  // Each tool's own reading of whether an outcome means the act happened. Absent is yes. A tool
  // that refuses by answering is the reason: nothing was done, so the ledger lets the claim go
  // instead of filling it in, and the same call may run once the model has done what the refusal
  // asked for.
  readonly toolPerformed: ReadonlyMap<string, (output: string) => boolean>;

  // Whether the configured allow-list speaks to an act at all, which the mode needs and a yes or
  // no decision cannot carry. Null when no allow-list was configured, so Ask asks about everything.
  readonly explicitlyPermits: ((effect: AgentEffect) => boolean) | null;

  // Who is acting, asked per act rather than captured at composition, because the principal can
  // change between prompts on a shared agent (SPEC.md 4.4).
  readonly identityResolver: (() => AgentPrincipal | null) | null;

  // Whether the run's offering (SPEC.md 4.15) binds at the perimeter: an act naming an advertised
  // tool the run was not offered is denied, told, non-terminal, recoverable.
  readonly enforceSelection: boolean;

  // The advertised tool names, what selection could have offered, so the perimeter can tell a
  // withheld tool from an undescribed one.
  readonly advertisedTools: readonly string[];
}

export function createPerimeterPolicy(overrides: Partial<PerimeterPolicy> = {}): PerimeterPolicy {
  return {
    mode: "Open",
    irreversibleTools: [],
    declaredRisk: new Map(),
    toolRisk: new Map(),
    toolScope: new Map(),
    toolPerformed: new Map(),
    explicitlyPermits: null,
    identityResolver: null,
    enforceSelection: false,
    advertisedTools: [],
    ...overrides,
  };
}
