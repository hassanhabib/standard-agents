import { describe, expect, it } from "vitest";

import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { NullSessionException } from "../../../models/foundations/sessions/exceptions/NullSessionException.js";
import { SessionValidationException } from "../../../models/foundations/sessions/exceptions/SessionValidationException.js";
import { createSessionServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./SessionServiceTests.js";

describe("SessionService record validations", () => {
  it("ShouldThrowValidationExceptionOnRecordIfSessionIsNullAndLogItAsync", async () => {
    // given
    const { sessionBrokerMock, loggingBrokerMock, sessionService } = createSessionServiceTests();
    const nullSession = null as unknown as AgentSession;
    const nullSessionException = new NullSessionException("Session is null.");

    const expectedSessionValidationException = new SessionValidationException(
      "Session validation error occurred, fix the error and try again.",
      nullSessionException,
    );

    // when
    const recordTask = sessionService.record(nullSession);

    // then
    const actualException = await recordTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(SessionValidationException);
    expectSameExceptionAs(actualException, expectedSessionValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSessionValidationException);
    verifyNoOtherCalls(sessionBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
