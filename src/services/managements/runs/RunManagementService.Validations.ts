import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { InvalidAgentException } from "../../../models/coordinations/agents/exceptions/InvalidAgentException.js";

// The validation partial: a run needs a prompt, and a session belongs to the principal that
// opened it. A session with no owner is the anonymous, shared-by-id one; one with an owner admits
// that owner and no one else (SPEC.md 4.11).
// A run needs a prompt, unless it is answering an act it already proposed.
//
// Pressing Allow on a card is not a sentence. A client that had to invent one to resume would be
// writing words into somebody's conversation and then showing them back as theirs, and the entry
// for that turn would be headed by something they never said.
export function validatePrompt(prompt: string, answering: boolean = false): void {
  if (prompt.trim().length === 0 && !answering) {
    throw new InvalidAgentException("Invalid prompt. Please correct the error and try again.");
  }
}

export function validateSessionOwner(session: AgentSession | null, principal: string): void {
  if (session !== null && session.owner.length > 0 && session.owner !== principal) {
    throw new InvalidAgentException("Invalid session. It belongs to another principal; use a session of your own.");
  }
}
