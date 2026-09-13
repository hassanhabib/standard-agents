import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { AgentOrchestrationValidationException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationValidationException.js";
import { FailedAgentOrchestrationServiceException } from "../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";
import { NullAgentContextException } from "../../../models/orchestrations/agents/exceptions/NullAgentContextException.js";

// The exception partial: what this tier validates is its own fault to categorise. The regions
// localise their own foundations' failures, so what arrives from them is already in this family
// and already logged; wrapping it again would nest the same failure twice and log it twice.
// Anything nobody categorised is this service failing.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof NullAgentContextException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      if (isAlreadyLocalised(error)) {
        throw error;
      }

      const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
        "Failed agent orchestration service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedAgentOrchestrationServiceException);
    }
  };
}

function isAlreadyLocalised(error: unknown): boolean {
  return (
    error instanceof AgentOrchestrationDependencyValidationException ||
    error instanceof AgentOrchestrationDependencyException ||
    error instanceof AgentOrchestrationServiceException
  );
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentOrchestrationValidationException> {
  const agentOrchestrationValidationException = new AgentOrchestrationValidationException(
    "Agent orchestration validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(agentOrchestrationValidationException);

  return agentOrchestrationValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentOrchestrationServiceException> {
  const agentOrchestrationServiceException = new AgentOrchestrationServiceException(
    "Agent orchestration service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(agentOrchestrationServiceException);

  return agentOrchestrationServiceException;
}
