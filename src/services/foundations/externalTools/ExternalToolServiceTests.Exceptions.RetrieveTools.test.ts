import { describe, expect, it } from "vitest";

import { ExternalToolDependencyException } from "../../../models/foundations/externalTools/exceptions/ExternalToolDependencyException.js";
import { FailedExternalToolDependencyException } from "../../../models/foundations/externalTools/exceptions/FailedExternalToolDependencyException.js";
import { createExternalToolServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ExternalToolServiceTests.js";

describe("ExternalToolService retrieveTools exceptions", () => {
  it("ShouldThrowDependencyExceptionOnRetrieveToolsIfDependencyErrorOccursAndLogItAsync", async () => {
    // given
    const { mcpBrokerMock, loggingBrokerMock, externalToolService } = createExternalToolServiceTests();
    const dependencyException = new Error(createRandomString());

    const failedExternalToolDependencyException = new FailedExternalToolDependencyException(
      "Failed external tool dependency error occurred, contact support.",
      dependencyException,
    );

    const expectedExternalToolDependencyException = new ExternalToolDependencyException(
      "External tool dependency error occurred, contact support.",
      failedExternalToolDependencyException,
    );

    mcpBrokerMock.listTools.mockRejectedValue(dependencyException);

    // when
    const retrieveTask = externalToolService.retrieveTools();

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(ExternalToolDependencyException);
    expectSameExceptionAs(actualException, expectedExternalToolDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedExternalToolDependencyException);
    verifyNoOtherCalls(mcpBrokerMock, { listTools: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
