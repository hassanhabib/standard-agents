import { describe, expect, it } from "vitest";

import { InvalidSessionException } from "../../../models/foundations/sessions/exceptions/InvalidSessionException.js";
import { SessionValidationException } from "../../../models/foundations/sessions/exceptions/SessionValidationException.js";
import { createSessionServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./SessionServiceTests.js";

describe("SessionService retrieve validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnRetrieveIfIdIsInvalidAndLogItAsync (%j)", async (invalidSessionId) => {
    // given
    const { sessionBrokerMock, loggingBrokerMock, sessionService } = createSessionServiceTests();

    const invalidSessionException = new InvalidSessionException(
      "Invalid session id. Please correct the error and try again.",
    );

    const expectedSessionValidationException = new SessionValidationException(
      "Session validation error occurred, fix the error and try again.",
      invalidSessionException,
    );

    // when
    const retrieveTask = sessionService.retrieve(invalidSessionId);

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(SessionValidationException);
    expectSameExceptionAs(actualException, expectedSessionValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSessionValidationException);
    verifyNoOtherCalls(sessionBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
