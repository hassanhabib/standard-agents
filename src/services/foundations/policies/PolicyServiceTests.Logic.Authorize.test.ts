import { describe, expect, it } from "vitest";

import { deny } from "../../../models/orchestrations/effects/AuthorizationDecision.js";
import { createPolicyServiceTests, createRandomEffect, createRandomString, verifyNoOtherCalls } from "./PolicyServiceTests.js";

describe("PolicyService authorize logic", () => {
  it("ShouldAuthorizeEffectAsync", async () => {
    // given
    const { policyBrokerMock, loggingBrokerMock, policyService } = createPolicyServiceTests();
    const effect = createRandomEffect();
    const expectedDecision = deny(createRandomString());
    policyBrokerMock.authorize.mockResolvedValue(expectedDecision);

    // when
    const actualDecision = await policyService.authorize(effect);

    // then
    expect(actualDecision).toEqual(expectedDecision);
    expect(policyBrokerMock.authorize).toHaveBeenCalledWith(effect);
    verifyNoOtherCalls(policyBrokerMock, { authorize: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
