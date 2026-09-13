import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { SessionBroker } from "../../../brokers/sessions/SessionBroker.js";
import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { createTryCatchRecord, createTryCatchRetrieve, type TryCatch } from "./SessionService.Exceptions.js";
import { validateSession, validateSessionId } from "./SessionService.Validations.js";

// The session foundation (SPEC.md 4.11): the conversation a prompt belongs to, read before a run
// and recorded after it under the version the read carried.
export class SessionService {
  private readonly sessionBroker: SessionBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatchRetrieve: TryCatch;
  private readonly tryCatchRecord: TryCatch;

  public constructor(sessionBroker: SessionBroker, loggingBroker: LoggingBroker) {
    this.sessionBroker = sessionBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatchRetrieve = createTryCatchRetrieve(this.loggingBroker);
    this.tryCatchRecord = createTryCatchRecord(this.loggingBroker);
  }

  public retrieve(sessionId: string): Promise<AgentSession | null> {
    return this.tryCatchRetrieve(async () => {
      validateSessionId(sessionId);

      return await this.sessionBroker.selectSession(sessionId);
    });
  }

  public record(session: AgentSession): Promise<void> {
    return this.tryCatchRecord(async () => {
      validateSession(session);
      await this.sessionBroker.upsertSession(session);
    });
  }
}
