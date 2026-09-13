import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { UsageBroker } from "../../../brokers/usages/UsageBroker.js";
import type { AgentUsage } from "../../../models/foundations/usages/AgentUsage.js";
import { createTryCatch, type TryCatch } from "./UsageService.Exceptions.js";

// The usage foundation (SPEC.md 3.4, 4.10): what a generation cost when the provider did not
// say. Every count made here is marked estimated, so a budget knows how much to trust it.
export class UsageService {
  private readonly usageBroker: UsageBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(usageBroker: UsageBroker, loggingBroker: LoggingBroker) {
    this.usageBroker = usageBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public measure(prompt: string, completion: string): Promise<AgentUsage> {
    return this.tryCatch(async () => {
      const promptTokens = await this.usageBroker.countTokens(prompt);
      const completionTokens = await this.usageBroker.countTokens(completion);

      return { promptTokens, completionTokens, isEstimated: true };
    });
  }
}
