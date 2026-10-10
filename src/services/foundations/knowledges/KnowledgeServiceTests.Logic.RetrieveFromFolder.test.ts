import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createKnowledgeFolder } from "../../../models/foundations/knowledges/KnowledgeFolder.js";
import { createFolderKnowledgeServiceTests, createRandomString, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

// The Local mode (SPEC.md 4.2): a folder of documents, ranked by relevance to the query rather
// than returned as found.
describe("KnowledgeService retrieve from a folder logic", () => {
  it("ShouldRetrieveNoKnowledgeIfTheKnowledgeFolderIsNotThereAsync", async () => {
    // given
    const knowledgePath = join(tmpdir(), createRandomString());

    const { fileBrokerMock, loggingBrokerMock, knowledgeService } = createFolderKnowledgeServiceTests(
      createKnowledgeFolder(knowledgePath),
      {},
      [],
    );

    // when
    const actualPassages = await knowledgeService.retrieve(createRandomString());

    // then
    expect(actualPassages).toEqual([]);
    expect(fileBrokerMock.stat).toHaveBeenCalledWith(knowledgePath);
    verifyNoOtherCalls(fileBrokerMock, { stat: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  // Ranking replaced first-N-found, and the difference is visible here: every document is read,
  // because a term's weight depends on how rare it is across the whole corpus. Equal scores keep
  // the documents' ordinal path order, whatever order the folder listed them in.
  it("ShouldRetrieveTheMostRelevantKnowledgeUpToMaxResultsAsync", async () => {
    // given
    const knowledgePath = join(tmpdir(), createRandomString());

    const documents: Record<string, string> = {
      [join(knowledgePath, "c.md")]: "gamma NEEDLE",
      [join(knowledgePath, "a.md")]: "alpha needle",
      [join(knowledgePath, "d.md")]: "delta needle",
      [join(knowledgePath, "b.md")]: "beta",
    };

    const { fileBrokerMock, loggingBrokerMock, knowledgeService } = createFolderKnowledgeServiceTests(
      createKnowledgeFolder(knowledgePath, "*.md", 2),
      documents,
      [knowledgePath],
    );

    // when
    const actualPassages = await knowledgeService.retrieve("needle");

    // then
    expect(actualPassages).toEqual(["alpha needle", "gamma NEEDLE"]);
    expect(fileBrokerMock.readdir).toHaveBeenCalledWith(knowledgePath);

    for (const documentPath of Object.keys(documents)) {
      expect(fileBrokerMock.readFile).toHaveBeenCalledWith(documentPath);
    }

    verifyNoOtherCalls(fileBrokerMock, { stat: 5, readdir: 1, readFile: 4 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRetrieveNoKnowledgeBelowTheMinimumScoreAsync", async () => {
    // given
    const knowledgePath = join(tmpdir(), createRandomString());

    // Both carry the term; the longer one is diluted by its length below the floor.
    const documents: Record<string, string> = {
      [join(knowledgePath, "a.md")]: "alpha needle",
      [join(knowledgePath, "b.md")]: "beta needle haystack hay straw",
    };

    const { fileBrokerMock, loggingBrokerMock, knowledgeService } = createFolderKnowledgeServiceTests(
      createKnowledgeFolder(knowledgePath, "*.md", 3, 0.4),
      documents,
      [knowledgePath],
    );

    // when
    const actualPassages = await knowledgeService.retrieve("needle");

    // then
    expect(actualPassages).toEqual(["alpha needle"]);
    verifyNoOtherCalls(fileBrokerMock, { stat: 3, readdir: 1, readFile: 2 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  // Overlapping windows of 120 words every 60, so an answer that straddles a boundary is still
  // found whole by one of them; the shorter window carrying the term outranks the longer one.
  it("ShouldRetrieveOverlappingPassagesOfALongDocumentAsync", async () => {
    // given
    const knowledgePath = join(tmpdir(), createRandomString());
    const words = Array.from({ length: 200 }, (_, index) => (index === 150 ? "needle" : `w${String(index)}`));

    const { fileBrokerMock, loggingBrokerMock, knowledgeService } = createFolderKnowledgeServiceTests(
      createKnowledgeFolder(knowledgePath),
      { [join(knowledgePath, "long.md")]: words.join("\n") },
      [knowledgePath],
    );

    const expectedPassages = [words.slice(120, 200).join(" "), words.slice(60, 180).join(" ")];

    // when
    const actualPassages = await knowledgeService.retrieve("needle");

    // then
    expect(actualPassages).toEqual(expectedPassages);
    verifyNoOtherCalls(fileBrokerMock, { stat: 2, readdir: 1, readFile: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });
});
