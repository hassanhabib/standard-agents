// The Judge's resource (SPEC.md 4.2, 4.5): scores a candidate answer against the task, answering
// with a score and a reason the foundation parses.
export interface VerifierBroker {
  verify(task: string, candidate: string): Promise<string>;
}
