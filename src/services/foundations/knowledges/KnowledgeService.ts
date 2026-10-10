import type { KnowledgeBroker } from "../../../brokers/knowledges/KnowledgeBroker.js";
import type { SourcedKnowledgeBroker } from "../../../brokers/knowledges/SourcedKnowledgeBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { KnowledgeResult } from "../../../models/foundations/knowledges/KnowledgeResult.js";
import { createTryCatch, type TryCatch } from "./KnowledgeService.Exceptions.js";
import { validateQuery } from "./KnowledgeService.Validations.js";

// The Data nature's knowledge foundation (SPEC.md 4.2): grounding passages for a query, from one
// knowledge broker, plain or sourced (SPEC.md 3.7, 4.1, v1.18).
export class KnowledgeService {
  private readonly knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker, loggingBroker: LoggingBroker) {
    this.knowledgeBroker = knowledgeBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public retrieve(query: string): Promise<readonly string[]> {
    return this.tryCatch(async () => {
      validateQuery(query);
      const knowledgeResults = await this.selectSourcedKnowledge(query);

      return knowledgeResults.map((knowledgeResult) => knowledgeResult.text);
    });
  }

  public retrieveSourced(query: string): Promise<readonly KnowledgeResult[]> {
    return this.tryCatch(async () => {
      validateQuery(query);

      return await this.selectSourcedKnowledge(query);
    });
  }

  // One retrieval behind both doors, so the plain one can never rank or filter differently from
  // the sourced one: it is the same passages with what travels beside them left off.
  private async selectSourcedKnowledge(query: string): Promise<readonly KnowledgeResult[]> {
    if (isSourced(this.knowledgeBroker)) {
      return await this.knowledgeBroker.selectSourcedKnowledge(query);
    }

    const passages = await this.knowledgeBroker.selectKnowledge(query);

    return passages.map(liftUnsourced);
  }
}

function isSourced(knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker): knowledgeBroker is SourcedKnowledgeBroker {
  return "selectSourcedKnowledge" in knowledgeBroker;
}

// A plain broker never said where a passage came from (SPEC.md 4.1), so the lifted passage claims
// nothing: no score, no source, and therefore never cited.
function liftUnsourced(passage: string): KnowledgeResult {
  return { text: passage, score: null, source: "" };
}
