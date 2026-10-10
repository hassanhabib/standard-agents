import type { KnowledgeResult } from "../../models/foundations/knowledges/KnowledgeResult.js";
import type { SourcedKnowledgeBroker } from "./SourcedKnowledgeBroker.js";

// The Custom mode of knowledge, sourced (SPEC.md 4.8, 3.7): the host ranks, and says where each
// passage came from.
export class FunctionSourcedKnowledgeBroker implements SourcedKnowledgeBroker {
  private readonly select: (query: string) => Promise<readonly KnowledgeResult[]>;

  public constructor(select: (query: string) => Promise<readonly KnowledgeResult[]>) {
    this.select = select;
  }

  public async selectSourcedKnowledge(query: string): Promise<readonly KnowledgeResult[]> {
    return await this.select(query);
  }
}
