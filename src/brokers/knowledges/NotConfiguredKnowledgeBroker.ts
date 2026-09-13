import type { KnowledgeBroker } from "./KnowledgeBroker.js";

// No knowledge configured: a run grounds on nothing, which is the Core profile's shape.
export class NotConfiguredKnowledgeBroker implements KnowledgeBroker {
  public async selectKnowledge(_query: string): Promise<readonly string[]> {
    return [];
  }
}
