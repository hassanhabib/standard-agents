import { describe, expect, it } from "vitest";

import { FailedGateServiceException } from "../../../models/foundations/gates/exceptions/FailedGateServiceException.js";
import { GateServiceException } from "../../../models/foundations/gates/exceptions/GateServiceException.js";
import { createGateServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./GateServiceTests.js";

describe("GateService screen exceptions", () => {
  it("ShouldThrowServiceExceptionOnScreenIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { classifierBrokerMock, loggingBrokerMock, gateService } = createGateServiceTests();
    const serviceException = new Error(createRandomString());

    const failedGateServiceException = new FailedGateServiceException(
      "Failed gate service error occurred, contact support.",
      serviceException,
    );

    const expectedGateServiceException = new GateServiceException(
      "Gate service error occurred, contact support.",
      failedGateServiceException,
    );

    classifierBrokerMock.classify.mockRejectedValue(serviceException);

    // when
    const screenTask = gateService.screen(createRandomString());

    // then
    const actualException = await screenTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(GateServiceException);
    expectSameExceptionAs(actualException, expectedGateServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedGateServiceException);
    verifyNoOtherCalls(classifierBrokerMock, { classify: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
