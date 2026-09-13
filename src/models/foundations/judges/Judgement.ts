// What the Judge said about a candidate answer (SPEC.md 4.5): a score between 0 and 1 and the
// reason, which becomes revision feedback when the score is too low.
export interface Judgement {
  readonly score: number;
  readonly reason: string;
}
