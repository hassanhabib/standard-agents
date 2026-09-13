import { describe, expect, it } from "vitest";

import { SessionDependencyValidationException } from "../../../../models/foundations/sessions/exceptions/SessionDependencyValidationException.js";
import { StaleSessionException } from "../../../../models/foundations/sessions/exceptions/StaleSessionException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { createRandomSession, createRandomString, createRecollectionOrchestrationServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./RecollectionOrchestrationServiceTests.js";

describe("RecollectionOrchestrationService recordSession exceptions", () => {
  it("ShouldThrowDependencyValidationExceptionOnRecordSessionIfWriteIsStaleAndLogItAsync", async () => {
    // given
    const { sessionServiceMock, loggingBrokerMock, recollectionOrchestrationService } =
      createRecollectionOrchestrationServiceTests();

    const session = createRandomSession();
    const staleSessionException = new StaleSessionException(createRandomString());
    staleSessionException.upsertDataList("sessionId", session.id);
    const sessionDependencyValidationException = new SessionDependencyValidationException(createRandomString(), staleSessionException);

    const expectedAgentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
      "Agent orchestration dependency validation error occurred, fix the error and try again.",
      staleSessionException,
    );

    sessionServiceMock.record.mockRejectedValue(sessionDependencyValidationException);

    // when
    const recordTask = recollectionOrchestrationService.recordSession(session);

    // then
    const actualException = await recordTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(actualException, expectedAgentOrchestrationDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentOrchestrationDependencyValidationException);
    verifyNoOtherCalls(sessionServiceMock, { record: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
