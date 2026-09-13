import { describe, expect, it } from "vitest";


import { DEFAULT_LEASE_MILLISECONDS, createPerimeterOrchestrationServiceTests, createRandomEffect, createRandomRecord, createRandomString, verifyNoOtherCalls } from "./PerimeterOrchestrationServiceTests.js";

describe("PerimeterOrchestrationService claim logic", () => {
  it("ShouldClaimAndProceedAsync", async () => {
    // given
    const { policyServiceMock, approvalServiceMock, effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    effectLedgerServiceMock.claim.mockResolvedValue(true);

    // when
    const actualClaim = await perimeterOrchestrationService.claim(effect);

    // then
    expect(actualClaim).toEqual({ verdict: "Proceed", outcome: null, record: null });
    expect(effectLedgerServiceMock.claim).toHaveBeenCalledWith(effect, effect.runId, DEFAULT_LEASE_MILLISECONDS);
    verifyNoOtherCalls(effectLedgerServiceMock, { claim: 1 });
    verifyNoOtherCalls(policyServiceMock);
    verifyNoOtherCalls(approvalServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldReplayCompletedClaimAsync", async () => {
    // given
    const { effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    const outcome = createRandomString();
    const priorRecord = createRandomRecord({ idempotencyKey: effect.idempotencyKey, state: "Completed", outcome });
    effectLedgerServiceMock.claim.mockResolvedValue(false);
    effectLedgerServiceMock.retrieveRecord.mockResolvedValue(priorRecord);

    // when
    const actualClaim = await perimeterOrchestrationService.claim(effect);

    // then
    expect(actualClaim).toEqual({ verdict: "Replay", outcome, record: priorRecord });
    expect(effectLedgerServiceMock.retrieveRecord).toHaveBeenCalledWith(effect.idempotencyKey);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Run-once -> '${effect.toolName}' already ran; replaying its outcome`);
    verifyNoOtherCalls(effectLedgerServiceMock, { claim: 1, retrieveRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
  });

  it("ShouldReportInProgressClaimHeldLiveByAnotherRunAsync", async () => {
    // given
    const currentDateTime = new Date();

    const { effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests(currentDateTime);

    const effect = createRandomEffect();

    const priorRecord = createRandomRecord({
      idempotencyKey: effect.idempotencyKey,
      state: "InFlight",
      owner: createRandomString(),
      leaseUntil: new Date(currentDateTime.getTime() + 1),
    });

    effectLedgerServiceMock.claim.mockResolvedValue(false);
    effectLedgerServiceMock.retrieveRecord.mockResolvedValue(priorRecord);

    // when
    const actualClaim = await perimeterOrchestrationService.claim(effect);

    // then
    expect(actualClaim).toEqual({ verdict: "InProgress", outcome: null, record: priorRecord });
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Run-once -> '${effect.toolName}' is in progress in another run; not performed`);
    verifyNoOtherCalls(effectLedgerServiceMock, { claim: 1, retrieveRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
  });

  it.each([
    { title: "this run's own earlier attempt", ownRun: true, state: "InFlight" as const, leaseOffset: 1 },
    { title: "a claim past its lease", ownRun: false, state: "InFlight" as const, leaseOffset: -1 },
    { title: "a failed tool", ownRun: false, state: "Failed" as const, leaseOffset: 1 },
  ])("ShouldHoldUnreconciledClaimAsync ($title)", async ({ ownRun, state, leaseOffset }) => {
    // given
    const currentDateTime = new Date();

    const { effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests(currentDateTime);

    const effect = createRandomEffect();

    const priorRecord = createRandomRecord({
      idempotencyKey: effect.idempotencyKey,
      state,
      owner: ownRun ? effect.runId : createRandomString(),
      leaseUntil: new Date(currentDateTime.getTime() + leaseOffset),
    });

    effectLedgerServiceMock.claim.mockResolvedValue(false);
    effectLedgerServiceMock.retrieveRecord.mockResolvedValue(priorRecord);

    // when
    const actualClaim = await perimeterOrchestrationService.claim(effect);

    // then
    expect(actualClaim).toEqual({ verdict: "Unreconciled", outcome: null, record: priorRecord });

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Direction",
      `Run-once -> '${effect.toolName}' has an earlier attempt with no usable outcome (${state}); held for reconciliation`,
    );

    verifyNoOtherCalls(effectLedgerServiceMock, { claim: 1, retrieveRecord: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
  });

});
