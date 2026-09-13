import { describe, expect, it } from "vitest";


import { createPerimeterOrchestrationServiceTests, createRandomEffect, createRandomRecord, createRandomString, verifyNoOtherCalls } from "./PerimeterOrchestrationServiceTests.js";

describe("PerimeterOrchestrationService record logic", () => {
  it("ShouldRecordOutcomeAsync", async () => {
    // given
    const { policyServiceMock, approvalServiceMock, effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    const outcome = createRandomString();
    effectLedgerServiceMock.recordOutcome.mockResolvedValue(createRandomRecord());

    // when
    await perimeterOrchestrationService.recordOutcome(effect, outcome);

    // then
    expect(effectLedgerServiceMock.recordOutcome).toHaveBeenCalledWith(effect.idempotencyKey, outcome);
    verifyNoOtherCalls(effectLedgerServiceMock, { recordOutcome: 1 });
    verifyNoOtherCalls(policyServiceMock);
    verifyNoOtherCalls(approvalServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRecordFailureAsync", async () => {
    // given
    const { effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    const detail = createRandomString();
    effectLedgerServiceMock.recordFailure.mockResolvedValue(createRandomRecord());

    // when
    await perimeterOrchestrationService.recordFailure(effect, detail);

    // then
    expect(effectLedgerServiceMock.recordFailure).toHaveBeenCalledWith(effect.idempotencyKey, detail);
    verifyNoOtherCalls(effectLedgerServiceMock, { recordFailure: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldReleaseClaimAsync", async () => {
    // given
    const { effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    effectLedgerServiceMock.releaseClaim.mockResolvedValue(undefined);

    // when
    await perimeterOrchestrationService.releaseClaim(effect);

    // then
    expect(effectLedgerServiceMock.releaseClaim).toHaveBeenCalledWith(effect.idempotencyKey);
    verifyNoOtherCalls(effectLedgerServiceMock, { releaseClaim: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
