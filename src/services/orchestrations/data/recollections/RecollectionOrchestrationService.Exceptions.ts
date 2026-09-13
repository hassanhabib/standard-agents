import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import { MemoryDependencyException } from "../../../../models/foundations/memorys/exceptions/MemoryDependencyException.js";
import { MemoryDependencyValidationException } from "../../../../models/foundations/memorys/exceptions/MemoryDependencyValidationException.js";
import { MemoryServiceException } from "../../../../models/foundations/memorys/exceptions/MemoryServiceException.js";
import { MemoryValidationException } from "../../../../models/foundations/memorys/exceptions/MemoryValidationException.js";
import { SessionDependencyException } from "../../../../models/foundations/sessions/exceptions/SessionDependencyException.js";
import { SessionDependencyValidationException } from "../../../../models/foundations/sessions/exceptions/SessionDependencyValidationException.js";
import { SessionServiceException } from "../../../../models/foundations/sessions/exceptions/SessionServiceException.js";
import { SessionValidationException } from "../../../../models/foundations/sessions/exceptions/SessionValidationException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";

// A region localises its foundations' failures into the orchestration family, so the tier above
// never has to know which store was behind the nature it asked for. The categorical wrapper the
// foundation threw is unwrapped: the local exception beneath it is what the family carries, and
// a stale session write still reads as itself at the bottom. Anything else is this service
// failing.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (isDependencyValidation(error)) {
        throw await createAndLogDependencyValidationException(loggingBroker, error.innerError);
      }

      if (isDependency(error)) {
        throw await createAndLogDependencyException(loggingBroker, error.innerError);
      }

      const failedAgentOrchestrationServiceException = new FailedAgentOrchestrationServiceException(
        "Failed agent orchestration service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedAgentOrchestrationServiceException);
    }
  };
}

function isDependencyValidation(error: unknown): error is { innerError: Error } {
  return (
    error instanceof MemoryValidationException ||
    error instanceof MemoryDependencyValidationException ||
    error instanceof SessionValidationException ||
    error instanceof SessionDependencyValidationException
  );
}

function isDependency(error: unknown): error is { innerError: Error } {
  return (
    error instanceof MemoryDependencyException ||
    error instanceof MemoryServiceException ||
    error instanceof SessionDependencyException ||
    error instanceof SessionServiceException
  );
}

async function createAndLogDependencyValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentOrchestrationDependencyValidationException> {
  const agentOrchestrationDependencyValidationException = new AgentOrchestrationDependencyValidationException(
    "Agent orchestration dependency validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(agentOrchestrationDependencyValidationException);

  return agentOrchestrationDependencyValidationException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<AgentOrchestrationDependencyException> {
  const agentOrchestrationDependencyException = new AgentOrchestrationDependencyException(
    "Agent orchestration dependency error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(agentOrchestrationDependencyException);

  return agentOrchestrationDependencyException;
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
