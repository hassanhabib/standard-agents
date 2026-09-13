// The Data nature's knowledge source (SPEC.md 4.2): grounding passages relevant to a query.
export interface KnowledgeBroker {
  selectKnowledge(query: string): Promise<readonly string[]>;
}
