// A tool a remote server declares (SPEC.md 4.8 External): its name, the description that is the
// advertisement opt-in, and the JSON Schema of its input as a string.
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchemaJson: string;
}
