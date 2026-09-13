export class AgentOrchestrationValidationException extends Error {
  public readonly data: Map<string, string[]>;
  public readonly innerError: Error;

  public constructor(message: string, innerError: Error) {
    super(message, { cause: innerError });
    this.name = "AgentOrchestrationValidationException";
    this.innerError = innerError;
    this.data = "data" in innerError && innerError.data instanceof Map ? innerError.data : new Map();
  }
}
