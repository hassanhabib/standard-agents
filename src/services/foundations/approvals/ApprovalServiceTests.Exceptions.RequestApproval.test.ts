import { describe, expect, it } from "vitest";

import { FailedApprovalServiceException } from "../../../models/foundations/approvals/exceptions/FailedApprovalServiceException.js";
import { ApprovalServiceException } from "../../../models/foundations/approvals/exceptions/ApprovalServiceException.js";
import { createApprovalServiceTests, createRandomEffect, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ApprovalServiceTests.js";

describe("ApprovalService requestApproval exceptions", () => {
  it("ShouldThrowServiceExceptionOnRequestApprovalIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { approvalBrokerMock, loggingBrokerMock, approvalService } = createApprovalServiceTests();
    const serviceException = new Error(createRandomString());

    const failedApprovalServiceException = new FailedApprovalServiceException(
      "Failed approval service error occurred, contact support.",
      serviceException,
    );

    const expectedApprovalServiceException = new ApprovalServiceException(
      "Approval service error occurred, contact support.",
      failedApprovalServiceException,
    );

    approvalBrokerMock.request.mockRejectedValue(serviceException);

    // when
    const requestTask = approvalService.requestApproval(createRandomEffect());

    // then
    const actualException = await requestTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(ApprovalServiceException);
    expectSameExceptionAs(actualException, expectedApprovalServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedApprovalServiceException);
    verifyNoOtherCalls(approvalBrokerMock, { request: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
