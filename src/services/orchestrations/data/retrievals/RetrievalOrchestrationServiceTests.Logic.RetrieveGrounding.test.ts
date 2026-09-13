import { describe, expect, it } from "vitest";


import { createRandomString, createRetrievalOrchestrationServiceTests, verifyNoOtherCalls } from "./RetrievalOrchestrationServiceTests.js";

describe("RetrievalOrchestrationService retrieveGrounding logic", () => {
  it("ShouldRetrieveGroundingAsync", async () => {
    // given
    const { skillServiceMock, knowledgeServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const query = createRandomString();
    const expectedPassages = [createRandomString(), createRandomString()];
    knowledgeServiceMock.retrieve.mockResolvedValue(expectedPassages);

    // when
    const actualPassages = await retrievalOrchestrationService.retrieveGrounding(query);

    // then
    expect(actualPassages).toEqual(expectedPassages);
    expect(knowledgeServiceMock.retrieve).toHaveBeenCalledWith(query);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Data", "Retrieved 2 knowledge matches");
    verifyNoOtherCalls(knowledgeServiceMock, { retrieve: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
    verifyNoOtherCalls(skillServiceMock);
    verifyNoOtherCalls(externalToolServiceMock);
  });

});
