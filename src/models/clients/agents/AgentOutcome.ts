import type { AgentStatus } from "../../orchestrations/agents/AgentStatus.js";
import type { AgentEffect } from "../../orchestrations/effects/AgentEffect.js";
import type { AgentFailure } from "./AgentFailure.js";

// What a run reports when it ends (SPEC.md 4.13, 4.14). Only Responded makes result an answer;
// a held run carries the act it is waiting on as pendingEffect; a failed run names why.
export interface AgentOutcome {
  readonly result: string;
  readonly status: AgentStatus;
  readonly pendingEffect: AgentEffect | null;
  readonly failure: AgentFailure | null;
}
