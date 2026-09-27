import { describe, expect, it } from "vitest";

import { createPromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import type { AgentUsage } from "../../../models/foundations/usages/AgentUsage.js";
import {
  actedResponse,
  actedTool,
  collectEvents,
  createRandomString,
  createRunManagementServiceTests,
  recalled,
  thoughtAnswer,
  thoughtTool,
} from "./RunManagementServiceTests.js";

// Usage, as it is spent (SPEC.md 4.14.1). The loop always counted what a run spends, because the
// budget cannot bound what it does not count, and it kept the count to itself: somebody watching a
// run could read a clock and nothing else. So after every model call the stream says what the run
// has spent so far, the same count the budget reads, marked estimated where nobody reported it.
describe("RunManagementService usage as it is spent", () => {
  it("ShouldSayWhatTheRunHasSpentAfterEveryModelCallAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.thinkStream
      .mockImplementationOnce(async (context) => thoughtTool(context, "read_file", "README.md"))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, createRandomString()));

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, createRandomString()))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    await runManagementService.runStreamed(createPromptRequest(createRandomString()), emit);

    // then
    // A running total rather than each call's own figure: three and two, then three and two
    // again on top of it. A consumer that missed the first still reads the right number from the
    // second.
    expect(events.filter((event) => event.type === "Usage")).toEqual([
      { type: "Usage", content: "5", usage: { promptTokens: 3, completionTokens: 2, isEstimated: true } },
      { type: "Usage", content: "10", usage: { promptTokens: 6, completionTokens: 4, isEstimated: true } },
    ]);
  });

  it("ShouldSayWhatTheRunIsSpendingWhileACallIsAnsweredAsync", async () => {
    // given
    // A call can take minutes, and its usage arrives only when it ends. Spending is the count while
    // it is answered: the run's settled total so far, plus this call's own estimate of what it sent
    // and what has come back (SPEC.md 4.14.1, spending).
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.thinkStream
      .mockImplementationOnce(async (context, _voice, spend: (soFar: AgentUsage) => Promise<void>) => {
        await spend({ promptTokens: 50, completionTokens: 0, isEstimated: true });

        return thoughtTool(context, "read_file", "platformer.html");
      })
      .mockImplementationOnce(async (context, _voice, spend: (soFar: AgentUsage) => Promise<void>) => {
        await spend({ promptTokens: 60, completionTokens: 0, isEstimated: true });
        await spend({ promptTokens: 60, completionTokens: 10, isEstimated: true });
        await spend({ promptTokens: 60, completionTokens: 30, isEstimated: true });

        return thoughtAnswer(context, createRandomString());
      });

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, createRandomString()))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    await runManagementService.runStreamed(createPromptRequest(createRandomString()), emit);

    // then
    // The prompt is said the moment the call is sent. After that, a piece is said once it has
    // moved the count by 25 or more, so a file written a few characters at a time is not a
    // thousand events, and a count that moved by ten waits for the next one.
    expect(events.filter((event) => event.type === "Spending" || event.type === "Usage")).toEqual([
      { type: "Spending", content: "50", usage: { promptTokens: 50, completionTokens: 0, isEstimated: true } },
      { type: "Usage", content: "5", usage: { promptTokens: 3, completionTokens: 2, isEstimated: true } },
      { type: "Spending", content: "65", usage: { promptTokens: 63, completionTokens: 2, isEstimated: true } },
      { type: "Spending", content: "95", usage: { promptTokens: 63, completionTokens: 32, isEstimated: true } },
      { type: "Usage", content: "10", usage: { promptTokens: 6, completionTokens: 4, isEstimated: true } },
    ]);
  });

  it("ShouldCallTheTotalEstimatedOnceAnyCallInItWasAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    // The first call's numbers came from the provider; the second's were counted here.
    decisionCoordinationServiceMock.thinkStream
      .mockImplementationOnce(async (context) => ({ ...thoughtTool(context, "read_file", "README.md"), usageIsEstimated: false }))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, createRandomString()));

    directionCoordinationServiceMock.act
      .mockImplementationOnce(async (context) => actedTool(context, createRandomString()))
      .mockImplementationOnce(async (context) => actedResponse(context));

    // when
    await runManagementService.runStreamed(createPromptRequest(createRandomString()), emit);

    // then
    // One estimate in the sum makes the sum an estimate, and presenting it as a measurement is
    // the one thing SPEC.md 3.4 forbids outright.
    expect(events.filter((event) => event.type === "Usage").map((event) => event.usage?.isEstimated)).toEqual([false, true]);
  });

  it("ShouldCountTheDraftThatWasSentBackAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));

    decisionCoordinationServiceMock.thinkStream
      .mockImplementationOnce(async (context) => ({ ...context, status: "Revising", promptTokens: 1, completionTokens: 1, usageIsEstimated: true }))
      .mockImplementationOnce(async (context) => thoughtAnswer(context, createRandomString()));

    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.runStreamed(createPromptRequest(createRandomString()), emit);

    // then
    // The draft the Judge sent back was still written, and what it took was spent whether or not
    // anybody reads it.
    expect(events.filter((event) => event.type === "Usage").map((event) => event.content)).toEqual(["2", "7"]);
  });

  it("ShouldSayWhatTheRunHasSpentOnTheBatchedDoorThatYieldsEventsAsync", async () => {
    // given
    const { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, runManagementService } =
      createRunManagementServiceTests();

    const { events, emit } = collectEvents();
    dataCoordinationServiceMock.retrieveRemoteTools.mockResolvedValue([]);
    dataCoordinationServiceMock.recall.mockImplementation(async (context) => recalled(context));
    decisionCoordinationServiceMock.think.mockImplementation(async (context) => thoughtAnswer(context, createRandomString()));
    directionCoordinationServiceMock.act.mockImplementation(async (context) => actedResponse(context));

    // when
    await runManagementService.runWithEvents(createPromptRequest(createRandomString()), emit);

    // then
    // Every door that yields events yields this one (SPEC.md 7.6): the batched door decides the
    // turn without watching it, and it spent the same.
    expect(events.filter((event) => event.type === "Usage")).toEqual([
      { type: "Usage", content: "5", usage: { promptTokens: 3, completionTokens: 2, isEstimated: true } },
    ]);
  });
});
