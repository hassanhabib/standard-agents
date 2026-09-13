import { isBounded, type AgentBudget } from "../../../models/coordinations/agents/AgentBudget.js";

// Exhaustion and cancellation are reported distinguishably from a refusal (SPEC.md 4.10): a
// caller that cannot tell "I will not" from "I ran out" cannot decide whether to retry.

export const CANCELLED_MESSAGE = "The request was cancelled before it completed.";
export const TOKEN_BUDGET_MESSAGE = "The token budget for this request was exhausted before it completed.";
export const COST_BUDGET_MESSAGE = "The cost budget for this request was exhausted before it completed.";
export const TIME_BUDGET_MESSAGE = "The time budget for this request was exhausted before it completed.";

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
