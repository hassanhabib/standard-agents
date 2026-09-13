import { describe, expect, it } from "vitest";

import { AgentRun } from "../../../../models/loggings/AgentRun.js";
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

  it("ShouldAnswerTheHeldActFromTheDecisionCarriedOnTheRunAsync", async () => {
    // given
    // A run that was held, closed, and started again with the authority's answer travelling on
    // the request. The window that asked is long gone; what is left is the answer and the key it
    // was given for.
    const { approvalServiceMock, perimeterOrchestrationService } = createPerimeterOrchestrationServiceTests();
    const effect = createRandomEffect();

    // when
    const actualVerdict = await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.decision = { idempotencyKey: effect.idempotencyKey, decision: "Approved" };
      }

      return await perimeterOrchestrationService.requestApproval(effect);
    });

    // then
    // Answered from the decision, and nobody asked again. A resumed run that asked a second time
    // would be a run that cannot be resumed anywhere nobody is sitting: in a terminal that has
    // exited, in a window that was closed, in a script.
    expect(actualVerdict).toBe("Approved");
    verifyNoOtherCalls(approvalServiceMock);
  });

});
