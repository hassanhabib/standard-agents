import { describe, expect, it } from "vitest";

import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { createPerimeterOrchestrationServiceTests, createRandomEffect, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./PerimeterOrchestrationServiceTests.js";

describe("PerimeterOrchestrationService claim exceptions", () => {
  it("ShouldThrowServiceExceptionOnClaimIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService } =
      createPerimeterOrchestrationServiceTests();

    const serviceException = new Error(createRandomString());

    const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
      "Failed agent orchestration service error occurred, contact support.",
      serviceException,
    );

    const expectedAgentOrchestrationServiceException = new AgentOrchestrationServiceException(
      "Agent orchestration service error occurred, contact support.",
      failedAgentOrchestrationServiceException,
    );

    effectLedgerServiceMock.claim.mockRejectedValue(serviceException);

    // when
    const claimTask = perimeterOrchestrationService.claim(createRandomEffect());

    // then
    const actualException = await claimTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationServiceException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationServiceException);
    verifyNoOtherCalls(effectLedgerServiceMock, { claim: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
