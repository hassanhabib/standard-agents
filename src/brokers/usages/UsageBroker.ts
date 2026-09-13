// The token counter (SPEC.md 3.4, 4.10): what a text costs when the provider did not say.
export interface UsageBroker {
  countTokens(text: string): Promise<number>;
}
