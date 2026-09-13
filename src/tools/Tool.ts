import type { RiskLevel } from "../models/orchestrations/effects/RiskLevel.js";

// A tool the agent may run (SPEC.md 6.1, 3.3). The description is the advertisement opt-in; the
// tool declares its own risk and names what its arguments touch, because only the tool knows.
export interface Tool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: string;
  readonly risk?: RiskLevel;
  readonly narrationStarting?: string;
  readonly narrationObserved?: string;
  scopeOf?(input: string): string;

  // Whether an outcome means the act actually happened (SPEC.md 4.9). Absent is yes, which is what
  // every tool that only answers when it did something already means.
  //
  // A tool that refuses by answering rather than throwing is the reason this exists. The refusal is
  // the right thing to hand the model, and it is not a result: nothing was done, so the ledger must
  // let the claim go rather than fill it in. It used to record the refusal as the effect's outcome
  // and replay it, which turned "read the file, then call me again" into a call that could never
  // succeed however many times the model did as it was told.
  performed?(output: string): boolean;

  execute(input: string, signal?: AbortSignal): Promise<string>;
  compensate?(input: string, outcome: string): Promise<string | null>;
}
