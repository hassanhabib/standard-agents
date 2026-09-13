import { describe, expect, it } from "vitest";

import { FailedInternalToolDependencyException } from "../../../models/foundations/internalTools/exceptions/FailedInternalToolDependencyException.js";
import { InternalToolDependencyException } from "../../../models/foundations/internalTools/exceptions/InternalToolDependencyException.js";
import { createInternalToolServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./InternalToolServiceTests.js";

describe("InternalToolService run exceptions", () => {
  it("ShouldThrowDependencyExceptionOnRunIfToolIsNotFoundAndLogItAsync", async () => {
    // given
    const { toolBrokerMock, loggingBrokerMock, internalToolService } = createInternalToolServiceTests();
    const notFoundException = new RangeError(createRandomString());

    const failedInternalToolDependencyException = new FailedInternalToolDependencyException(
      "Failed internal tool dependency error occurred, contact support.",
      notFoundException,
    );

    const expectedInternalToolDependencyException = new InternalToolDependencyException(
      "Internal tool dependency error occurred, contact support.",
      failedInternalToolDependencyException,
    );

    toolBrokerMock.run.mockRejectedValue(notFoundException);

    // when
    const runTask = internalToolService.run(createRandomString(), createRandomString());

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(InternalToolDependencyException);
    expectSameExceptionAs(actualException, expectedInternalToolDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedInternalToolDependencyException);
    verifyNoOtherCalls(toolBrokerMock, { run: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowDependencyExceptionOnRunIfToolErrorOccursAndLogItAsync", async () => {
    // given
    const { toolBrokerMock, loggingBrokerMock, internalToolService } = createInternalToolServiceTests();
    const toolException = new Error(createRandomString());

    const failedInternalToolDependencyException = new FailedInternalToolDependencyException(
      "Failed internal tool dependency error occurred, contact support.",
      toolException,
    );

    const expectedInternalToolDependencyException = new InternalToolDependencyException(
      "Internal tool dependency error occurred, contact support.",
      failedInternalToolDependencyException,
    );

    toolBrokerMock.run.mockRejectedValue(toolException);

    // when
    const runTask = internalToolService.run(createRandomString(), createRandomString());

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(InternalToolDependencyException);
    expectSameExceptionAs(actualException, expectedInternalToolDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedInternalToolDependencyException);
    verifyNoOtherCalls(toolBrokerMock, { run: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
