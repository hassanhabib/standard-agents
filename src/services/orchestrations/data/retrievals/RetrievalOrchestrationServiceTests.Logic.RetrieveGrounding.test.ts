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


  it("ShouldGroundNothingWhenThereIsNoQueryToGroundAsync", async () => {
    // given
    // A run that carries an answer to an act it already proposed and asks for nothing new. There
    // is no question here to look anything up for.
    const { knowledgeServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    // when
    const actualPassages = await retrievalOrchestrationService.retrieveGrounding("   ");

    // then
    // Nothing, and nobody asked. The foundation is right to refuse an empty query: nothing can be
    // grounded for one. What was wrong was handing it a question that does not exist and then
    // reporting the refusal as a failure of the run.
    expect(actualPassages).toEqual([]);
    verifyNoOtherCalls(knowledgeServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
