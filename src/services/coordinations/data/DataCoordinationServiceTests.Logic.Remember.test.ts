import { describe, expect, it } from "vitest";


import { createDataCoordinationServiceTests, createRandomString, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService remember logic", () => {
  it("ShouldRememberAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const memory = createRandomString();
    recollectionOrchestrationServiceMock.remember.mockResolvedValue(undefined);

    // when
    await dataCoordinationService.remember(memory);

    // then
    expect(recollectionOrchestrationServiceMock.remember).toHaveBeenCalledWith(memory);
    verifyNoOtherCalls(recollectionOrchestrationServiceMock, { remember: 1 });
    verifyNoOtherCalls(retrievalOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
