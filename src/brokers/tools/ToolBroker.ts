// The Direction nature's internal tools (SPEC.md 4.1, 8.1): whether a name is registered, and
// running or compensating the tool behind it.
export interface ToolBroker {
  has(name: string): Promise<boolean>;
  run(name: string, input: string): Promise<string>;
  compensate(name: string, input: string, outcome: string): Promise<string>;
}
