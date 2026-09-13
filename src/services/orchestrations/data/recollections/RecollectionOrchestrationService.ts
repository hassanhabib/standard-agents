import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { AgentSession } from "../../../../models/brokers/sessions/AgentSession.js";
import type { MemoryService } from "../../../foundations/memorys/MemoryService.js";
import type { SessionService } from "../../../foundations/sessions/SessionService.js";
import { createTryCatch, type TryCatch } from "./RecollectionOrchestrationService.Exceptions.js";

// What the agent accumulated, replayed (SPEC.md 4.2, 4.11). Memory and the session share a
// region for the same reason skills and knowledge do: both are written by the agent's own past
// rather than by an author, and both are replayed rather than searched. Memory is what it
// learned across conversations; the session is this one.
export class RecollectionOrchestrationService {
  private readonly memoryService: MemoryService;
  private readonly sessionService: SessionService;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(memoryService: MemoryService, sessionService: SessionService, loggingBroker: LoggingBroker) {
    this.memoryService = memoryService;
    this.sessionService = sessionService;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public recallMemories(): Promise<readonly string[]> {
    return this.tryCatch(async () => {
      const memories = await this.memoryService.recall();
      await this.loggingBroker.logProcess("Data", `Recalled ${memories.length} memories`);

      return memories;
    });
  }

  public remember(memory: string): Promise<void> {
    return this.tryCatch(async () => {
      await this.memoryService.remember(memory);
    });
  }

  // Loading a conversation is recall, which is why the session belongs to Data and not to the
  // loop that reads it.
  public recallSession(sessionId: string): Promise<AgentSession | null> {
    return this.tryCatch(async () => await this.sessionService.retrieve(sessionId));
  }

  public recordSession(session: AgentSession): Promise<void> {
    return this.tryCatch(async () => {
      await this.sessionService.record(session);
    });
  }
}
