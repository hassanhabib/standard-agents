import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import { ContractDependencyException } from "../../../../models/foundations/contracts/exceptions/ContractDependencyException.js";
import { ContractServiceException } from "../../../../models/foundations/contracts/exceptions/ContractServiceException.js";
import { ContractValidationException } from "../../../../models/foundations/contracts/exceptions/ContractValidationException.js";
import { GateDependencyException } from "../../../../models/foundations/gates/exceptions/GateDependencyException.js";
import { GateDependencyValidationException } from "../../../../models/foundations/gates/exceptions/GateDependencyValidationException.js";
import { GateServiceException } from "../../../../models/foundations/gates/exceptions/GateServiceException.js";
import { GateValidationException } from "../../../../models/foundations/gates/exceptions/GateValidationException.js";
import { JudgeDependencyException } from "../../../../models/foundations/judges/exceptions/JudgeDependencyException.js";
import { JudgeDependencyValidationException } from "../../../../models/foundations/judges/exceptions/JudgeDependencyValidationException.js";
import { JudgeServiceException } from "../../../../models/foundations/judges/exceptions/JudgeServiceException.js";
import { JudgeValidationException } from "../../../../models/foundations/judges/exceptions/JudgeValidationException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";

// A region localises its foundations' failures into the orchestration family, so the tier above
// never has to know which guardian was behind the verdict it asked for. The categorical wrapper
// the foundation threw is unwrapped: the local exception beneath it is what the family carries.
// Anything else is this service failing.

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
    error instanceof GateValidationException ||
    error instanceof GateDependencyValidationException ||
    error instanceof JudgeValidationException ||
    error instanceof JudgeDependencyValidationException ||
    error instanceof ContractValidationException
  );
}

function isDependency(error: unknown): error is { innerError: Error } {
  return (
    error instanceof GateDependencyException ||
    error instanceof GateServiceException ||
    error instanceof JudgeDependencyException ||
    error instanceof JudgeServiceException ||
    error instanceof ContractDependencyException ||
    error instanceof ContractServiceException
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
