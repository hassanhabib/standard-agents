import { describe, expect, it } from "vitest";

import { StaleSessionWriteError } from "../../../models/brokers/sessions/StaleSessionWriteError.js";
import { FailedSessionServiceException } from "../../../models/foundations/sessions/exceptions/FailedSessionServiceException.js";
import { SessionDependencyValidationException } from "../../../models/foundations/sessions/exceptions/SessionDependencyValidationException.js";
import { SessionServiceException } from "../../../models/foundations/sessions/exceptions/SessionServiceException.js";
import { StaleSessionException } from "../../../models/foundations/sessions/exceptions/StaleSessionException.js";
import { createRandomSession, createRandomString, createSessionServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./SessionServiceTests.js";

describe("SessionService record exceptions", () => {
  it("ShouldThrowDependencyValidationExceptionOnRecordIfWriteIsStaleAndLogItAsync", async () => {
    // given
    const { sessionBrokerMock, loggingBrokerMock, sessionService } = createSessionServiceTests();
    const session = createRandomSession();
    const staleSessionWriteError = new StaleSessionWriteError(session.id, session.version + 1, session.version);

    const staleSessionException = new StaleSessionException(
      "Stale session write. The session changed since it was read; read it again and retry.",
    );

    staleSessionException.upsertDataList("sessionId", session.id);
    staleSessionException.upsertDataList("storedVersion", String(session.version + 1));
    staleSessionException.upsertDataList("attemptedVersion", String(session.version));

    const expectedSessionDependencyValidationException = new SessionDependencyValidationException(
      "Session dependency validation error occurred, fix the error and try again.",
      staleSessionException,
    );

    sessionBrokerMock.upsertSession.mockRejectedValue(staleSessionWriteError);

    // when
    const recordTask = sessionService.record(session);

    // then
    const actualException = await recordTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(SessionDependencyValidationException);
    expectSameExceptionAs(actualException, expectedSessionDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSessionDependencyValidationException);
    verifyNoOtherCalls(sessionBrokerMock, { upsertSession: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowServiceExceptionOnRecordIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { sessionBrokerMock, loggingBrokerMock, sessionService } = createSessionServiceTests();
    const serviceException = new Error(createRandomString());

    const failedSessionServiceException = new FailedSessionServiceException(
      "Failed session service error occurred, contact support.",
      serviceException,
    );

    const expectedSessionServiceException = new SessionServiceException(
      "Session service error occurred, contact support.",
      failedSessionServiceException,
    );

    sessionBrokerMock.upsertSession.mockRejectedValue(serviceException);

    // when
    const recordTask = sessionService.record(createRandomSession());

    // then
    const actualException = await recordTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(SessionServiceException);
    expectSameExceptionAs(actualException, expectedSessionServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSessionServiceException);
    verifyNoOtherCalls(sessionBrokerMock, { upsertSession: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
