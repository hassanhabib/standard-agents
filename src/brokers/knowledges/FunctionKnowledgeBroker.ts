import type { KnowledgeBroker } from "./KnowledgeBroker.js";

// The Custom mode of knowledge (SPEC.md 4.8).
export class FunctionKnowledgeBroker implements KnowledgeBroker {
  private readonly select: (query: string) => Promise<readonly string[]>;

  public constructor(select: (query: string) => Promise<readonly string[]>) {
    this.select = select;
  }

  public async selectKnowledge(query: string): Promise<readonly string[]> {
    return await this.select(query);
  }
}
