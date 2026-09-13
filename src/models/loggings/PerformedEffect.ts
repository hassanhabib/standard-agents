// An act this run actually performed, and what it produced (SPEC.md 4.9). Recorded so the run
// can be unwound: compensation needs the arguments the tool was called with and the outcome it
// returned, because the outcome carries the identity the undo has to name. Only performed acts
// are kept; an act denied, held or replayed was never performed by this run.
export interface PerformedEffect {
  readonly toolName: string;
  readonly arguments: string;
  readonly outcome: string;
  readonly idempotencyKey: string;
}
