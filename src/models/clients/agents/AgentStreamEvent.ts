import type { AgentStreamEventType } from "./AgentStreamEventType.js";

export interface AgentStreamEvent {
  readonly type: AgentStreamEventType;
  readonly content: string;
}
