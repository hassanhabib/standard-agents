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


  it("ShouldNotLetADecisionForOneActAnswerAnotherAsync", async () => {
    // given
    // An answer given for one act, and a different act asking. The two are only ever the same
    // thing if nobody checks, and what a person approved was a file, a command, a deletion, not
    // whatever the run happened to propose next.
    const { approvalServiceMock, perimeterOrchestrationService } = createPerimeterOrchestrationServiceTests();
    const answered = createRandomEffect();
    const asking = createRandomEffect();
    approvalServiceMock.requestApproval.mockResolvedValue("Pending");

    // when
    const actualVerdict = await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.decision = { idempotencyKey: answered.idempotencyKey, decision: "Approved" };
      }

      return await perimeterOrchestrationService.requestApproval(asking);
    });

    // then
    // Asked, not assumed. The decision is matched by the key it was given for and this is not it.
    expect(actualVerdict).toBe("Pending");
    expect(approvalServiceMock.requestApproval).toHaveBeenCalledWith(asking);
  });

});
