import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { ToolBroker } from "../../../brokers/tools/ToolBroker.js";
import { createTryCatchHandles, createTryCatchRun, type TryCatch } from "./InternalToolService.Exceptions.js";
import { validateName } from "./InternalToolService.Validations.js";

// The Direction nature's internal tool foundation (SPEC.md 4.2, 8.1): one tool broker, the name
// validated before the registry is touched, a tool that fails localised as a dependency fault.
export class InternalToolService {
  private readonly toolBroker: ToolBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatchHandles: TryCatch;
  private readonly tryCatchRun: TryCatch;

  public constructor(toolBroker: ToolBroker, loggingBroker: LoggingBroker) {
    this.toolBroker = toolBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatchHandles = createTryCatchHandles(this.loggingBroker);
    this.tryCatchRun = createTryCatchRun(this.loggingBroker);
  }

  public handles(name: string): Promise<boolean> {
    return this.tryCatchHandles(async () => {
      validateName(name);

      return await this.toolBroker.has(name);
    });
  }

  public run(name: string, input: string): Promise<string> {
    return this.tryCatchRun(async () => {
      validateName(name);

      return await this.toolBroker.run(name, input);
    });
  }
}
