import type { GeneratorBroker } from "../../../brokers/generators/GeneratorBroker.js";
import type { GeneratorBrokerV1 } from "../../../brokers/generators/GeneratorBrokerV1.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { SystemTimeBroker } from "../../../brokers/times/SystemTimeBroker.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import type { ResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import type { ConversationMessage } from "../../../models/brokers/generators/v1/ConversationMessage.js";
import type { GenerationDelta } from "../../../models/brokers/generators/v1/GenerationDelta.js";
import type { GenerationResult } from "../../../models/brokers/generators/v1/GenerationResult.js";
import { StreamInterruptedException } from "../../../models/brokers/generators/v1/StreamInterruptedException.js";
import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { ContextTooLargeException } from "../../../models/foundations/brains/exceptions/ContextTooLargeException.js";
import { TimedOutBrainException } from "../../../models/foundations/brains/exceptions/TimedOutBrainException.js";
import { createNativeOptions, type NativeAsk, type NativeOptions } from "../../../models/foundations/brains/NativeAsk.js";
import { createTryCatch, type TryCatch } from "./BrainService.Exceptions.js";
import { buildConversation, ladderRungs, overContextBudget } from "./BrainService.Native.js";
import { validateToolCallIds, validateUserPrompt } from "./BrainService.Validations.js";

// The Decision nature's brain foundation (SPEC.md 4.2): one generator broker, the prompt
// validated before the call, native HTTP faults localised into the brain family. A broker that
// ignores the resolved inference is announced, never hidden: the guardian then enforces the shape.
//
// One slot, two protocols. A composition configures the text brain, the native brain, or both,
// and speaksNatively is how the tier above asks which conversation it may have rather than
// guessing from a nullable field.
export class BrainService {
  private readonly generatorBroker: GeneratorBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly generatorBrokerV1: GeneratorBrokerV1 | null;
  private readonly options: NativeOptions;
  private readonly timeBroker: TimeBroker;
  private readonly tryCatch: TryCatch;

  public constructor(
    generatorBroker: GeneratorBroker,
    loggingBroker: LoggingBroker,
    generatorBrokerV1: GeneratorBrokerV1 | null = null,
    options: NativeOptions = createNativeOptions(),
    timeBroker: TimeBroker = new SystemTimeBroker(),
  ) {
    this.generatorBroker = generatorBroker;
    this.loggingBroker = loggingBroker;
    this.generatorBrokerV1 = generatorBrokerV1;
    this.options = options;
    this.timeBroker = timeBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public get speaksNatively(): boolean {
    return this.generatorBrokerV1 !== null;
  }

  public generate(systemPrompt: string, userPrompt: string, inference?: ResolvedInference): Promise<string> {
    return this.tryCatch(async () => {
      validateUserPrompt(userPrompt);

      if (inference === undefined) {
        return await this.onceMoreIfBusy(async () => await this.generatorBroker.generate(systemPrompt, userPrompt));
      }

      await this.announceDegradation(this.generatorBroker.honorsRequest);

      return await this.onceMoreIfBusy(async () => await this.generatorBroker.generate(systemPrompt, userPrompt, inference));
    });
  }

  // The native turn: the conversation built from what the run knows, sent through the ladder that
  // gives things up in order until it fits or there is nothing left to give (SPEC.md 6.2).
  public generateNatively(ask: NativeAsk, signal?: AbortSignal): Promise<GenerationResult> {
    return this.tryCatch(async () => {
      validateUserPrompt(ask.prompt);
      validateToolCallIds(ask);

      const broker = this.requireNativeBroker();
      await this.announceDegradation(broker.honorsRequest);

      return await this.overLadder(
        ask,
        async (messages) =>
          await this.onceMoreIfBusy(async () => await broker.generate(messages, ask.tools, ask.inference ?? undefined, signal), signal),
      );
    });
  }

  // The same turn, voiced as it arrives (SPEC.md 6.2). The pieces go to the caller as they come
  // and the whole generation is returned at the end, so a consumer that only wants the answer
  // awaits this and a consumer that speaks while the model speaks reads the pieces.
  //
  // The ladder still runs and can still climb: a provider refuses an over-large request with a
  // status before it sends a single frame, so a retry at that point has voiced nothing. Once a
  // frame has arrived the ladder is done, because nothing said can be unsaid.
  public generateNativelyStream(
    ask: NativeAsk,
    voice: (delta: GenerationDelta) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    return this.tryCatch(async () => {
      validateUserPrompt(ask.prompt);
      validateToolCallIds(ask);

      const broker = this.requireNativeBroker();
      await this.announceDegradation(broker.honorsRequest);

      return await this.overLadder(ask, async (messages) =>
        await this.onceMoreIfBusy(async () => {
          const firstPiece = this.startFirstPieceWait(signal);
          let completed: GenerationResult | null = null;
          let started = false;

          try {
            for await (const delta of broker.generateStream(messages, ask.tools, ask.inference ?? undefined, firstPiece.signal)) {
              firstPiece.arrived();
              started = true;

              if (delta.completed !== null) {
                completed = delta.completed;
                continue;
              }

              // A piece with nothing in it is the stream saying it has begun. It stops the clock
              // above and is not voiced: silence handed on as speech is noise for whoever listens.
              // A piece of a call's arguments is not silence: nobody reads it, and it is spent.
              if (delta.content.length === 0 && delta.narration.length === 0 && (delta.written ?? "").length === 0) {
                continue;
              }

              await voice(delta);
            }
          } catch (error: unknown) {
            // Only the abort this wait caused is a timeout. A status or a dropped connection that
            // lands in the same moment is still what it is, and is reported as that.
            if (firstPiece.gaveUp() && isAbort(error)) {
              throw new TimedOutBrainException(
                `the model service did not answer within ${String(FIRST_PIECE_MINUTES)} minutes. Check that it is running and not overloaded.`,
              );
            }

            // The connection went after the answer had started. fetch raises the same TypeError
            // it raises for an address where nothing answers, and "nothing answered" under text
            // that plainly came from there is the one sentence that cannot be true.
            if (started && error instanceof TypeError) {
              throw new StreamInterruptedException(
                "truncated",
                "the connection dropped partway through the answer. What arrived is above; ask again to finish it.",
              );
            }

            throw error;
          } finally {
            firstPiece.arrived();
          }

          // A stream that ended without its completed delta finished nothing. The reader raises for
          // a stream it watched close early; this is the belt for a broker that simply stops.
          if (completed === null) {
            throw new StreamInterruptedException("truncated", "the stream ended without completing the turn");
          }

          return completed;
        }, signal, async (sentence) => await voice({ content: "", narration: sentence, completed: null })),
      );
    });
  }

  // The degradation ladder, walked once for whichever way the turn is being asked (SPEC.md 6.2).
  // Both doors climb the same rungs, so a streamed run and a batched one give up the same things
  // in the same order and neither can quietly be more generous than the other.
  private async overLadder<T>(ask: NativeAsk, send: (messages: readonly ConversationMessage[]) => Promise<T>): Promise<T> {
    const rungs = ladderRungs(ask, this.options);

    for (const [index, rung] of rungs.entries()) {
      const isLastRung = index === rungs.length - 1;
      const messages = buildConversation(rung.ask, rung.elisionWindow);

      if (overContextBudget(messages, this.options)) {
        if (isLastRung) {
          throw new ContextTooLargeException(CONTEXT_TOO_LARGE_MESSAGE);
        }

        await this.announceRung(rungs[index + 1]?.gaveUp ?? "", "the conversation would not fit the context");
        continue;
      }

      try {
        return await send(messages);
      } catch (error: unknown) {
        if (!isTooLarge(error)) {
          throw error;
        }

        if (isLastRung) {
          throw new ContextTooLargeException(CONTEXT_TOO_LARGE_MESSAGE);
        }

        await this.announceRung(rungs[index + 1]?.gaveUp ?? "", "the provider refused the request as too large");
      }
    }

    throw new ContextTooLargeException(CONTEXT_TOO_LARGE_MESSAGE);
  }

  // Once more, after the wait the service named, when it said it was busy (429) or briefly down
  // (503). Asked by hand, that is what a person would do; asked forever, it is a loop nobody
  // chose. A service that is still busy the second time is reported, with its wait, by the
  // exception partial. A status arrives before the first frame of a stream, so nothing said is
  // ever said twice.
  //
  // Said before the pause to whoever is watching, when somebody is: a wait nobody is told about is
  // a window that has stopped for no reason.
  private async onceMoreIfBusy<T>(
    send: () => Promise<T>,
    signal?: AbortSignal,
    announce: (sentence: string) => Promise<void> = async () => {},
  ): Promise<T> {
    try {
      return await send();
    } catch (error: unknown) {
      if (!(error instanceof HttpResponseException) || !ONCE_MORE_STATUSES.has(error.status)) {
        throw error;
      }

      const seconds = secondsToWait(error.retryAfter, this.timeBroker.getCurrentDateTime());

      await this.loggingBroker.logProcess(
        "Decision",
        `Brain -> the service is busy (${String(error.status)}); asking once more in ${String(seconds)} s`,
        true,
      );

      await announce(
        `The model service is busy (${String(error.status)}), so I am trying again in ${String(seconds)} ${seconds === 1 ? "second" : "seconds"}.`,
      );

      await this.timeBroker.delay(seconds * 1_000, signal);

      return await send();
    }
  }

  // How long a streamed turn waits for its first piece. A service that took the request and says
  // nothing back otherwise leaves a window spinning for the platform's own timeout, which is
  // minutes. Only the first piece: once the answer has started it may take as long as it takes,
  // because a long answer is not a slow one.
  //
  // A clock the service can stop, rather than the platform's timeout signal, because a timeout
  // signal cannot be called off once the first piece is in hand, and it would cut a long answer
  // short in the middle. The person's own stop still reaches the request through the same signal.
  private startFirstPieceWait(stop?: AbortSignal): FirstPieceWait {
    const givingUp = new AbortController();
    const calledOff = new AbortController();

    void this.timeBroker.delay(FIRST_PIECE_MINUTES * 60_000, calledOff.signal).then(
      () => givingUp.abort(),
      () => undefined,
    );

    return {
      signal: stop === undefined ? givingUp.signal : AbortSignal.any([stop, givingUp.signal]),
      arrived: () => calledOff.abort(),
      gaveUp: () => givingUp.signal.aborted && stop?.aborted !== true,
    };
  }

  private requireNativeBroker(): GeneratorBrokerV1 {
    if (this.generatorBrokerV1 === null) {
      throw new RangeError("this brain has no native generator; the text protocol is the one in use");
    }

    return this.generatorBrokerV1;
  }

  private async announceRung(gaveUp: string, because: string): Promise<void> {
    await this.loggingBroker.logProcess("Decision", `Brain -> ${because}; ${gaveUp}`, true);
  }

  private async announceDegradation(honorsRequest: boolean): Promise<void> {
    if (!honorsRequest) {
      await this.loggingBroker.logProcess(
        "Decision",
        "Brain -> broker does not honor requests; shape enforced by guardian only",
        true,
      );
    }
  }
}

// Four minutes, not thirty seconds. A Host that sends nothing, not even its headers, until the whole answer
// is ready cannot be told from one that has hung, and a coding turn with a long history on somebody's
// own hardware takes longer than thirty seconds to be ready. Four is long enough for that, and short
// enough to be said before the platform gives up at five with "nothing answered", which is wrong.
const FIRST_PIECE_MINUTES = 4;

interface FirstPieceWait {
  readonly signal: AbortSignal;
  readonly arrived: () => void;
  readonly gaveUp: () => boolean;
}

// What fetch, and a reader over its body, raise when their signal is aborted.
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

const ONCE_MORE_STATUSES = new Set([429, 503]);
const LONGEST_WAIT_SECONDS = 30;
const UNSAID_WAIT_SECONDS = 2;

// Retry-After in whole seconds: a number of seconds as it is, a date as the time until it, and
// nothing at all as a short pause. Capped, because a service that says "come back in an hour" has
// said this turn will not be answered, and waiting an hour to find that out is worse than being told.
function secondsToWait(retryAfter: string | null, now: Date): number {
  const trimmed = (retryAfter ?? "").trim();

  if (/^\d+$/.test(trimmed)) {
    return Math.min(Number(trimmed), LONGEST_WAIT_SECONDS);
  }

  const at = Date.parse(trimmed);

  if (Number.isNaN(at)) {
    return UNSAID_WAIT_SECONDS;
  }

  return Math.min(Math.max(0, Math.ceil((at - now.getTime()) / 1_000)), LONGEST_WAIT_SECONDS);
}

const CONTEXT_TOO_LARGE_MESSAGE =
  "The conversation is too large for this model's context, and every reduction the client can make has been made.";

// The provider's own refusal, read by status rather than by message text: 400 and 413 are the two
// it arrives as, and a message is a sentence a provider may reword tomorrow (SPEC.md 4.10).
function isTooLarge(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return false;
  }

  const status = (error as { status: unknown }).status;

  if (status !== 400 && status !== 413) {
    return false;
  }

  const body = "body" in error ? String((error as { body: unknown }).body).toLowerCase() : "";

  return body.includes("context") || body.includes("token") || body.includes("too large") || body.includes("length");
}
