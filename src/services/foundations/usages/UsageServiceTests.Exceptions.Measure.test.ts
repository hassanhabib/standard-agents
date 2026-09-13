import { describe, expect, it } from "vitest";

import { FailedUsageServiceException } from "../../../models/foundations/usages/exceptions/FailedUsageServiceException.js";
import { UsageServiceException } from "../../../models/foundations/usages/exceptions/UsageServiceException.js";
import { createRandomString, createUsageServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./UsageServiceTests.js";

describe("UsageService measure exceptions", () => {
  it("ShouldThrowServiceExceptionOnMeasureIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { usageBrokerMock, loggingBrokerMock, usageService } = createUsageServiceTests();
    const serviceException = new Error(createRandomString());

    const failedUsageServiceException = new FailedUsageServiceException(
      "Failed usage service error occurred, contact support.",
      serviceException,
    );

    const expectedUsageServiceException = new UsageServiceException(
      "Usage service error occurred, contact support.",
      failedUsageServiceException,
    );

    usageBrokerMock.countTokens.mockRejectedValue(serviceException);

    // when
    const measureTask = usageService.measure(createRandomString(), createRandomString());

    // then
    const actualException = await measureTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(UsageServiceException);
    expectSameExceptionAs(actualException, expectedUsageServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedUsageServiceException);
    verifyNoOtherCalls(usageBrokerMock, { countTokens: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
