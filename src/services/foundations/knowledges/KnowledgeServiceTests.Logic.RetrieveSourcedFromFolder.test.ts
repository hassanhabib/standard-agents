import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createKnowledgeFolder } from "../../../models/foundations/knowledges/KnowledgeFolder.js";
import type { KnowledgeResult } from "../../../models/foundations/knowledges/KnowledgeResult.js";
import { createFolderKnowledgeServiceTests, createRandomString, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve sourced from a folder logic", () => {
  // The knowledge an agent is given with nothing installed is citable out of the box (SPEC.md
  // 4.2): each passage names the document it was cut from, relative to the knowledge folder and
  // with forward slashes whatever the platform, so a citation reads the same on every machine.
  // Subfolders are searched, and only the documents the pattern names are read.
  it("ShouldRetrieveSourcedKnowledgeFromAFolderWithTheirPathsAndScoresAsync", async () => {
    // given
    const knowledgePath = join(tmpdir(), createRandomString());
    const policiesPath = join(knowledgePath, "policies");
    const refundsPath = join(policiesPath, "refunds.md");
    const shippingPath = join(knowledgePath, "shipping.md");
    const notesPath = join(knowledgePath, "notes.txt");
    const refundsDocument = "Enterprise customers may request a refund within 90 days.";

    const { fileBrokerMock, loggingBrokerMock, knowledgeService } = createFolderKnowledgeServiceTests(
      createKnowledgeFolder(knowledgePath),
      {
        [shippingPath]: "Orders ship within two business days.",
        [notesPath]: "A refund note that is not knowledge.",
        [refundsPath]: refundsDocument,
      },
      [knowledgePath, policiesPath],
    );

    // Eight terms once the noise is gone; the term is in one of the two documents.
    const expectedResults: KnowledgeResult[] = [
      { text: refundsDocument, score: Math.log(1 + 2 / 1) / Math.sqrt(8), source: "policies/refunds.md" },
    ];

    // when
    const actualResults = await knowledgeService.retrieveSourced("refund");

    // then
    expect(actualResults).toHaveLength(1);
    expect(actualResults[0]?.text).toBe(expectedResults[0]?.text);
    expect(actualResults[0]?.source).toBe(expectedResults[0]?.source);
    expect(actualResults[0]?.score).toBeCloseTo(expectedResults[0]?.score ?? 0, 12);
    expect(fileBrokerMock.readFile).toHaveBeenCalledWith(refundsPath);
    expect(fileBrokerMock.readFile).toHaveBeenCalledWith(shippingPath);
    expect(fileBrokerMock.readFile).not.toHaveBeenCalledWith(notesPath);
    verifyNoOtherCalls(fileBrokerMock, { stat: 5, readdir: 2, readFile: 2 });
    verifyNoOtherCalls(loggingBrokerMock);
  });
});
