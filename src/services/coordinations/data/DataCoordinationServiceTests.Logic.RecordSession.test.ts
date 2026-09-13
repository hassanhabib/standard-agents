import { describe, expect, it } from "vitest";


import { createDataCoordinationServiceTests, createRandomSession, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService recordSession logic", () => {
  it("ShouldRecordSessionAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const session = createRandomSession();
    recollectionOrchestrationServiceMock.recordSession.mockResolvedValue(undefined);

    // when
    await dataCoordinationService.recordSession(session);

    // then
    expect(recollectionOrchestrationServiceMock.recordSession).toHaveBeenCalledWith(session);
    verifyNoOtherCalls(recollectionOrchestrationServiceMock, { recordSession: 1 });
    verifyNoOtherCalls(retrievalOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
