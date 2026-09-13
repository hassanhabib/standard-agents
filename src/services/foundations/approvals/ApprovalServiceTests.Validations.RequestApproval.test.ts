import { describe, expect, it } from "vitest";

import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import { NullApprovalEffectException } from "../../../models/foundations/approvals/exceptions/NullApprovalEffectException.js";
import { ApprovalValidationException } from "../../../models/foundations/approvals/exceptions/ApprovalValidationException.js";
import { createApprovalServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./ApprovalServiceTests.js";

describe("ApprovalService requestApproval validations", () => {
  it("ShouldThrowValidationExceptionOnRequestApprovalIfEffectIsNullAndLogItAsync", async () => {
    // given
    const { approvalBrokerMock, loggingBrokerMock, approvalService } = createApprovalServiceTests();
    const nullEffect = null as unknown as AgentEffect;
    const nullApprovalEffectException = new NullApprovalEffectException("Effect is null.");

    const expectedApprovalValidationException = new ApprovalValidationException(
      "Approval validation error occurred, fix the error and try again.",
      nullApprovalEffectException,
    );

    // when
    const requestTask = approvalService.requestApproval(nullEffect);

    // then
    const actualException = await requestTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(ApprovalValidationException);
    expectSameExceptionAs(actualException, expectedApprovalValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedApprovalValidationException);
    verifyNoOtherCalls(approvalBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
