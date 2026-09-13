// A budget that can never trip or never be measured: a cost bound with no positive rate.
export class InvalidAgentBudgetException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "InvalidAgentBudgetException";
  }
}
