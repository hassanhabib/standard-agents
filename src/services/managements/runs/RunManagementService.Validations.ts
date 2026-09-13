import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { InvalidAgentException } from "../../../models/coordinations/agents/exceptions/InvalidAgentException.js";

// The validation partial: a run needs a prompt, and a session belongs to the principal that
// opened it. A session with no owner is the anonymous, shared-by-id one; one with an owner admits
// that owner and no one else (SPEC.md 4.11).
export function validatePrompt(prompt: string): void {
  if (prompt.trim().length === 0) {
    throw new InvalidAgentException("Invalid prompt. Please correct the error and try again.");
  }
}

export function validateSessionOwner(session: AgentSession | null, principal: string): void {
  if (session !== null && session.owner.length > 0 && session.owner !== principal) {
    throw new InvalidAgentException("Invalid session. It belongs to another principal; use a session of your own.");
  }
}
