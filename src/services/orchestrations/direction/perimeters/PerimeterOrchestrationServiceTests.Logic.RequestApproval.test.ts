import { describe, expect, it } from "vitest";


import { createPerimeterOrchestrationServiceTests, createRandomEffect, verifyNoOtherCalls } from "./PerimeterOrchestrationServiceTests.js";

describe("PerimeterOrchestrationService requestApproval logic", () => {
  it("ShouldRequestApprovalAndRecordApprovedAsync", async () => {
    // given
    const { policyServiceMock, approvalServiceMock, effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    approvalServiceMock.requestApproval.mockResolvedValue("Approved");

    // when
    const actualVerdict = await perimeterOrchestrationService.requestApproval(effect);

    // then
    expect(actualVerdict).toBe("Approved");
    expect(approvalServiceMock.requestApproval).toHaveBeenCalledWith(effect);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Approval -> APPROVED '${effect.toolName}'`);
    verifyNoOtherCalls(approvalServiceMock, { requestApproval: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
    verifyNoOtherCalls(policyServiceMock);
    verifyNoOtherCalls(effectLedgerServiceMock);
  });

  it("ShouldRequestApprovalAndSayNothingWhenNotApprovedAsync", async () => {
    // given
    const { approvalServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    approvalServiceMock.requestApproval.mockResolvedValue("Pending");

    // when
    const actualVerdict = await perimeterOrchestrationService.requestApproval(createRandomEffect());

    // then
    expect(actualVerdict).toBe("Pending");
    verifyNoOtherCalls(approvalServiceMock, { requestApproval: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
