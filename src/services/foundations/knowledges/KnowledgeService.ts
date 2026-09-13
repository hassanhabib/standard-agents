import type { KnowledgeBroker } from "../../../brokers/knowledges/KnowledgeBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { createTryCatch, type TryCatch } from "./KnowledgeService.Exceptions.js";
import { validateQuery } from "./KnowledgeService.Validations.js";

// The Data nature's knowledge foundation (SPEC.md 4.2): grounding passages for a query, from one
// knowledge broker.
export class KnowledgeService {
  private readonly knowledgeBroker: KnowledgeBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(knowledgeBroker: KnowledgeBroker, loggingBroker: LoggingBroker) {
    this.knowledgeBroker = knowledgeBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public retrieve(query: string): Promise<readonly string[]> {
    return this.tryCatch(async () => {
      validateQuery(query);

      return await this.knowledgeBroker.selectKnowledge(query);
    });
  }
}
