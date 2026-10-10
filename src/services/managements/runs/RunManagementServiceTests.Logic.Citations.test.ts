import { describe, expect, it } from "vitest";

import { createPromptRequest, type PromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import type { RunOptions } from "../../../models/managements/runs/RunOptions.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import {
  actedResponse,
  collectEvents,
  createRandomSession,
  createRandomString,
  createRunManagementServiceTests,
  recalled,
  thoughtAnswer,
} from "./RunManagementServiceTests.js";

// A grounded answer cites its sources (SPEC.md 4.2, v1.18): the implementation writes the lines,
// from the sources Recall put on the run, once the run has answered.
describe("RunManagementService citation logic", () => {
  function arrange(
    options: Partial<RunOptions>,
    groundingSources: readonly string[],
    answer: string,
    acted: (context: AgentContext) => AgentContext = actedResponse,
  ): ReturnType<typeof createRunManagementServiceTests> {
    const tests = createRunManagementServiceTests(options);
    tests.dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);

    tests.dataCoordinationServiceMock.recall.mockImplementation(async (context: AgentContext) => ({
      ...recalled(context),
      groundingSources,
    }));

    tests.decisionCoordinationServiceMock.think.mockImplementation(async (context: AgentContext) => thoughtAnswer(context, answer));
    tests.directionCoordinationServiceMock.act.mockImplementation(async (context: AgentContext) => acted(context));

    return tests;
  }

  function request(overrides: Partial<PromptRequest> = {}): PromptRequest {
    return { ...createPromptRequest(createRandomString()), ...overrides };
  }

  it("ShouldCiteEachRecalledSourceOnAnAnsweredRunWhenTheDeploymentAsksAsync", async () => {
    // given
    const answer = createRandomString();
    const sources = ["refunds.md", "policies/enterprise.md"];
    const { runManagementService } = arrange({ configuredCiteKnowledge: true }, sources, answer);
    const { events, emit } = collectEvents();
    const expectedResult = `${answer}\n\nSource: refunds.md\nSource: policies/enterprise.md`;

    // when
    const actualOutcome = await runManagementService.runWithEvents(request(), emit);

    // then
    expect(actualOutcome.result).toBe(expectedResult);
    expect(events.filter((event) => event.type === "Response").map((event) => event.content)).toEqual([expectedResult]);
  });

  it("ShouldNotCiteWhenNobodyAskedForCitationAsync", async () => {
    // given
    const answer = createRandomString();
    const { runManagementService } = arrange({}, ["refunds.md"], answer);

    // when
    const actualOutcome = await runManagementService.run(request());

    // then
    expect(actualOutcome.result).toBe(answer);
  });

  it("ShouldCiteWhenTheRequestAsksAndTheDeploymentHasNoOpinionAsync", async () => {
    // given
    const answer = createRandomString();
    const { runManagementService } = arrange({}, ["refunds.md"], answer);

    // when
    const actualOutcome = await runManagementService.run(request({ citeKnowledge: true }));

    // then
    expect(actualOutcome.result).toBe(`${answer}\n\nSource: refunds.md`);
  });

  it("ShouldKeepTheConfiguredCitationAndPrefixWhenARequestDeclinesItAsync", async () => {
    // given
    const answer = createRandomString();

    const { runManagementService } = arrange(
      { configuredCiteKnowledge: true, knowledgeCitationPrefix: "Reference: " },
      ["refunds.md"],
      answer,
    );

    // when
    const actualOutcome = await runManagementService.run(request({ citeKnowledge: false }));

    // then
    expect(actualOutcome.result).toBe(`${answer}\n\nReference: refunds.md`);
  });

  it("ShouldNotTurnCitationOnWhenTheDeploymentTurnedItOffAsync", async () => {
    // given
    const answer = createRandomString();
    const { runManagementService } = arrange({ configuredCiteKnowledge: false }, ["refunds.md"], answer);

    // when
    const actualOutcome = await runManagementService.run(request({ citeKnowledge: true }));

    // then
    expect(actualOutcome.result).toBe(answer);
  });

  it("ShouldNotCiteASourceTheAnswerAlreadyCreditsAsync", async () => {
    // given
    const answer = `${createRandomString()}\nSource: refunds.md`;
    const { runManagementService } = arrange({ configuredCiteKnowledge: true }, ["refunds.md", "shipping.md"], answer);

    // when
    const actualOutcome = await runManagementService.run(request());

    // then
    expect(actualOutcome.result).toBe(`${answer}\n\nSource: shipping.md`);
  });

  it("ShouldNotCiteARunThatDidNotAnswerAsync", async () => {
    // given
    const refusal = createRandomString();

    const { runManagementService } = arrange({ configuredCiteKnowledge: true }, ["refunds.md"], createRandomString(), (context) => ({
      ...context,
      result: refusal,
      status: "Refused",
    }));

    // when
    const actualOutcome = await runManagementService.run(request());

    // then
    expect(actualOutcome).toMatchObject({ result: refusal, status: "Refused" });
  });

  it("ShouldNotCiteAnAnswerHeldToAResponseSchemaAsync", async () => {
    // given
    const answer = '"enterprise customers have 90 days"';
    const { runManagementService } = arrange({ configuredCiteKnowledge: true }, ["refunds.md"], answer);

    // when
    const actualOutcome = await runManagementService.run(request({ responseSchemaJson: '{"type":"string"}' }));

    // then
    expect(actualOutcome.result).toBe(answer);
  });

  it("ShouldRecordTheCitedAnswerInTheSessionAsync", async () => {
    // given
    const sessionId = createRandomString();
    const answer = createRandomString();
    const tests = arrange({ configuredCiteKnowledge: true }, ["refunds.md"], answer);
    const begun = createRandomSession({ id: sessionId, history: [], status: "Working", version: 1 });

    tests.dataCoordinationServiceMock.recallSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(begun);

    tests.dataCoordinationServiceMock.recordSession.mockResolvedValue(undefined);

    // when
    const actualOutcome = await tests.runManagementService.run(createPromptRequest(createRandomString(), sessionId));

    // then
    const recordedTurns = tests.dataCoordinationServiceMock.recordSession.mock.calls.at(-1)?.[0].history;
    expect(actualOutcome.result).toBe(`${answer}\n\nSource: refunds.md`);
    expect(recordedTurns.at(-1).answer).toBe(actualOutcome.result);
  });
});
