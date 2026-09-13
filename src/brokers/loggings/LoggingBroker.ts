import type { AgentStep } from "../../models/loggings/AgentStep.js";

// The logging utility broker: the run's trace and the operational log. A support broker every
// tier may hold (SPEC.md 4.1); it forwards and never decides.
export interface LoggingBroker {
  logInformation(message: string): Promise<void>;
  logTrace(message: string): Promise<void>;
  logDebug(message: string): Promise<void>;
  logWarning(message: string): Promise<void>;
  logError(error: Error): Promise<void>;
  logCritical(error: Error): Promise<void>;
  logReset(): Promise<void>;
  logTurn(turn: number): Promise<void>;
  logOutcome(message: string): Promise<void>;
  logStep(step: AgentStep): Promise<void>;
  logProcess(actor: string, message: string, detail?: boolean): Promise<void>;
  logPayload(actor: string, summary: string, payload: string, detail: boolean): Promise<void>;
}
