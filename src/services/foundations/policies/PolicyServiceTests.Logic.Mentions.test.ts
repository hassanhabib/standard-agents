import { describe, expect, it } from "vitest";


import { createPolicyServiceTests, createRandomEffect, verifyNoOtherCalls } from "./PolicyServiceTests.js";

describe("PolicyService mentions logic", () => {
  it("ShouldSayWhetherPolicyMentionsEffectAsync", async () => {
    // given
    const { policyBrokerMock, loggingBrokerMock, policyService } = createPolicyServiceTests();
    const effect = createRandomEffect();
    policyBrokerMock.mentions.mockReturnValue(true);

    // when
    const actualMentioned = await policyService.mentions(effect);

    // then
    expect(actualMentioned).toBe(true);
    expect(policyBrokerMock.mentions).toHaveBeenCalledWith(effect);
    verifyNoOtherCalls(policyBrokerMock, { mentions: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
