import type { MemoryBroker } from "./MemoryBroker.js";

// No memory configured: nothing is recalled and a memory written goes nowhere, announced by the
// composition rather than hidden.
export class NotConfiguredMemoryBroker implements MemoryBroker {
  public async selectMemories(): Promise<readonly string[]> {
    return [];
  }

  public async insertMemory(_memory: string): Promise<void> {}
}
