import { describe, expect, it } from "vitest";

import type { KnowledgeResult } from "../../../models/foundations/knowledges/KnowledgeResult.js";
import {
  createKnowledgeServiceTests,
  createRandomString,
  createSourcedKnowledgeServiceTests,
  verifyNoOtherCalls,
} from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve sourced logic", () => {
  it("ShouldRetrieveSourcedKnowledgeAsync", async () => {
    // given
    const { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createSourcedKnowledgeServiceTests();
    const query = createRandomString();

    const expectedResults: KnowledgeResult[] = [
      { text: createRandomString(), score: 0.9, source: createRandomString() },
      { text: createRandomString(), score: null, source: "" },
    ];

    sourcedKnowledgeBrokerMock.selectSourcedKnowledge.mockResolvedValue(expectedResults);

    // when
    const actualResults = await knowledgeService.retrieveSourced(query);

    // then
    expect(actualResults).toEqual(expectedResults);
    expect(sourcedKnowledgeBrokerMock.selectSourcedKnowledge).toHaveBeenCalledWith(query);
    verifyNoOtherCalls(sourcedKnowledgeBrokerMock, { selectSourcedKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldLiftPlainPassagesToResultsWithNoKnownSourceAsync", async () => {
    // given
    const { knowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createKnowledgeServiceTests();
    const query = createRandomString();
    const passages = [createRandomString(), createRandomString()];
    knowledgeBrokerMock.selectKnowledge.mockResolvedValue(passages);

    const expectedResults: KnowledgeResult[] = passages.map((passage) => ({
      text: passage,
      score: null,
      source: "",
    }));

    // when
    const actualResults = await knowledgeService.retrieveSourced(query);

    // then
    expect(actualResults).toEqual(expectedResults);
    expect(knowledgeBrokerMock.selectKnowledge).toHaveBeenCalledWith(query);
    verifyNoOtherCalls(knowledgeBrokerMock, { selectKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRetrieveTheSamePassagesWithoutTheirSourcesFromASourcedBrokerAsync", async () => {
    // given
    const { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createSourcedKnowledgeServiceTests();
    const query = createRandomString();

    const results: KnowledgeResult[] = [
      { text: createRandomString(), score: 0.7, source: createRandomString() },
      { text: createRandomString(), score: 0.4, source: createRandomString() },
    ];

    sourcedKnowledgeBrokerMock.selectSourcedKnowledge.mockResolvedValue(results);

    // when
    const actualPassages = await knowledgeService.retrieve(query);

    // then
    expect(actualPassages).toEqual(results.map((result) => result.text));
    verifyNoOtherCalls(sourcedKnowledgeBrokerMock, { selectSourcedKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });
});
