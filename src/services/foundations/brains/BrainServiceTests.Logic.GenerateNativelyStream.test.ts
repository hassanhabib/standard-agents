import { describe, expect, it } from "vitest";

import { createGenerationResult } from "../../../brokers/generators/FunctionGeneratorBrokerV1.js";
import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { BrainDependencyException } from "../../../models/foundations/brains/exceptions/BrainDependencyException.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { createNativeAsk } from "../../../models/foundations/brains/NativeAsk.js";
import { createRandomString } from "./BrainServiceTests.js";
import { createExchange, createNativeBrainServiceTests } from "./BrainServiceTests.Native.js";

describe("BrainService native streaming", () => {
  it("ShouldVoiceEachPieceAndReturnTheWholeGenerationAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();
    const completed = createGenerationResult({ content: "Hello there.", promptTokens: 8, completionTokens: 3 });

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "", narration: "Reading first.", completed: null };
      yield { content: "Hello ", narration: "", completed: null };
      yield { content: "there.", narration: "", completed: null };
      yield { content: "", narration: "", completed };
    });

    const voiced: Array<{ content: string; narration: string }> = [];

    // when
    const actualGeneration = await brainService.generateNativelyStream(createNativeAsk("say hello"), async (delta) => {
      voiced.push({ content: delta.content, narration: delta.narration });
    });

    // then
    expect(actualGeneration).toBe(completed);

    expect(voiced).toEqual([
      { content: "", narration: "Reading first." },
      { content: "Hello ", narration: "" },
      { content: "there.", narration: "" },
    ]);
  });

  it("ShouldNotVoiceAPieceWithNothingInItAsync", async () => {
    // given
    // A stream says it has started before it has anything to say: the broker hands up an empty
    // piece the moment the service answers, so the first-piece clock can stop. It is a signal for
    // the clock, not a word, and whoever is listening should not be handed silence as speech.
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();
    const completed = createGenerationResult({ content: "hello" });

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "", narration: "", completed: null };
      yield { content: "hello", narration: "", completed: null };
      yield { content: "", narration: "", completed };
    });

    const voiced: Array<{ content: string; narration: string }> = [];

    // when
    await brainService.generateNativelyStream(createNativeAsk("go"), async (delta) => {
      voiced.push({ content: delta.content, narration: delta.narration });
    });

    // then
    expect(voiced).toEqual([{ content: "hello", narration: "" }]);
  });

  it("ShouldSayItIsWaitingOnABusyServiceBeforeAskingOnceMoreAsync", async () => {
    // given
    // A wait nobody is told about is a window that has stopped for no reason. The service said it
    // was busy and how long to wait, and whoever is watching hears that before the pause, on the
    // same channel the model's own progress lines use.
    const { generatorBrokerV1Mock, timeBrokerMock, brainService } = createNativeBrainServiceTests();
    const completed = createGenerationResult({ content: "done" });
    let asks = 0;

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      asks += 1;

      if (asks === 1) {
        throw new HttpResponseException(503, "busy", "5");
      }

      yield { content: "done", narration: "", completed: null };
      yield { content: "", narration: "", completed };
    });

    const voiced: Array<{ content: string; narration: string }> = [];

    // when
    const actualGeneration = await brainService.generateNativelyStream(createNativeAsk("go"), async (delta) => {
      voiced.push({ content: delta.content, narration: delta.narration });
    });

    // then
    expect(actualGeneration).toBe(completed);

    // The wait the service named, beside the first-piece clock each attempt keeps.
    expect(timeBrokerMock.delay).toHaveBeenCalledWith(5_000, undefined);

    expect(voiced).toEqual([
      { content: "", narration: "The model service is busy (503), so I am trying again in 5 seconds." },
      { content: "done", narration: "" },
    ]);
  });

  it("ShouldGiveUpWhenNothingArrivesWithinFourMinutesAsync", async () => {
    // given
    // A service that takes the request and says nothing back leaves a window spinning until the
    // platform's own timeout, five minutes, and then says "nothing answered", which is not true.
    //
    // Not thirty seconds. Watched on a Host on the local network: it sends nothing, not even its
    // headers, until the whole answer is ready, and a coding turn with forty messages behind it
    // took longer than thirty seconds to be ready. Every turn failed with "did not start
    // answering" on a Host that was working. A Host that has not answered cannot be told from a
    // Host that is busy writing, so the wait is long enough for a buffered turn and short enough
    // to be told before the platform gives up with a sentence that is wrong.
    //
    // The clock here gives up at once, the way the real one does after four minutes, and the
    // request is cut short the way fetch is.
    const { generatorBrokerV1Mock, timeBrokerMock, brainService } = createNativeBrainServiceTests();

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* (
      _messages: unknown,
      _tools: unknown,
      _inference: unknown,
      signal?: AbortSignal,
    ) {
      await new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")));
      });

      yield { content: "never", narration: "", completed: null };
    });

    // when
    const raised = await brainService.generateNativelyStream(createNativeAsk("go"), async () => {}).then(
      () => undefined,
      (error: unknown) => error,
    );

    // then
    expect(timeBrokerMock.delay).toHaveBeenCalledWith(240_000, expect.any(AbortSignal));
    expect(raised).toBeInstanceOf(BrainDependencyException);
    expect(innermostMessageOf(raised)).toBe(
      "the model service did not answer within 4 minutes. Check that it is running and not overloaded.",
    );
  });

  it("ShouldSayTheConnectionDroppedWhenItFailsPartwayThroughTheAnswerAsync", async () => {
    // given
    // Half an answer on the screen, then the socket goes. fetch raises the same TypeError it raises
    // for an address where nothing answers, and the window said "nothing answered at that address"
    // under text that had plainly come from there.
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "The first half ", narration: "", completed: null };

      throw new TypeError("terminated");
    });

    // when
    const raised = await brainService.generateNativelyStream(createNativeAsk("go"), async () => {}).then(
      () => undefined,
      (error: unknown) => error,
    );

    // then
    expect(innermostMessageOf(raised)).toBe(
      "the connection dropped partway through the answer. What arrived is above; ask again to finish it.",
    );
  });

  it("ShouldClimbDownBeforeStreamingWhenTheConversationWouldNotFitAsync", async () => {
    // given
    const { generatorBrokerV1Mock, loggingBrokerMock, brainService } = createNativeBrainServiceTests({
      elisionWindow: 3,
      contextLength: 300,
      charactersPerToken: 1,
    });

    const completed = createGenerationResult({ content: "ok" });

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "", narration: "", completed };
    });

    const first = createExchange({ callId: "call_1", toolName: "read_file", result: "x".repeat(200) });
    const second = createExchange({ callId: "call_2", toolName: "read_file", result: "y".repeat(200) });

    // when
    await brainService.generateNativelyStream(
      createNativeAsk("go", { exchanges: [first, second] }),
      async () => {},
    );

    // then
    const messages = generatorBrokerV1Mock.generateStream.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    expect(messages.filter((message) => message.role === "Tool")[0]?.content).toBe("[result elided by client: 200 bytes]");

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> the conversation would not fit the context; shrank the elision window to 1",
      true,
    );
  });

  it("ShouldRefuseAStreamThatEndedWithoutCompletingTheTurnAsync", async () => {
    // given
    const { generatorBrokerV1Mock, brainService } = createNativeBrainServiceTests();

    generatorBrokerV1Mock.generateStream.mockImplementation(async function* () {
      yield { content: "half an ans", narration: "", completed: null };
    });

    // when
    const streamTask = brainService.generateNativelyStream(createNativeAsk(createRandomString()), async () => {});

    // then
    const actualException = await streamTask.then(() => undefined, (error: unknown) => error);

    // The truncation is localised by the brain family, and what it was survives as the inner cause.
    expect(actualException).toBeInstanceOf(BrainServiceException);
    expect(String(actualException)).toContain("Brain service error");
  });

});

// The message a door reads: the bottom of the chain, where the sentence written for a person is.
function innermostMessageOf(error: unknown): string {
  let said = "";

  for (let at = error as { message?: string; innerError?: unknown } | null | undefined; at !== null && at !== undefined; ) {
    said = (at.message ?? "").trim() || said;
    at = at.innerError as { message?: string; innerError?: unknown } | null | undefined;
  }

  return said;
}
