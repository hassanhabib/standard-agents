import type { AgentStatus } from "../../orchestrations/agents/AgentStatus.js";
import type { AgentEffect } from "../../orchestrations/effects/AgentEffect.js";
import type { AgentTurn } from "./AgentTurn.js";

// The conversation a prompt belongs to, as the store holds it (SPEC.md 4.11). version is the
// compare-and-swap counter: a write based on a read that is no longer current is refused.
export interface AgentSession {
  readonly id: string;
  readonly history: readonly AgentTurn[];
  readonly status: AgentStatus;
  readonly pendingQuestion: string;
  readonly pendingEffect: AgentEffect | null;
  readonly runId: string;
  readonly owner: string;
  readonly version: number;
}
