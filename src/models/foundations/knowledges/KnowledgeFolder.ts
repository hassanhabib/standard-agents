// The Local knowledge mode (SPEC.md 4.2): a folder of documents read through the file broker,
// which of them count, how many passages reach a turn, and the relevance floor a passage must
// clear. The defaults are the reference's, so a folder given nothing else behaves the same in
// every implementation.
export interface KnowledgeFolder {
  readonly path: string;
  readonly pattern: string;
  readonly maxResults: number;
  readonly minimumScore: number;
}

export const DEFAULT_KNOWLEDGE_PATH = "Knowledge";
export const DEFAULT_KNOWLEDGE_PATTERN = "*.md";
export const DEFAULT_KNOWLEDGE_MAX_RESULTS = 3;
export const DEFAULT_KNOWLEDGE_MINIMUM_SCORE = 0;

export function createKnowledgeFolder(
  path: string = DEFAULT_KNOWLEDGE_PATH,
  pattern: string = DEFAULT_KNOWLEDGE_PATTERN,
  maxResults: number = DEFAULT_KNOWLEDGE_MAX_RESULTS,
  minimumScore: number = DEFAULT_KNOWLEDGE_MINIMUM_SCORE,
): KnowledgeFolder {
  return { path, pattern, maxResults, minimumScore };
}
