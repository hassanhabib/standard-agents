// One call a turn made and what it produced (SPEC.md 3.2, 6.2). assistantContent is the prose
// the model sent beside the call, replayed with it so the conversation reads as it happened.
export interface ToolExchange {
  readonly callId: string;
  readonly toolName: string;
  readonly argumentsJson: string;
  readonly result: string;
  readonly assistantContent?: string;

  // Whether this call was answered from the ledger rather than performed: the same act asked for
  // again, with the same arguments, and nothing changed in between. A loop that counts asks has
  // to tell these from the real ones, because a read after an edit is the same ask and is not a
  // repeat. Absent on a call that ran, rather than false, so a turn recorded before this existed
  // reads back unchanged.
  readonly replayed?: boolean;
}
