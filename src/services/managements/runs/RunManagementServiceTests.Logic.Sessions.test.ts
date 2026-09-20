import { describe, expect, it } from "vitest";

import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { createPromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import { StaleSessionException } from "../../../models/foundations/sessions/exceptions/StaleSessionException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentCoordinationValidationException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationValidationException.js";
import { InvalidAgentException } from "../../../models/coordinations/agents/exceptions/InvalidAgentException.js";
import { actedResponse, actedTool, createRandomSession, createRandomString, createRunManagementServiceTests, expectSameExceptionAs, recalled, thoughtAnswer, thoughtTool, verifyNoOtherCalls } from "./RunManagementServiceTests.js";

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
      // The moment it was written, and which run wrote it, each have a test of their own below;
      // here they are only asserted to be there, because this test is about the shape of the two
      // writes and not about the clock or the run.
      history: [
        {
          prompt,
          answer,
          exchanges: [],
          recordedOn: expect.any(String) as unknown as string,
          runId: expect.any(String) as unknown as string,
          tookMs: expect.any(Number) as unknown as number,
        },
      ],
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

  // Which run a turn was, kept on the turn (SPEC.md 3.2).
  //
  // The session already remembers the run it last was, which is one run for a conversation with
  // twenty turns in it. Anything that kept what a run did to the folder could therefore be offered
  // for the most recent turn and for no other: a person who scrolled up to the turn that rewrote a
  // file had no way to see what it did, and no way to put it back, while the files it wrote were
  // still sitting in the snapshot store with nothing pointing at them.
  it("ShouldRecordWhichRunEachTurnWasAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

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
    // The same run the session is stamped with, on the turn that run produced. The session's own
    // stamp is overwritten by the next prompt; the turn's is not, which is the whole point.
    const recorded = dataCoordinationServiceMock.recordSession.mock.calls[1]?.[0] as AgentSession;

    expect(recorded.history[0]?.runId).toBe(recorded.runId);
    expect(recorded.history[0]?.runId).not.toBe("");
  });

  // How long the turn took, kept on the turn (SPEC.md 3.2).
  //
  // A turn carries when it was written and nothing about how long it took to write. The difference
  // between an answer that came back in two seconds and one that took four minutes is the whole of
  // what somebody wants to know when they come back to a conversation, and it is a fact only the
  // run itself is in a position to record: by the time anybody reads the turn, both moments are
  // gone.
  it("ShouldRecordHowLongTheTurnTookAsync", async () => {
    // given
    // A clock that moves, because a duration measured against a clock that does not is nought
    // however long the turn really was.
    const clock = { now: new Date("2026-09-13T09:41:00.000Z") };

    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests({}, clock);

    const sessionId = createRandomString();
    const answer = createRandomString();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(null);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    // Thinking is what takes the time in nearly every turn there is.
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => {
      clock.now = new Date("2026-09-13T09:41:12.500Z");

      return thoughtAnswer(context, answer);
    });

    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.run(createPromptRequest(createRandomString(), sessionId));

    // then
    // From the moment the run began to the moment its turn was written, in milliseconds, measured
    // on the clock the run was given rather than the one on the wall.
    const recorded = dataCoordinationServiceMock.recordSession.mock.calls[1]?.[0] as AgentSession;

    expect(recorded.history[0]?.tookMs).toBe(12_500);
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

  it("ShouldSayWhetherTheTurnActedAsync", async () => {
    // given
    // Two turns of the same conversation: one that answered from what it already had, and one that
    // reached for a tool. The difference between them is the difference between talking to
    // somebody and asking them to do something, and until now nothing carried it: every consumer
    // worked it out again from the exchanges, each with its own rule.
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(null);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, "Hello."));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.run(createPromptRequest("hi there", createRandomString()));

    // then
    // Nothing was touched, so the turn says so. This is the shape of a greeting.
    const talked = dataCoordinationServiceMock.recordSession.mock.calls[1]?.[0] as AgentSession;

    expect(talked.history[0]?.acted).toBe(false);
  });

  it("ShouldSayTheTurnActedWhenItReachedForSomethingAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    let asked = false;
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recallSession.mockResolvedValue(null);
    dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    // One tool call, and then an answer: the ordinary shape of work.
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => {
      if (asked) {
        return thoughtAnswer(context, "Done.");
      }

      asked = true;

      return thoughtTool(context, "read_file", "index.html");
    });

    directionCoordinationServiceMock.act.mockImplementation(async (context) =>
      context.directionType === "ReturnResponse" ? actedResponse(context) : actedTool(context, "<!doctype html>"),
    );

    // when
    await runManagementService.run(createPromptRequest("what does the page say", createRandomString()));

    // then
    const worked = dataCoordinationServiceMock.recordSession.mock.calls[1]?.[0] as AgentSession;

    expect(worked.history[0]?.acted).toBe(true);
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
