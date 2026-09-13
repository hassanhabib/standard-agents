// The host's selection judgment (SPEC.md 4.15): given the run's task and the described tool
// names, the subset this run is offered. An empty list is the valid offered-nothing selection.
export type ToolSelector = (task: string, describedToolNames: readonly string[]) => Promise<readonly string[]>;
