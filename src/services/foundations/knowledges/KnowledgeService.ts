import { join, relative } from "node:path";

import type { FileBroker } from "../../../brokers/files/FileBroker.js";
import type { KnowledgeBroker } from "../../../brokers/knowledges/KnowledgeBroker.js";
import type { SourcedKnowledgeBroker } from "../../../brokers/knowledges/SourcedKnowledgeBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { createKnowledgeFolder, type KnowledgeFolder } from "../../../models/foundations/knowledges/KnowledgeFolder.js";
import type { KnowledgeResult } from "../../../models/foundations/knowledges/KnowledgeResult.js";
import { createTryCatch, type TryCatch } from "./KnowledgeService.Exceptions.js";
import { documentFrequencies, matchesPattern, passages, score, terms } from "./KnowledgeService.Ranking.js";
import { validateQuery } from "./KnowledgeService.Validations.js";

// The Data nature's knowledge foundation (SPEC.md 4.2): grounding passages for a query, from one
// knowledge broker, plain or sourced (SPEC.md 3.7, 4.1, v1.18), or from a folder of documents read
// through the file broker and ranked here, which is the Local mode.
export class KnowledgeService {
  private readonly knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker | FileBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly knowledgeFolder: KnowledgeFolder;
  private readonly tryCatch: TryCatch;

  // The folder is read only when the broker is the file broker; any other broker answers for
  // itself and the folder is never consulted.
  public constructor(
    knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker | FileBroker,
    loggingBroker: LoggingBroker,
    knowledgeFolder: KnowledgeFolder = createKnowledgeFolder(),
  ) {
    this.knowledgeBroker = knowledgeBroker;
    this.loggingBroker = loggingBroker;
    this.knowledgeFolder = knowledgeFolder;
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
    if (isFileBroker(this.knowledgeBroker)) {
      return await this.selectKnowledgeFromFolder(this.knowledgeBroker, query);
    }

    if (isSourced(this.knowledgeBroker)) {
      return await this.knowledgeBroker.selectSourcedKnowledge(query);
    }

    const passages = await this.knowledgeBroker.selectKnowledge(query);

    return passages.map(liftUnsourced);
  }

  private async selectKnowledgeFromFolder(fileBroker: FileBroker, query: string): Promise<readonly KnowledgeResult[]> {
    const folderStat = await fileBroker.stat(this.knowledgeFolder.path);

    if (folderStat === null || !folderStat.isDirectory) {
      return [];
    }

    const queryTerms = terms(query);

    if (queryTerms.length === 0) {
      return [];
    }

    // Ordinal path order, whatever order the file system listed them in, so equal scores rank the
    // same on every machine.
    const documentPaths = (await this.selectDocumentPaths(fileBroker, this.knowledgeFolder.path)).sort();
    const documents: string[] = [];

    for (const documentPath of documentPaths) {
      documents.push(await fileBroker.readFile(documentPath));
    }

    const documentFrequency = documentFrequencies(documents);

    return documents
      .flatMap((document, index) =>
        passages(document).map((passage) => ({
          passage,
          source: this.sourceOf(documentPaths[index] ?? ""),
          score: score(queryTerms, passage, documentFrequency, documents.length),
        })))
      // A zero score means the passage carries no query term at all, so it is never a match
      // however low the floor is set. Silence is the right answer when nothing is relevant;
      // returning the corpus instead is how a retriever becomes noise.
      .filter((scored) => scored.score > 0 && scored.score >= this.knowledgeFolder.minimumScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, this.knowledgeFolder.maxResults)
      .map((scored) => ({ text: scored.passage, score: scored.score, source: scored.source }));
  }

  // Every document the pattern names, in this folder and every folder beneath it.
  private async selectDocumentPaths(fileBroker: FileBroker, folderPath: string): Promise<string[]> {
    const documentPaths: string[] = [];

    for (const entry of await fileBroker.readdir(folderPath)) {
      const entryPath = join(folderPath, entry);
      const entryStat = await fileBroker.stat(entryPath);

      if (entryStat === null) {
        continue;
      }

      if (entryStat.isDirectory) {
        documentPaths.push(...(await this.selectDocumentPaths(fileBroker, entryPath)));
      } else if (matchesPattern(entry, this.knowledgeFolder.pattern)) {
        documentPaths.push(entryPath);
      }
    }

    return documentPaths;
  }

  // Relative to the knowledge folder and with forward slashes whatever the platform, so the same
  // document is cited the same way on every machine that serves it.
  private sourceOf(documentPath: string): string {
    return relative(this.knowledgeFolder.path, documentPath).replaceAll("\\", "/");
  }
}

function isFileBroker(
  knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker | FileBroker,
): knowledgeBroker is FileBroker {
  return "readdir" in knowledgeBroker;
}

function isSourced(knowledgeBroker: KnowledgeBroker | SourcedKnowledgeBroker): knowledgeBroker is SourcedKnowledgeBroker {
  return "selectSourcedKnowledge" in knowledgeBroker;
}

// A plain broker never said where a passage came from (SPEC.md 4.1), so the lifted passage claims
// nothing: no score, no source, and therefore never cited.
function liftUnsourced(passage: string): KnowledgeResult {
  return { text: passage, score: null, source: "" };
}
