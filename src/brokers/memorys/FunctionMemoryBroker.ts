import type { MemoryBroker } from "./MemoryBroker.js";

// The Custom mode of memory (SPEC.md 4.8), and the seam a conformance vector seeds memories through.
export class FunctionMemoryBroker implements MemoryBroker {
  private readonly select: () => Promise<readonly string[]>;
  private readonly insert: (memory: string) => Promise<void>;

  public constructor(select: () => Promise<readonly string[]>, insert: (memory: string) => Promise<void>) {
    this.select = select;
    this.insert = insert;
  }

  public async selectMemories(): Promise<readonly string[]> {
    return await this.select();
  }

  public async insertMemory(memory: string): Promise<void> {
    await this.insert(memory);
  }
}
