import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { ExternalToolService } from "../../../foundations/externalTools/ExternalToolService.js";
import type { InternalToolService } from "../../../foundations/internalTools/InternalToolService.js";
import type { ReturnService } from "../../../foundations/returns/ReturnService.js";
import { createTryCatch, type TryCatch } from "./ExecutionOrchestrationService.Exceptions.js";

// Perform it, or answer (SPEC.md 4.2, 8.1). The three ways an act leaves the agent: a local
// tool, a tool across the boundary, or the terminal that hands the result back and touches
// nothing.
export class ExecutionOrchestrationService {
  private readonly internalToolService: InternalToolService;
  private readonly externalToolService: ExternalToolService;
  private readonly returnService: ReturnService;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(
    internalToolService: InternalToolService,
    externalToolService: ExternalToolService,
    returnService: ReturnService,
    loggingBroker: LoggingBroker,
  ) {
    this.internalToolService = internalToolService;
    this.externalToolService = externalToolService;
    this.returnService = returnService;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  // True when a local tool answers to this name.
  public handlesLocally(toolName: string): Promise<boolean> {
    return this.tryCatch(async () => await this.internalToolService.handles(toolName));
  }

  // Local first, then across the boundary. A name the agent owns is never sent outward, and the
  // signal reaches a remote call in flight so Stop is not a turn-boundary promise.
  public run(toolName: string, payload: string, signal?: AbortSignal): Promise<string> {
    return this.tryCatch(async () => {
      const isLocalTool = await this.internalToolService.handles(toolName);

      return isLocalTool
        ? await this.internalToolService.run(toolName, payload)
        : await this.externalToolService.call(toolName, payload, signal);
    });
  }

  public return(payload: string): Promise<string> {
    return this.tryCatch(async () => await this.returnService.return(payload));
  }
}
