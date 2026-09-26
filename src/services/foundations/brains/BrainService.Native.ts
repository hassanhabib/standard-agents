import {
  assistantMessage,
  systemMessage,
  toolMessage,
  userMessage,
  type ConversationMessage,
} from "../../../models/brokers/generators/v1/ConversationMessage.js";
import type { ToolExchange } from "../../../models/orchestrations/agents/ToolExchange.js";
import type { NativeAsk, NativeOptions } from "../../../models/foundations/brains/NativeAsk.js";

// The conversation the native protocol sends, built from what the run knows (SPEC.md 17.1). The
// order is the wire contract's and is not the agent's to improvise: a provider reads a
// conversation, and a conversation that does not alternate the way it expects is a conversation
// it answers badly.

const ELIDED_RESULT = (bytes: number): string => `[result elided by client: ${bytes} bytes]`;

export function buildConversation(ask: NativeAsk, elisionWindow: number): readonly ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  // Short by design. The orchestrator prepends its own identity and discipline, and two systems
  // arguing about who the agent is helps nobody.
  if (ask.systemPrompt.trim().length > 0) {
    messages.push(systemMessage(ask.systemPrompt));
  }

  // Which calls keep their results, counted over the whole conversation rather than per turn, so
  // the window means the same thing however the calls were distributed across turns.
  const keptCallIds = recentCallIds(ask, elisionWindow);

  for (const turn of ask.history) {
    messages.push(userMessage(turn.prompt));
    messages.push(...exchangeMessages(turn.exchanges, keptCallIds));

    // A turn that ended without an answer, cancelled or held, contributes its calls and no reply,
    // because there was none and inventing one would teach the model to expect it.
    if (turn.answer.length > 0) {
      messages.push(assistantMessage(turn.answer));
    }
  }

  messages.push(userMessage(ask.prompt));
  messages.push(...exchangeMessages(ask.exchanges, keptCallIds));

  const unaccounted = observationsNoExchangeAccountsFor(ask);

  if (unaccounted.length > 0) {
    messages.push(assistantMessage(`Observations so far:\n${unaccounted.map((line) => `- ${line}`).join("\n")}`));
  }

  return messages;
}

// A call and its answer, as the two messages the wire wants: the assistant's call, then the tool's
// reply bound to it by id. An elided call keeps what it was and loses what it returned, so the
// model still knows the act happened and does not read the bytes again.
function exchangeMessages(exchanges: readonly ToolExchange[], keptCallIds: ReadonlySet<string>): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  for (const exchange of exchanges) {
    messages.push(
      assistantMessage(exchange.assistantContent ?? "", [
        { id: exchange.callId, name: exchange.toolName, argumentsJson: exchange.argumentsJson },
      ]),
    );

    const kept = keptCallIds.has(exchange.callId);
    const content = kept ? exchange.result : ELIDED_RESULT(Buffer.byteLength(exchange.result, "utf8"));
    messages.push(toolMessage(exchange.callId, exchange.toolName, content));
  }

  return messages;
}

function recentCallIds(ask: NativeAsk, elisionWindow: number): ReadonlySet<string> {
  const everyExchange = [...ask.history.flatMap((turn) => turn.exchanges), ...ask.exchanges];
  const kept = elisionWindow <= 0 ? [] : everyExchange.slice(-elisionWindow);
  const keptCallIds = new Set(kept.map((exchange) => exchange.callId));

  for (const exchange of kept) {
    const answered = exchange.replayed === true ? callItReplays(everyExchange, exchange) : undefined;

    if (answered !== undefined) {
      keptCallIds.add(answered.callId);
    }
  }

  return keptCallIds;
}

// A replay tells the model its answer is above. Watched live: a file read in pages, the first page
// pushed out of the window by the later ones, then asked for again, and "above" was a marker. The
// model was told to use what it could not see, and read the same file forty more times. So the call
// a replay stands for stays in view as long as the replay does: the latest one with the same tool
// and arguments that actually ran, because that is the answer the ledger handed back.
function callItReplays(everyExchange: readonly ToolExchange[], replay: ToolExchange): ToolExchange | undefined {
  const earlierNewestFirst = everyExchange.slice(0, everyExchange.indexOf(replay)).reverse();

  return earlierNewestFirst.find(
    (exchange) =>
      exchange.replayed !== true &&
      exchange.toolName === replay.toolName &&
      exchange.argumentsJson === replay.argumentsJson,
  );
}

// An observation a call already answers for is not said twice: the exchange carries it in the
// shape the provider expects. What is left is what no call accounts for, a denial, a refusal, a
// withheld result, and that still has to reach the model or it will propose the act again.
function observationsNoExchangeAccountsFor(ask: NativeAsk): readonly string[] {
  const accountedFor = new Set(ask.exchanges.map((exchange) => `${exchange.toolName}: ${exchange.result}`));

  return ask.observations.filter((observation) => !accountedFor.has(observation));
}

// The rungs of the degradation ladder, in order (SPEC.md 10.3). Each gives up something the one
// before it kept: first the old results, then the old turns. Nothing gives up the current prompt.
export function ladderRungs(ask: NativeAsk, options: NativeOptions): ReadonlyArray<{ ask: NativeAsk; elisionWindow: number; gaveUp: string }> {
  const halved = Math.floor(options.maxHistoryTurns / 2);

  return [
    { ask, elisionWindow: options.elisionWindow, gaveUp: "" },
    { ask, elisionWindow: 1, gaveUp: "shrank the elision window to 1" },
    {
      ask: { ...ask, history: ask.history.slice(-Math.max(halved, 1)) },
      elisionWindow: 1,
      gaveUp: `kept the newest ${Math.max(halved, 1)} conversation turn(s)`,
    },
  ];
}

// An estimate, and the ladder treats it as one: it decides whether to climb down before sending,
// never whether the answer is right. The provider's own refusal is the authority, and this only
// saves a round trip against a request that plainly will not fit.
export function overContextBudget(messages: readonly ConversationMessage[], options: NativeOptions): boolean {
  if (options.contextLength === null) {
    return false;
  }

  const characters = messages.reduce((total, message) => total + message.content.length + message.name.length, 0);

  return characters > options.contextLength * options.charactersPerToken;
}
