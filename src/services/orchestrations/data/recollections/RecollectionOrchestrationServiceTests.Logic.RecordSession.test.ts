import { describe, expect, it } from "vitest";


import { createRandomSession, createRecollectionOrchestrationServiceTests, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService recordSession logic", () => {
  it("ShouldRecordSessionAsync", async () => {
    // given
    const { memoryServiceMock, sessionServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const session = createRandomSession();
    sessionServiceMock.record.mockResolvedValue(undefined);

    // when
    await recollectionOrchestrationService.recordSession(session);

    // then
    expect(sessionServiceMock.record).toHaveBeenCalledWith(session);
    verifyNoOtherCalls(sessionServiceMock, { record: 1 });
    verifyNoOtherCalls(memoryServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
