// The Contract's resource (SPEC.md 4.13): checks an answer against a schema and answers with a
// complaint, or null when the answer satisfies it.
export interface ContractBroker {
  validate(answer: string, schema: string): Promise<string | null>;
}
