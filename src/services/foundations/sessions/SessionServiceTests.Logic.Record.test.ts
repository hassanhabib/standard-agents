import { describe, expect, it } from "vitest";


import { createRandomSession, createSessionServiceTests, verifyNoOtherCalls } from "./SessionServiceTests.js";

describe("SessionService record logic", () => {
  it("ShouldRecordSessionAsync", async () => {
    // given
    const { sessionBrokerMock, loggingBrokerMock, sessionService } = createSessionServiceTests();
    const session = createRandomSession();
    sessionBrokerMock.upsertSession.mockResolvedValue(undefined);

    // when
    await sessionService.record(session);

    // then
    expect(sessionBrokerMock.upsertSession).toHaveBeenCalledWith(session);
    verifyNoOtherCalls(sessionBrokerMock, { upsertSession: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
