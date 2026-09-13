// The Gate's resource (SPEC.md 4.2, 4.5): classifies an input as allow, refuse or route, and
// assesses instructions against a rubric. A guardian is never the Brain (SPEC.md 7, invariant 6).
export interface ClassifierBroker {
  classify(input: string): Promise<string>;
  assess(systemPrompt: string, input: string): Promise<string>;
}
