import { describe, expect, it } from "vitest";

import { createPromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import { createAgentBudget } from "../../../models/coordinations/agents/AgentBudget.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from "../../../models/brokers/generators/ResolvedInference.js";
import { actedResponse, actedTool, collectEvents, createRandomString, createRunManagementServiceTests, recalled, thoughtAnswer, thoughtTool, verifyNoOtherCalls } from "./RunManagementServiceTests.js";

describe("RunManagementService run logic", () => {
  it("ShouldRunToAnAnswerAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const prompt = createRandomString();
    const answer = createRandomString();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, answer));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    const actualOutcome = await runManagementService.run(createPromptRequest(prompt));

    // then
    expect(actualOutcome).toEqual({ result: answer, status: "Responded", pendingEffect: null, failure: null });

    expect(dataCoordinationServiceMock.recall.mock.calls[0]?.[0]).toMatchObject({
      prompt,
      sessionId: "",
      inference: { temperature: DEFAULT_TEMPERATURE, maxTokens: DEFAULT_MAX_TOKENS },
    });

    expect(loggingBrokerMock.logReset).toHaveBeenCalledTimes(1);
    expect(loggingBrokerMock.logTurn).toHaveBeenCalledWith(0);
    expect(loggingBrokerMock.logStep.mock.calls.map((call) => call[0])).toEqual(["Data", "Decision", "Direction"]);
    expect(loggingBrokerMock.logOutcome).toHaveBeenNthCalledWith(1, "turn 0: Responded");
    expect(loggingBrokerMock.logOutcome).toHaveBeenNthCalledWith(2, "done: Responded");
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1 });
    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 1 });
    verifyNoOtherCalls(directionCoordinationServiceMock, { act: 1 });
  });

  it("ShouldProcessPromptToTheAnswerAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const answer = createRandomString();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, answer));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    const actualAnswer = await runManagementService.processPrompt(createRandomString());

    // then
    expect(actualAnswer).toBe(answer);
  });

  it("ShouldLoopUntilTheAnswerFeedingObservationsBackAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const toolName = createRandomString();
    const toolInput = createRandomString();
    const output = createRandomString();
    const answer = createRandomString();
    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.think
      .mockImplementationOnce(async (context) => thoughtTool(context, toolName, toolInput))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, answer));

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, output))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    const actualOutcome = await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(actualOutcome.result).toBe(answer);
    expect(actualOutcome.status).toBe("Responded");
    expect(decisionCoordinationServiceMock.think.mock.calls[1]?.[0]).toMatchObject({ observations: [`${toolName}: ${output}`] });
    expect(events).toEqual([{ type: "Tool", content: `${toolName}: ${output}` }, { type: "Response", content: answer }]);
    expect(loggingBrokerMock.logTurn.mock.calls.map((call) => call[0])).toEqual([0, 1]);
    expect(loggingBrokerMock.logOutcome).toHaveBeenNthCalledWith(1, "turn 0: Working");
    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 2 });
    verifyNoOtherCalls(directionCoordinationServiceMock, { act: 2 });
  });

  it("ShouldStopWhenTurnsRunOutWithoutAnAnswerAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({ maxTurns: 3 });

    const expectedMessage = "I ran out of turns before an answer was ready; nothing was delivered.";
    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtTool(context, "loop", "x"));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedTool(context, "again"));

    // when
    const actualOutcome = await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(actualOutcome).toEqual({
      result: expectedMessage,
      status: "Working",
      pendingEffect: null,
      failure: { category: "Service", code: "turns_exhausted", message: expectedMessage },
    });

    expect(events[events.length - 1]).toEqual({ type: "Status", content: expectedMessage });
    expect(loggingBrokerMock.logOutcome).toHaveBeenCalledWith(`stopped: ${expectedMessage}`);
    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 3 });
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 3 });
  });

  it("ShouldStopWhenTheSameActIsAskedForTooOftenAsync", async () => {
    // given
    // Sixty-four turns to spend and a Brain that asks for the same page of the same file on every
    // one of them. Watched live, twice: the replay note said "use it and do something else", the
    // note-only replay said it again, and the model asked eleven more times with the note in
    // front of it. A note is not enough for every model, and a run that keeps asking for what it
    // has been handed is a run going in circles, whatever else its turn cap allows.
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({ maxTurns: 64 });

    const expectedMessage =
      "I asked for the same thing eight times and stopped: the run was going in circles, so it ended rather than spend the rest of its turns the same way; nothing was delivered.";

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtTool(context, "read_file", '{"path":"index.html"}'));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedTool(context, "the same page"));

    // when
    const actualOutcome = await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    // Eight, and not sixty-four: above the default turn cap, so a deployment on the default never
    // meets this and the cap stays the loop's first breaker, and far below what a window or a
    // terminal gives a run. Reported the way a budget stop is, because it is one: not a refusal
    // and not an answer, and a caller that cannot tell the two apart cannot decide what to do next.
    expect(actualOutcome).toEqual({
      result: expectedMessage,
      status: "Failed",
      pendingEffect: null,
      failure: { category: "Service", code: "going_in_circles", message: expectedMessage },
    });

    expect(events[events.length - 1]).toEqual({ type: "Status", content: expectedMessage });
    expect(loggingBrokerMock.logOutcome).toHaveBeenCalledWith(`stopped: ${expectedMessage}`);
    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 8 });
    verifyNoOtherCalls(directionCoordinationServiceMock, { act: 8 });
  });

  it("ShouldSpendATurnOnRevisingWithoutActingAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const answer = createRandomString();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.think
      .mockImplementationOnce(async (context) => ({ ...context, status: "Revising", promptTokens: 1, completionTokens: 1, usageIsEstimated: true }))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, answer));

    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    const actualOutcome = await runManagementService.run(createPromptRequest(createRandomString()));

    // then
    expect(actualOutcome.result).toBe(answer);
    expect(loggingBrokerMock.logOutcome).toHaveBeenNthCalledWith(1, "turn 0: revising");
    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 2 });
    verifyNoOtherCalls(directionCoordinationServiceMock, { act: 1 });
  });

  it("ShouldRefuseWhenReviewCannotBeSatisfiedWithinTheTurnsAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests({ maxTurns: 2 });

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => ({ ...context, status: "Revising" }));

    // when
    const actualOutcome = await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(actualOutcome).toEqual({ result: "I can't help with that at the moment.", status: "Refused", pendingEffect: null, failure: null });

    expect(events).toEqual([
      { type: "Status", content: "unable to satisfy review after retries; refusing" },
      { type: "Response", content: "I can't help with that at the moment." },
    ]);

    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 2 });
    verifyNoOtherCalls(directionCoordinationServiceMock);
  });

  it("ShouldStopBeforeTheFirstTurnWhenCancelledAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const expectedMessage = "The request was cancelled before it completed.";
    const controller = new AbortController();
    controller.abort();
    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);

    // when
    const actualOutcome = await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit, controller.signal);

    // then
    expect(actualOutcome).toEqual({
      result: expectedMessage,
      status: "Failed",
      pendingEffect: null,
      failure: { category: "Service", code: "cancelled", message: expectedMessage },
    });

    expect(events).toEqual([{ type: "Status", content: expectedMessage }]);
    expect(loggingBrokerMock.logOutcome).toHaveBeenCalledWith(`stopped: ${expectedMessage}`);
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1 });
    verifyNoOtherCalls(decisionCoordinationServiceMock);
    verifyNoOtherCalls(directionCoordinationServiceMock);
  });

  it("ShouldStopWhenTheTokenBudgetIsExhaustedAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests({ budget: createAgentBudget({ maxTokens: 4 }) });

    const expectedMessage = "The token budget for this request was exhausted before it completed.";
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtTool(context, "loop", "x"));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedTool(context, "again"));

    // when
    const actualOutcome = await runManagementService.run(createPromptRequest(createRandomString()));

    // then
    expect(actualOutcome).toEqual({
      result: expectedMessage,
      status: "Failed",
      pendingEffect: null,
      failure: { category: "Service", code: "budget_exhausted", message: expectedMessage },
    });

    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 1 });
  });

  it("ShouldStopWhenTheWallClockBudgetIsExhaustedAsync", async () => {
    // given
    const clock = { now: new Date() };

    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests({ budget: createAgentBudget({ maxWallClockMilliseconds: 5_000 }) }, clock);

    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtTool(context, "loop", "x"));

    directionCoordinationServiceMock.act.mockImplementation(async (context) => {
      clock.now = new Date(clock.now.getTime() + 10_000);

      return actedTool(context, "again");
    });

    // when
    const actualOutcome = await runManagementService.run(createPromptRequest(createRandomString()));

    // then
    expect(actualOutcome.status).toBe("Failed");
    expect(actualOutcome.result).toBe("The time budget for this request was exhausted before it completed.");
    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 1 });
  });

  it("ShouldResolveInferenceWithConfigurationWinningOverTheRequestAsync", async () => {
    // given
    const configuredSchema = '{"type":"object"}';

    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({ configuredTemperature: 0.1, contractSchema: configuredSchema, configuredToolNames: ["calc"] });

    const request = {
      ...createPromptRequest(createRandomString()),
      temperature: 0.9,
      maxTokens: 77,
      responseSchemaJson: '{"type":"string"}',
      callerTools: [
        { name: "Calc", description: createRandomString(), parametersJson: "{}" },
        { name: "other", description: createRandomString(), parametersJson: "{}" },
      ],
      providerOptionsJson: '{"model":"x","top_k":3}',
    };

    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, createRandomString()));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.run(request);

    // then
    expect(dataCoordinationServiceMock.recall.mock.calls[0]?.[0].inference).toEqual({
      temperature: 0.1,
      maxTokens: 77,
      seed: null,
      stop: [],
      responseSchemaJson: configuredSchema,
      callerTools: [request.callerTools[1]],
      providerOptionsJson: '{"top_k":3}',
    });

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Run", "Contract -> request schema discarded; the configured Contract wins");
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Run", "Provider options -> stripped core-owned key(s): model");
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Run", "Caller tools -> 'Calc' dropped; a configured tool owns that name");
  });

  it("ShouldWithholdAToolResultTheGateRefusesAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({ screenToolOutput: true });

    const toolName = createRandomString();
    const injected = createRandomString();
    const refusal = `the result of '${toolName}' was refused by screening and withheld`;
    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.think
      .mockImplementationOnce(async (context) => thoughtTool(context, toolName, "x"))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, createRandomString()));

    decisionCoordinationServiceMock.screen.mockResolvedValue("refuse: an instruction rode in");

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, injected))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(decisionCoordinationServiceMock.screen).toHaveBeenCalledWith(injected);
    expect(decisionCoordinationServiceMock.think.mock.calls[1]?.[0]).toMatchObject({ observations: [`${toolName}: ${refusal}`] });
    expect(events[0]).toEqual({ type: "Tool", content: `${toolName}: ${refusal}` });
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Direction", `Screening REFUSED the result of '${toolName}'`, "refuse: an instruction rode in", false);
  });

  it("ShouldVoiceScreenedNarrationBeforeTheActAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const narration = createRandomString();
    const toolName = createRandomString();
    const output = createRandomString();
    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.think
      .mockImplementationOnce(async (context) => ({ ...thoughtTool(context, toolName, "x"), narration }))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, createRandomString()));

    decisionCoordinationServiceMock.screen.mockResolvedValue("allow");

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, output))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(decisionCoordinationServiceMock.screen).toHaveBeenCalledWith(narration);
    expect(events.slice(0, 2)).toEqual([{ type: "Narration", content: narration }, { type: "Tool", content: `${toolName}: ${output}` }]);
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Direction", "Narration", narration, true);
  });

  it("ShouldWithholdNarrationTheGateRefusesAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests();

    const narration = createRandomString();
    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => ({ ...thoughtAnswer(context, createRandomString()), narration }));
    decisionCoordinationServiceMock.screen.mockResolvedValue("refuse: no");
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(events.some((event) => event.type === "Narration")).toBe(false);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", "Narration -> WITHHELD: refuse: no");
  });

  it("ShouldVoiceTheToolsDeclaredNarrationWhenTheModelSaidNothingAsync", async () => {
    // given
    const toolName = createRandomString();
    const payload = createRandomString();
    const output = createRandomString();
    const answer = createRandomString();

    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests({ toolNarrations: new Map([[toolName, { starting: "Running {tool} with {payload}", observed: "{tool} finished" }]]) });

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.think
      .mockImplementationOnce(async (context) => thoughtTool(context, toolName, payload))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, answer));

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, output))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    expect(events).toEqual([
      { type: "Narration", content: `Running ${toolName} with ${payload}` },
      { type: "Narration", content: `${toolName} finished` },
      { type: "Tool", content: `${toolName}: ${output}` },
      { type: "Response", content: answer },
    ]);

    verifyNoOtherCalls(decisionCoordinationServiceMock, { think: 2 });
  });

  it("ShouldOfferTheSelectedToolsToTheRunAsync", async () => {
    // given
    const selections: Array<readonly string[]> = [];

    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService } =
      createRunManagementServiceTests({
        describedToolNames: ["alpha", "beta"],
        toolSelector: async (_task, described) => {
          selections.push(described);

          return ["BETA", "ghost"];
        },
      });

    let offered: readonly string[] | null | undefined;
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([{ name: "gamma", description: createRandomString(), inputSchemaJson: "{}" }]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, createRandomString()));

    directionCoordinationServiceMock.act.mockImplementation(async (context) => {
      offered = AgentRun.current()?.offeredTools;

      return actedResponse(context);
    });

    // when
    await runManagementService.run(createPromptRequest(createRandomString()));

    // then
    expect(selections).toEqual([["alpha", "beta", "gamma"]]);
    expect(offered).toEqual(["beta"]);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Run", "Selection -> offered [beta]; withheld [alpha, gamma]");
  });

  it("ShouldRememberWhatTheRunAskedToRememberAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const memory = createRandomString();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.remember.mockResolvedValue(undefined);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => ({ ...thoughtAnswer(context, createRandomString()), remember: memory }));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.run(createPromptRequest(createRandomString()));

    // then
    expect(dataCoordinationServiceMock.remember).toHaveBeenCalledWith(memory);
    verifyNoOtherCalls(dataCoordinationServiceMock, { retrieveRemoteTools: 1, recall: 1, remember: 1 });
  });

});
