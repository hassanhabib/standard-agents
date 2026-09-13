import { describe, expect, it } from "vitest";

import { FailedInternalToolServiceException } from "../../../models/foundations/internalTools/exceptions/FailedInternalToolServiceException.js";
import { InternalToolServiceException } from "../../../models/foundations/internalTools/exceptions/InternalToolServiceException.js";
import { createInternalToolServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./InternalToolServiceTests.js";

describe("InternalToolService handles exceptions", () => {
  it("ShouldThrowServiceExceptionOnHandlesIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { toolBrokerMock, loggingBrokerMock, internalToolService } = createInternalToolServiceTests();
    const serviceException = new Error(createRandomString());

    const failedInternalToolServiceException = new FailedInternalToolServiceException(
      "Failed internal tool service error occurred, contact support.",
      serviceException,
    );

    const expectedInternalToolServiceException = new InternalToolServiceException(
      "Internal tool service error occurred, contact support.",
      failedInternalToolServiceException,
    );

    toolBrokerMock.has.mockRejectedValue(serviceException);

    // when
    const handlesTask = internalToolService.handles(createRandomString());

    // then
    const actualException = await handlesTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(InternalToolServiceException);
    expectSameExceptionAs(actualException, expectedInternalToolServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedInternalToolServiceException);
    verifyNoOtherCalls(toolBrokerMock, { has: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
