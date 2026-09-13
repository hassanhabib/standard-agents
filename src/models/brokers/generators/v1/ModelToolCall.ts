// A call the model asked for (SPEC.md 6.2). The id is the provider's or the implementation's to
// mint and is never the idempotency key.
export interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly argumentsJson: string;
}
