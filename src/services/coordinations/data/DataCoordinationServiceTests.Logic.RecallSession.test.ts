import { describe, expect, it } from "vitest";


import { createDataCoordinationServiceTests, createRandomSession, createRandomString, verifyNoOtherCalls } from "./DataCoordinationServiceTests.js";

describe("DataCoordinationService recallSession logic", () => {
  it("ShouldRecallSessionAsync", async () => {
    // given
    const { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService } =
      createDataCoordinationServiceTests();

    const sessionId = createRandomString();
    const expectedSession = createRandomSession();
    recollectionOrchestrationServiceMock.recallSession.mockResolvedValue(expectedSession);

    // when
    const actualSession = await dataCoordinationService.recallSession(sessionId);

    // then
    expect(actualSession).toEqual(expectedSession);
    expect(recollectionOrchestrationServiceMock.recallSession).toHaveBeenCalledWith(sessionId);
    verifyNoOtherCalls(recollectionOrchestrationServiceMock, { recallSession: 1 });
    verifyNoOtherCalls(retrievalOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
