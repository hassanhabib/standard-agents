import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { McpBroker } from "../../../brokers/mcps/McpBroker.js";
import type { McpTool } from "../../../models/brokers/mcps/McpTool.js";
import { createTryCatchCall, createTryCatchRetrieveTools, type TryCatch } from "./ExternalToolService.Exceptions.js";
import { validateName } from "./ExternalToolService.Validations.js";

// The Direction nature's external tool foundation (SPEC.md 4.8 External): remote servers speaking
// the Model Context Protocol. The signal reaches a call in flight so Stop is not a turn-boundary
// promise, and a server that fails is the dependency failing, never a result.
export class ExternalToolService {
  private readonly mcpBroker: McpBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatchCall: TryCatch;
  private readonly tryCatchRetrieveTools: TryCatch;

  public constructor(mcpBroker: McpBroker, loggingBroker: LoggingBroker) {
    this.mcpBroker = mcpBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatchCall = createTryCatchCall(this.loggingBroker);
    this.tryCatchRetrieveTools = createTryCatchRetrieveTools(this.loggingBroker);
  }

  public call(name: string, argumentsJson: string, signal?: AbortSignal): Promise<string> {
    return this.tryCatchCall(async () => {
      validateName(name);

      return await this.mcpBroker.call(name, argumentsJson, signal);
    });
  }

  public retrieveTools(): Promise<readonly McpTool[]> {
    return this.tryCatchRetrieveTools(async () => {
      return await this.mcpBroker.listTools();
    });
  }
}
