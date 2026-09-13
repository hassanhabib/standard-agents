import { describe, expect, it } from "vitest";


import { createApprovalServiceTests, createRandomEffect, verifyNoOtherCalls } from "./ApprovalServiceTests.js";

describe("ApprovalService requestApproval logic", () => {
  it("ShouldRequestApprovalAsync", async () => {
    // given
    const { approvalBrokerMock, loggingBrokerMock, approvalService } = createApprovalServiceTests();
    const effect = createRandomEffect();
    approvalBrokerMock.request.mockResolvedValue("Denied");

    // when
    const actualVerdict = await approvalService.requestApproval(effect);

    // then
    expect(actualVerdict).toBe("Denied");
    expect(approvalBrokerMock.request).toHaveBeenCalledWith(effect);
    verifyNoOtherCalls(approvalBrokerMock, { request: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
