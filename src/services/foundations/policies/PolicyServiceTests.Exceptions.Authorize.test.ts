import { describe, expect, it } from "vitest";

import { FailedPolicyServiceException } from "../../../models/foundations/policies/exceptions/FailedPolicyServiceException.js";
import { PolicyServiceException } from "../../../models/foundations/policies/exceptions/PolicyServiceException.js";
import { createPolicyServiceTests, createRandomEffect, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./PolicyServiceTests.js";

describe("PolicyService authorize exceptions", () => {
  it("ShouldThrowServiceExceptionOnAuthorizeIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { policyBrokerMock, loggingBrokerMock, policyService } = createPolicyServiceTests();
    const serviceException = new Error(createRandomString());

    const failedPolicyServiceException = new FailedPolicyServiceException(
      "Failed policy service error occurred, contact support.",
      serviceException,
    );

    const expectedPolicyServiceException = new PolicyServiceException(
      "Policy service error occurred, contact support.",
      failedPolicyServiceException,
    );

    policyBrokerMock.authorize.mockRejectedValue(serviceException);

    // when
    const authorizeTask = policyService.authorize(createRandomEffect());

    // then
    const actualException = await authorizeTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(PolicyServiceException);
    expectSameExceptionAs(actualException, expectedPolicyServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedPolicyServiceException);
    verifyNoOtherCalls(policyBrokerMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
