import { describe, expect, it } from "vitest";


import { createDataCoordinationServiceTests, createRandomString, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService retrieveRemoteTools logic", () => {
  it("ShouldRetrieveRemoteToolsAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const expectedTools = [{ name: createRandomString(), description: createRandomString(), inputSchemaJson: "{}" }];
    retrievalOrchestrationServiceMock.retrieveRemoteTools.mockResolvedValue(expectedTools);

    // when
    const actualTools = await dataCoordinationService.retrieveRemoteTools();

    // then
    expect(actualTools).toEqual(expectedTools);
    verifyNoOtherCalls(retrievalOrchestrationServiceMock, { retrieveRemoteTools: 1 });
    verifyNoOtherCalls(recollectionOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
