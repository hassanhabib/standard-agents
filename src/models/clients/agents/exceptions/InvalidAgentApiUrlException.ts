// A brain URL that is not a base: one that names the route (chat/completions) refuses to
// compose, because the broker owns the route and a URL that carries it would be sent twice.
export class InvalidAgentApiUrlException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "InvalidAgentApiUrlException";
  }
}
