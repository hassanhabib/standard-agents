import type { AgentStep } from "../../models/loggings/AgentStep.js";
import type { LoggingBroker } from "./LoggingBroker.js";

// The silent logging broker: what a composition gets when no trace was asked for.
export class NotConfiguredLoggingBroker implements LoggingBroker {
  public async logInformation(_message: string): Promise<void> {}

  public async logTrace(_message: string): Promise<void> {}

  public async logDebug(_message: string): Promise<void> {}

  public async logWarning(_message: string): Promise<void> {}

  public async logError(_error: Error): Promise<void> {}

  public async logCritical(_error: Error): Promise<void> {}

  public async logReset(): Promise<void> {}

  public async logTurn(_turn: number): Promise<void> {}

  public async logOutcome(_message: string): Promise<void> {}

  public async logStep(_step: AgentStep): Promise<void> {}

  public async logProcess(_actor: string, _message: string, _detail?: boolean): Promise<void> {}

  public async logPayload(_actor: string, _summary: string, _payload: string, _detail: boolean): Promise<void> {}
}
