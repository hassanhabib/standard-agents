import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { AgentCoordinationDependencyException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationDependencyException.js";
import { AgentCoordinationDependencyValidationException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationDependencyValidationException.js";
import { AgentCoordinationValidationException } from "../../../models/coordinations/agents/exceptions/AgentCoordinationValidationException.js";
import { InvalidAgentException } from "../../../models/coordinations/agents/exceptions/InvalidAgentException.js";
import { FailedRunManagementServiceException } from "../../../models/managements/runs/exceptions/FailedRunManagementServiceException.js";
import { RunManagementServiceException } from "../../../models/managements/runs/exceptions/RunManagementServiceException.js";
import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { AgentOrchestrationValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationValidationException.js";

// The exception partial: what the loop validates is its own; what the natures raise arrives in
// the orchestration family and is unwrapped and rewrapped into the coordination family the
// client sees; anything nobody categorised is this service failing.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidAgentException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      if (error instanceof AgentOrchestrationValidationException || error instanceof AgentOrchestrationDependencyValidationException) {
        throw await createAndLogDependencyValidationException(loggingBroker, error.innerError);
      }

      if (error instanceof AgentOrchestrationDependencyException || error instanceof AgentOrchestrationServiceException) {
        throw await createAndLogDependencyException(loggingBroker, error.innerError);
      }

      const failedRunManagementServiceException = new FailedRunManagementServiceException(
        "Failed run management service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedRunManagementServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentCoordinationValidationException> {
  const agentCoordinationValidationException = new AgentCoordinationValidationException(
    "Agent coordination validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(agentCoordinationValidationException);

  return agentCoordinationValidationException;
}

async function createAndLogDependencyValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentCoordinationDependencyValidationException> {
  const agentCoordinationDependencyValidationException = new AgentCoordinationDependencyValidationException(
    "Agent coordination dependency validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(agentCoordinationDependencyValidationException);

  return agentCoordinationDependencyValidationException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentCoordinationDependencyException> {
  const agentCoordinationDependencyException = new AgentCoordinationDependencyException(
    "Agent coordination dependency error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(agentCoordinationDependencyException);

  return agentCoordinationDependencyException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<RunManagementServiceException> {
  const runManagementServiceException = new RunManagementServiceException(
    "Run management service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(runManagementServiceException);

  return runManagementServiceException;
}
