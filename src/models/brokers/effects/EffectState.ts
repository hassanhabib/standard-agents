// Where an act stands in the ledger (SPEC.md 4.9). Typed, because the window between "about to
// run" and "recorded" must never read as a result.
export type EffectState = "InFlight" | "Completed" | "Failed" | "CompensationPending" | "Compensated";
