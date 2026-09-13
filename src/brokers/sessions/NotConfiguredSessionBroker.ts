import type { AgentSession } from "../../models/brokers/sessions/AgentSession.js";
import type { SessionBroker } from "./SessionBroker.js";

// No sessions configured: every prompt is its own conversation.
export class NotConfiguredSessionBroker implements SessionBroker {
  public async selectSession(_sessionId: string): Promise<AgentSession | null> {
    return null;
  }

  public async upsertSession(_session: AgentSession): Promise<void> {}

  public async selectSessionIds(): Promise<readonly string[]> {
    return [];
  }

  public async deleteSession(_sessionId: string): Promise<void> {}
}
