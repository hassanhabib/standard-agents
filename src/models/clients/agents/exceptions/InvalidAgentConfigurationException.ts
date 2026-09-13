// A configuration document the client refuses: an unknown key, a value of the wrong shape.
export class InvalidAgentConfigurationException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "InvalidAgentConfigurationException";
  }
}
