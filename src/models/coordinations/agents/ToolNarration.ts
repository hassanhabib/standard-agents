// A tool's declared narration templates (SPEC.md 6.0): starting is voiced before the act, with
// {tool} and {payload} slots, and a model-authored narration overrides it; observed is voiced
// after the result, with a {tool} slot, and is never overridden. Derived from the tool, so the
// loop can voice acts without holding the tools themselves.
export interface ToolNarration {
  readonly starting: string;
  readonly observed: string;
}
