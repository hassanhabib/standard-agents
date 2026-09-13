import { InvalidKnowledgeException } from "../../../models/foundations/knowledges/exceptions/InvalidKnowledgeException.js";

// The validation partial (SPEC-cli 3.1): nothing can be grounded for an empty query.
export function validateQuery(query: string): void {
  if (query.trim().length === 0) {
    throw new InvalidKnowledgeException("Invalid knowledge query. Please correct the error and try again.");
  }
}
