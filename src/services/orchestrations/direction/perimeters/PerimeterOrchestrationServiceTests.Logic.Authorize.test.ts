import { describe, expect, it } from "vitest";

import { allow, deny } from "../../../../models/orchestrations/effects/AuthorizationDecision.js";
import { createPerimeterOrchestrationServiceTests, createRandomEffect, createRandomString, verifyNoOtherCalls } from "./PerimeterOrchestrationServiceTests.js";

describe("PerimeterOrchestrationService authorize logic", () => {
  it("ShouldAuthorizePermittedEffectAsync", async () => {
    // given
    const { policyServiceMock, approvalServiceMock, effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    policyServiceMock.authorize.mockResolvedValue(allow());

    // when
    const actualDecision = await perimeterOrchestrationService.authorize(effect);

    // then
    expect(actualDecision).toEqual(allow());
    expect(policyServiceMock.authorize).toHaveBeenCalledWith(effect);
    verifyNoOtherCalls(policyServiceMock, { authorize: 1 });
    verifyNoOtherCalls(approvalServiceMock);
    verifyNoOtherCalls(effectLedgerServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRecordDenialOnAuthorizeIfPolicyDeniesAsync", async () => {
    // given
    const { policyServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const effect = createRandomEffect();
    const reason = createRandomString();
    policyServiceMock.authorize.mockResolvedValue(deny(reason));

    // when
    const actualDecision = await perimeterOrchestrationService.authorize(effect);

    // then
    expect(actualDecision).toEqual(deny(reason));
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Policy -> DENIED '${effect.toolName}': ${reason}`);
    verifyNoOtherCalls(policyServiceMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
  });

});
