// A composition that cannot stand as asked: a key nobody registered, a nameless fleet member, a
// cost budget without a rate (SPEC.md 4.8, 4.10). Raised by the client before any run starts.
export class InvalidAgentCompositionException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "InvalidAgentCompositionException";
  }
}
