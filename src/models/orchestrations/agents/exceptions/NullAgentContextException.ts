export class NullAgentContextException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "NullAgentContextException";
  }
}
