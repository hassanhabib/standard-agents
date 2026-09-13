// The Data nature's memory store (SPEC.md 4.2, 7 invariant 4): recalled by Data, written by
// Direction, and never held inside the agent between prompts.
export interface MemoryBroker {
  selectMemories(): Promise<readonly string[]>;
  insertMemory(memory: string): Promise<void>;
}
