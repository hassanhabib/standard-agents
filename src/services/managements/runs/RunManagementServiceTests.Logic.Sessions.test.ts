import { describe, expect, it } from "vitest";

import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { createPromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import { StaleSessionException } from "../../../models/foundations/sessions/exceptions/StaleSessionException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentCoordinationValidationException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationValidationException.js";
import { InvalidAgentException } from "../../../models/coordinations/agents/exceptions/InvalidAgentException.js";
import { actedResponse, createRandomSession, createRandomString, createRunManagementServiceTests, expectSameExceptionAs, recalled, thoughtAnswer, verifyNoOtherCalls } from "./RunManagementServiceTests.js";

describe("RunManagementService sessions logic", () => {
  it("ShouldCheckpointAndRecordTheSessionAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const sessionId = createRandomString();
    const prompt = createRandomString();
    const answer = createRandomString();
    let runId = "";
    const begun = createRandomSession({ id: sessionId, history: [], status: "Working", version: 1 });
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(begun);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, answer));

    directionCoordinationServiceMock.act.mockImplementation(async (context) => {
      runId = AgentRun.current()?.id ?? "";

      return actedResponse(context);
    });

    // when
    await runManagementService.run(createPromptRequest(prompt, sessionId));

    // then
    expect(dataCoordinationServiceMock.recordSession).toHaveBeenNthCalledWith(1, {
      id: sessionId,
      history: [],
      status: "Working",
      pendingQuestion: "",
      pendingEffect: null,
      runId,
      owner: "",
      version: 1,
    });

    expect(dataCoordinationServiceMock.recordSession).toHaveBeenNthCalledWith(2, {
      id: sessionId,
      // The moment it was written has a test of its own below; here it is only asserted to be
      // there, because this test is about the shape of the two writes and not about the clock.
      history: [{ prompt, answer, exchanges: [], recordedOn: expect.any(String) as unknown as string }],
      status: "Responded",
      pendingQuestion: "",
      pendingEffect: null,
      runId,
      owner: "",
      version: 2,
    });

    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1, recallSession: 3, recordSession: 2 });
  });

  it("ShouldRecordWhenTheTurnWasWrittenAsync", async () => {
    // given
    // The clock the run was given, rather than the one on the wall: a service that read the wall
    // clock is a service no test can ever place at a particular moment.
    const clock = { now: new Date("2026-09-13T09:41:00.000Z") };

    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests({}, clock);

    const sessionId = createRandomString();
    const answer = createRandomString();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(null);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, answer));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.run(createPromptRequest(createRandomString(), sessionId));

    // then
    // A turn that does not know when it happened is a turn a person cannot find their way back to.
    // The store orders conversations by the day in their name and nothing inside one is ordered at
    // all, which is fine until somebody wants to know whether they asked for this before or after
    // lunch.
    const recorded = dataCoordinationServiceMock.recordSession.mock.calls[1]?.[0] as AgentSession;

    expect(recorded.history[0]?.recordedOn).toBe("2026-09-13T09:41:00.000Z");
  });

  it("ShouldLoadABoundedHistoryFromTheSessionAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({ maxHistoryTurns: 2 });

    const turns = [1, 2, 3].map(() => ({ prompt: createRandomString(), answer: createRandomString(), exchanges: [] }));
    const session = createRandomSession({ history: turns });
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(session);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, createRandomString()));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.run(createPromptRequest(createRandomString(), session.id));

    // then
    expect(dataCoordinationServiceMock.recall.mock.calls[0]?.[0]).toMatchObject({ history: turns.slice(1) });
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Data", "Recalled 2 conversation turn(s)");
  });

  it("ShouldReadAgainAndRetryWhenTheSessionWriteIsStaleAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const session = createRandomSession({ history: [] });
    const staleWrite = new AgentOrchestrationDependencyValidationException(createRandomString(), new StaleSessionException(createRandomString()));
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(session);
    dataCoordinationServiceMock.recordSession.mockRejectedValueOnce(staleWrite).mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, createRandomString()));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    const actualOutcome = await runManagementService.run(createPromptRequest(createRandomString(), session.id));

    // then
    expect(actualOutcome.status).toBe("Responded");
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Run", `Session '${session.id}' moved on since it was read; reading it again (attempt 1)`, true);
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1, recallSession: 4, recordSession: 3 });
  });

  it("ShouldRefuseASessionAnotherPrincipalOpenedAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({ principalResolver: () => ({ id: "bob" }) });

    const session = createRandomSession({ owner: "alice" });
    dataCoordinationServiceMock.recallSession.mockResolvedValue(session);
    const invalidAgentException = new InvalidAgentException("Invalid session. It belongs to another principal; use a session of your own.");

    const expectedAgentCoordinationValidationException = new AgentCoordinationValidationException(
      "Agent coordination validation error occurred, fix the error and try again.",
      invalidAgentException,
    );

    // when
    const runTask = runManagementService.run(createPromptRequest(createRandomString(), session.id));

    // then
    const actualException = await runTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(AgentCoordinationValidationException);
    expectSameExceptionAs(actualException, expectedAgentCoordinationValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedAgentCoordinationValidationException);
    verifyNoOtherCalls(dataCoordinationServiceMock, { recallSession: 1 });
    verifyNoOtherCalls(decisionCoordinationServiceMock);
  });

  it("ShouldResumeTheInterruptedRunOfTheSessionAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const interruptedRunId = createRandomString();
    const session = createRandomSession({ history: [], status: "Working", runId: interruptedRunId });
    let observedRunId = "";
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(session);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, createRandomString()));

    directionCoordinationServiceMock.act.mockImplementation(async (context) => {
      observedRunId = AgentRun.current()?.id ?? "";

      return actedResponse(context);
    });

    // when
    await runManagementService.run(createPromptRequest(createRandomString(), session.id));

    // then
    expect(observedRunId).toBe(interruptedRunId);
  });

});
