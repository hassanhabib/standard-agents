import { describe, expect, it } from "vitest";

import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import { NullPolicyEffectException } from "../../../models/foundations/policies/exceptions/NullPolicyEffectException.js";
import { PolicyValidationException } from "../../../models/foundations/policies/exceptions/PolicyValidationException.js";
import { createPolicyServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./PolicyServiceTests.js";

describe("PolicyService authorize validations", () => {
  it("ShouldThrowValidationExceptionOnAuthorizeIfEffectIsNullAndLogItAsync", async () => {
    // given
    const { policyBrokerMock, loggingBrokerMock, policyService } = createPolicyServiceTests();
    const nullEffect = null as unknown as AgentEffect;
    const nullPolicyEffectException = new NullPolicyEffectException("Effect is null.");

    const expectedPolicyValidationException = new PolicyValidationException(
      "Policy validation error occurred, fix the error and try again.",
      nullPolicyEffectException,
    );

    // when
    const authorizeTask = policyService.authorize(nullEffect);

    // then
    const actualException = await authorizeTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(PolicyValidationException);
    expectSameExceptionAs(actualException, expectedPolicyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedPolicyValidationException);
    verifyNoOtherCalls(policyBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
