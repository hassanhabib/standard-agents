// What one prompt is allowed to consume (SPEC.md 4.10). Any bound left null is unbounded, so a
// budget constrains exactly what the host chose to constrain and nothing else. Cost is the token
// count times the rate per thousand tokens, so a cost bound needs a positive rate to ever trip.
export interface AgentBudget {
  readonly maxTokens: number | null;
  readonly maxCostUsd: number | null;
  readonly maxWallClockMilliseconds: number | null;
  readonly costPerThousandTokens: number;
}

export function createAgentBudget(overrides: Partial<AgentBudget> = {}): AgentBudget {
  return {
    maxTokens: null,
    maxCostUsd: null,
    maxWallClockMilliseconds: null,
    costPerThousandTokens: 0,
    ...overrides,
  };
}

export function isBounded(budget: AgentBudget): boolean {
  return budget.maxTokens !== null || budget.maxCostUsd !== null || budget.maxWallClockMilliseconds !== null;
}
