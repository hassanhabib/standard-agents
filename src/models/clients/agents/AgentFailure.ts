// Why a run ended Failed, in a shape a caller can act on. Additive over the reference and
// unasserted by the vectors: code is a framework code, and the inner error beneath the outcome
// carries the provider's status and body.
export type AgentFailureCode =
  | "cancelled"
  | "budget_exhausted"
  | "turns_exhausted"
  | "content_filter"
  | "dependency";

export type AgentFailureCategory =
  | "Validation"
  | "DependencyValidation"
  | "Dependency"
  | "Service";

export interface AgentFailure {
  readonly category: AgentFailureCategory;
  readonly code: AgentFailureCode;
  readonly message: string;
}
