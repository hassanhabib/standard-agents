import type { RiskLevel } from "../orchestrations/effects/RiskLevel.js";

// An act this run actually performed, and what it produced (SPEC.md 4.9). Recorded so the run
// can be unwound: compensation needs the arguments the tool was called with and the outcome it
// returned, because the outcome carries the identity the undo has to name. Only performed acts
// are kept; an act denied, held or replayed was never performed by this run.
export interface PerformedEffect {
  readonly toolName: string;
  readonly arguments: string;
  readonly outcome: string;
  readonly idempotencyKey: string;

  // What the act touched, as the tool named it, and how consequential it was: a look at a scope
  // this run has since written to is a different look from the one before the write (SPEC.md
  // 4.9, v1.14). Absent when the tool names nothing, and an act with no risk said is not a write.
  readonly scope?: string;
  readonly riskLevel?: RiskLevel;
}
