// One call a turn made and what it produced (SPEC.md 3.2, 6.2). assistantContent is the prose
// the model sent beside the call, replayed with it so the conversation reads as it happened.
export interface ToolExchange {
  readonly callId: string;
  readonly toolName: string;
  readonly argumentsJson: string;
  readonly result: string;
  readonly assistantContent?: string;
}
