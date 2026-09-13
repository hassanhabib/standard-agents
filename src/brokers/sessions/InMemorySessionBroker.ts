import type { AgentSession } from "../../models/brokers/sessions/AgentSession.js";
import { StaleSessionWriteError } from "../../models/brokers/sessions/StaleSessionWriteError.js";
import type { SessionBroker } from "./SessionBroker.js";

// Sessions in one process, with the compare-and-swap rule the file store also keeps: a write
// whose version is not one past the stored version is refused, so the last writer never erases a
// completed turn (SPEC.md 4.11).
export class InMemorySessionBroker implements SessionBroker {
  private readonly sessions = new Map<string, AgentSession>();

  public async selectSession(sessionId: string): Promise<AgentSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  public async upsertSession(session: AgentSession): Promise<void> {
    const stored = this.sessions.get(session.id);
    const storedVersion = stored?.version ?? 0;

    if (session.version !== storedVersion + 1) {
      throw new StaleSessionWriteError(session.id, storedVersion, session.version);
    }

    this.sessions.set(session.id, session);
  }

  public async selectSessionIds(): Promise<readonly string[]> {
    return [...this.sessions.keys()];
  }

  public async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
