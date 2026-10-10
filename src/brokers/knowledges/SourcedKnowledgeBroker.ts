import type { KnowledgeResult } from "../../models/foundations/knowledges/KnowledgeResult.js";

// The richer knowledge source (SPEC.md 4.1, v1.18): passages that say where they came from and how
// well they matched. A source implements either this or the plain KnowledgeBroker, which is never
// retired.
export interface SourcedKnowledgeBroker {
  selectSourcedKnowledge(query: string): Promise<readonly KnowledgeResult[]>;
}
