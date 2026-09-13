import { describe, expect, it } from "vitest";

import { FailedSessionServiceException } from "../../../models/foundations/sessions/exceptions/FailedSessionServiceException.js";
import { SessionServiceException } from "../../../models/foundations/sessions/exceptions/SessionServiceException.js";
import { createRandomString, createSessionServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./SessionServiceTests.js";

describe("SessionService retrieve exceptions", () => {
  it("ShouldThrowServiceExceptionOnRetrieveIfServiceErrorOccursAndLogItAsync", async () => {
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

    sessionBrokerMock.selectSession.mockRejectedValue(serviceException);

    // when
    const retrieveTask = sessionService.retrieve(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(SessionServiceException);
    expectSameExceptionAs(actualException, expectedSessionServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSessionServiceException);
    verifyNoOtherCalls(sessionBrokerMock, { selectSession: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
