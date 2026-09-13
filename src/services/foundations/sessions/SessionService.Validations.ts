import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { InvalidSessionException } from "../../../models/foundations/sessions/exceptions/InvalidSessionException.js";
import { NullSessionException } from "../../../models/foundations/sessions/exceptions/NullSessionException.js";

// The validation partial (SPEC-cli 3.1): a session is looked up by its id, and no id names no
// session; a session that is not there cannot be recorded.
export function validateSessionId(sessionId: string): void {
  if (sessionId.trim().length === 0) {
    throw new InvalidSessionException("Invalid session id. Please correct the error and try again.");
  }
}

export function validateSession(session: AgentSession | null | undefined): asserts session is AgentSession {
  if (session === null || session === undefined) {
    throw new NullSessionException("Session is null.");
  }
}
