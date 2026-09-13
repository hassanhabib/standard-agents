// What one generation cost (SPEC.md 3.4). isEstimated says the count was made here rather than
// reported by the provider, so a budget knows how much to trust it.
export interface AgentUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly isEstimated: boolean;
}

export const NO_USAGE: AgentUsage = { promptTokens: 0, completionTokens: 0, isEstimated: false };

export function totalTokens(usage: AgentUsage): number {
  return usage.promptTokens + usage.completionTokens;
}
