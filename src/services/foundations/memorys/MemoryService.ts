import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { MemoryBroker } from "../../../brokers/memorys/MemoryBroker.js";
import { createTryCatchRecall, createTryCatchRemember, type TryCatch } from "./MemoryService.Exceptions.js";
import { validateMemory } from "./MemoryService.Validations.js";

// The memory foundation (SPEC.md 4.2, 7 invariant 4): recalled by Data before the brain, written
// by Direction after it, and never held inside the agent between prompts.
export class MemoryService {
  private readonly memoryBroker: MemoryBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatchRecall: TryCatch;
  private readonly tryCatchRemember: TryCatch;

  public constructor(memoryBroker: MemoryBroker, loggingBroker: LoggingBroker) {
    this.memoryBroker = memoryBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatchRecall = createTryCatchRecall(this.loggingBroker);
    this.tryCatchRemember = createTryCatchRemember(this.loggingBroker);
  }

  public recall(): Promise<readonly string[]> {
    return this.tryCatchRecall(async () => {
      return await this.memoryBroker.selectMemories();
    });
  }

  public remember(memory: string): Promise<void> {
    return this.tryCatchRemember(async () => {
      validateMemory(memory);
      await this.memoryBroker.insertMemory(memory);
    });
  }
}
