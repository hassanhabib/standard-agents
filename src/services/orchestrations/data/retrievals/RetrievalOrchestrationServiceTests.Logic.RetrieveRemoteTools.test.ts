import { describe, expect, it } from "vitest";


import { createRandomTool, createRetrievalOrchestrationServiceTests, verifyNoOtherCalls } from "./RetrievalOrchestrationServiceTests.js";

describe("RetrievalOrchestrationService retrieveRemoteTools logic", () => {
  it("ShouldRetrieveRemoteToolsOnceAsync", async () => {
    // given
    const { skillServiceMock, knowledgeServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const expectedTools = [createRandomTool(), createRandomTool("")];
    externalToolServiceMock.retrieveTools.mockResolvedValue(expectedTools);

    // when
    const firstTools = await retrievalOrchestrationService.retrieveRemoteTools();
    const secondTools = await retrievalOrchestrationService.retrieveRemoteTools();

    // then
    expect(firstTools).toEqual(expectedTools);
    expect(secondTools).toEqual(expectedTools);
    verifyNoOtherCalls(externalToolServiceMock, { retrieveTools: 1 });
    verifyNoOtherCalls(skillServiceMock);
    verifyNoOtherCalls(knowledgeServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
