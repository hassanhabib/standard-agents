import { describe, expect, it } from "vitest";


import { createRandomSession, createRandomString, createRecollectionOrchestrationServiceTests, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService recallSession logic", () => {
  it("ShouldRecallSessionAsync", async () => {
    // given
    const { memoryServiceMock, sessionServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const sessionId = createRandomString();
    const expectedSession = createRandomSession();
    sessionServiceMock.retrieve.mockResolvedValue(expectedSession);

    // when
    const actualSession = await recollectionOrchestrationService.recallSession(sessionId);

    // then
    expect(actualSession).toEqual(expectedSession);
    expect(sessionServiceMock.retrieve).toHaveBeenCalledWith(sessionId);
    verifyNoOtherCalls(sessionServiceMock, { retrieve: 1 });
    verifyNoOtherCalls(memoryServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
