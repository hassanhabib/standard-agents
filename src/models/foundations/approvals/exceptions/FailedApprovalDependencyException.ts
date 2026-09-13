export class FailedApprovalDependencyException extends Error {
  public readonly data: Map<string, string[]> = new Map();
  public readonly innerError: Error;

  public constructor(message: string, innerError: Error) {
    super(message, { cause: innerError });
    this.name = "FailedApprovalDependencyException";
    this.innerError = innerError;
  }
}
