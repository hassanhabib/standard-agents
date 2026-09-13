// A tool as the Brain sees it offered (SPEC.md 6.2): a name, the description that is the
// advertisement opt-in, and a JSON Schema of type object as a string.
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parametersJson: string;
}
