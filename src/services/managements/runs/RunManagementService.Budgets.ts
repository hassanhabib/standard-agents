import { isBounded, type AgentBudget } from "../../../models/coordinations/agents/AgentBudget.js";

// Exhaustion and cancellation are reported distinguishably from a refusal (SPEC.md 4.10): a
// caller that cannot tell "I will not" from "I ran out" cannot decide whether to retry.

export const CANCELLED_MESSAGE = "The request was cancelled before it completed.";
export const TOKEN_BUDGET_MESSAGE = "The token budget for this request was exhausted before it completed.";
export const COST_BUDGET_MESSAGE = "The cost budget for this request was exhausted before it completed.";
export const TIME_BUDGET_MESSAGE = "The time budget for this request was exhausted before it completed.";

// Going in circles is reported the same way, because it is the same kind of stop: not a refusal
// and not an answer, and a caller that cannot tell the two apart cannot decide what to do next.
export const CIRCLES_MESSAGE = (times: number): string =>
  `I asked for the same thing ${WORDS[times] ?? String(times)} times and stopped: the run was going in circles, so it ended ` +
  `rather than spend the rest of its turns the same way; nothing was delivered.`;

const WORDS: Readonly<Record<number, string>> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };

// Whether the act this run just made is the one it has been making, as many times as the limit
// allows. Counted over the run's own exchanges, which is what the native protocol keeps; the text
// protocol keeps none and stays on the turn cap, as it always has.
//
// Watched live, twice: the replay note said "use it and do something else", the note-only replay
// said it again, and the model asked eleven more times with the note in front of it. A note is
// not enough for every model.
export function goingInCircles(exchanges: ReadonlyArray<{ readonly toolName: string; readonly argumentsJson: string }>, limit: number): boolean {
  const last = exchanges.at(-1);

  if (last === undefined) {
    return false;
  }

  const same = exchanges.filter((exchange) => exchange.toolName === last.toolName && exchange.argumentsJson === last.argumentsJson).length;

  return same >= limit;
}

// What one run has consumed so far. Tokens accumulate from what the turns reported, counted or
// reported alike, because a bound enforced on nothing is not a bound.
export interface AgentSpend {
  tokens: number;
}

export function exhaustion(budget: AgentBudget | null, spend: AgentSpend, startedOn: Date, now: Date): string | null {
  if (budget === null || !isBounded(budget)) {
    return null;
  }

  if (budget.maxTokens !== null && spend.tokens >= budget.maxTokens) {
    return TOKEN_BUDGET_MESSAGE;
  }

  if (budget.maxCostUsd !== null && (spend.tokens / 1000) * budget.costPerThousandTokens >= budget.maxCostUsd) {
    return COST_BUDGET_MESSAGE;
  }

  if (budget.maxWallClockMilliseconds !== null && now.getTime() - startedOn.getTime() >= budget.maxWallClockMilliseconds) {
    return TIME_BUDGET_MESSAGE;
  }

  return null;
}
