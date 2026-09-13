// The conversation does not fit and there is nothing left to drop (SPEC.md 10.3). Raised only
// when the degradation ladder is exhausted, so it never means "this was big" and always means
// "this was too big even after everything that could be given up was".
export class ContextTooLargeException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "ContextTooLargeException";
  }
}
