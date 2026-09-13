import type { AgentSession } from "../../models/brokers/sessions/AgentSession.js";

// The Data nature's session store (SPEC.md 4.11): the conversation a prompt belongs to, read
// before a run and written after it under the version the read carried.
export interface SessionBroker {
  selectSession(sessionId: string): Promise<AgentSession | null>;
  upsertSession(session: AgentSession): Promise<void>;

  // Every session the store holds, for the list a user picks from. Ids rather than sessions,
  // because a listing that read every session whole would pay for every turn ever recorded to
  // show a name.
  selectSessionIds(): Promise<readonly string[]>;

  // Removing a session that is not there is not an error: the caller asked for it to be gone.
  deleteSession(sessionId: string): Promise<void>;
}
