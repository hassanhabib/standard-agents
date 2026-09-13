import { describe, expect, it } from "vitest";


import { createKnowledgeServiceTests, createRandomString, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve logic", () => {
  it("ShouldRetrieveKnowledgeAsync", async () => {
    // given
    const { knowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createKnowledgeServiceTests();
    const query = createRandomString();
    const expectedPassages = [createRandomString(), createRandomString()];
    knowledgeBrokerMock.selectKnowledge.mockResolvedValue(expectedPassages);

    // when
    const actualPassages = await knowledgeService.retrieve(query);

    // then
    expect(actualPassages).toEqual(expectedPassages);
    expect(knowledgeBrokerMock.selectKnowledge).toHaveBeenCalledWith(query);
    verifyNoOtherCalls(knowledgeBrokerMock, { selectKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
