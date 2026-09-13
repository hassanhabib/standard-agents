import { describe, expect, it } from "vitest";


import { createRandomSession, createRandomString, createSessionServiceTests, verifyNoOtherCalls } from "./SessionServiceTests.js";

describe("SessionService retrieve logic", () => {
  it("ShouldRetrieveSessionAsync", async () => {
    // given
    const { sessionBrokerMock, loggingBrokerMock, sessionService } = createSessionServiceTests();
    const sessionId = createRandomString();
    const expectedSession = createRandomSession();
    sessionBrokerMock.selectSession.mockResolvedValue(expectedSession);

    // when
    const actualSession = await sessionService.retrieve(sessionId);

    // then
    expect(actualSession).toEqual(expectedSession);
    expect(sessionBrokerMock.selectSession).toHaveBeenCalledWith(sessionId);
    verifyNoOtherCalls(sessionBrokerMock, { selectSession: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
