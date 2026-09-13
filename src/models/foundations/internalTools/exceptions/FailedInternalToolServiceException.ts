export class FailedInternalToolServiceException extends Error {
  public readonly data: Map<string, string[]> = new Map();
  public readonly innerError: Error;

  public constructor(message: string, innerError: Error) {
    super(message, { cause: innerError });
    this.name = "FailedInternalToolServiceException";
    this.innerError = innerError;
  }
}
