import { AGENT_STEP_INDEX, type AgentStep } from "../../models/loggings/AgentStep.js";
import { TRACE_VERBOSITY_LEVEL, type TraceVerbosity } from "../../models/loggings/TraceVerbosity.js";
import type { LoggingBroker } from "./LoggingBroker.js";

// The reference's trace shape over one writable stream: a turn header, a numbered step per
// nature, a numbered process line per event, and an outcome line with the elapsed time.
export class StreamLoggingBroker implements LoggingBroker {
  private readonly write: (line: string) => void;
  private readonly verbosity: TraceVerbosity;
  private processIndex = 0;
  private startedOn = Date.now();

  public constructor(write: (line: string) => void, verbosity: TraceVerbosity = "Full") {
    this.write = write;
    this.verbosity = verbosity;
  }

  public async logInformation(message: string): Promise<void> {
    this.write(message);
  }

  public async logTrace(message: string): Promise<void> {
    this.write(message);
  }

  public async logDebug(message: string): Promise<void> {
    this.write(message);
  }

  public async logWarning(message: string): Promise<void> {
    this.write(`WARNING: ${message}`);
  }

  public async logError(error: Error): Promise<void> {
    this.write(`  -> ERROR: ${error.message.replace(/\r?\n/g, " ")}`);
  }

  public async logCritical(error: Error): Promise<void> {
    this.write(`  -> CRITICAL: ${error.message.replace(/\r?\n/g, " ")}`);
  }

  public async logReset(): Promise<void> {
    this.processIndex = 0;
    this.startedOn = Date.now();
  }

  public async logTurn(turn: number): Promise<void> {
    this.write(`\nTurn ${turn}`);
  }

  public async logOutcome(message: string): Promise<void> {
    const elapsed = Date.now() - this.startedOn;
    this.write(`  -> ${message} (${elapsed}ms)`);
  }

  public async logStep(step: AgentStep): Promise<void> {
    this.processIndex = 0;

    if (TRACE_VERBOSITY_LEVEL.Natures <= TRACE_VERBOSITY_LEVEL[this.verbosity]) {
      this.write(`  Step ${AGENT_STEP_INDEX[step]}: ${step}`);
    }
  }

  public async logProcess(actor: string, message: string, detail = false): Promise<void> {
    const level = detail ? TRACE_VERBOSITY_LEVEL.Full : TRACE_VERBOSITY_LEVEL.Natures;

    if (level <= TRACE_VERBOSITY_LEVEL[this.verbosity]) {
      this.processIndex += 1;
      const indented = message.replace(/\r?\n/g, "\n      ");
      this.write(`    Process ${this.processIndex}: ${actor}: ${indented}`);
    }
  }

  public async logPayload(actor: string, summary: string, payload: string, detail: boolean): Promise<void> {
    const separator = payload.includes("\n") ? "\n" : " ";
    await this.logProcess(actor, `${summary} ->${separator}${payload}`, detail);
  }
}
