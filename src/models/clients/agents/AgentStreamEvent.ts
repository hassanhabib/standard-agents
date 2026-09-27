import type { AgentUsage } from "../../foundations/usages/AgentUsage.js";
import type { AgentStreamEventType } from "./AgentStreamEventType.js";

export interface AgentStreamEvent {
  readonly type: AgentStreamEventType;
  readonly content: string;

  // The run's usage so far, on a Usage event, and absent on every other kind (SPEC.md 4.14.1).
  // Carried whole rather than only as the number in content, because a count is either reported
  // or estimated (SPEC.md 3.4) and the text cannot say which.
  readonly usage?: AgentUsage;
}
