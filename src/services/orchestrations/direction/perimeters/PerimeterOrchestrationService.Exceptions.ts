import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import { ApprovalDependencyException } from "../../../../models/foundations/approvals/exceptions/ApprovalDependencyException.js";
import { ApprovalDependencyValidationException } from "../../../../models/foundations/approvals/exceptions/ApprovalDependencyValidationException.js";
import { ApprovalServiceException } from "../../../../models/foundations/approvals/exceptions/ApprovalServiceException.js";
import { ApprovalValidationException } from "../../../../models/foundations/approvals/exceptions/ApprovalValidationException.js";
import { EffectLedgerDependencyException } from "../../../../models/foundations/effects/exceptions/EffectLedgerDependencyException.js";
import { EffectLedgerDependencyValidationException } from "../../../../models/foundations/effects/exceptions/EffectLedgerDependencyValidationException.js";
import { EffectLedgerServiceException } from "../../../../models/foundations/effects/exceptions/EffectLedgerServiceException.js";
import { EffectLedgerValidationException } from "../../../../models/foundations/effects/exceptions/EffectLedgerValidationException.js";
import { PolicyDependencyException } from "../../../../models/foundations/policies/exceptions/PolicyDependencyException.js";
import { PolicyDependencyValidationException } from "../../../../models/foundations/policies/exceptions/PolicyDependencyValidationException.js";
import { PolicyServiceException } from "../../../../models/foundations/policies/exceptions/PolicyServiceException.js";
import { PolicyValidationException } from "../../../../models/foundations/policies/exceptions/PolicyValidationException.js";
import { AgentOrchestrationDependencyException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import { AgentOrchestrationDependencyValidationException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyValidationException.js";
import { AgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/AgentOrchestrationServiceException.js";
import { FailedAgentOrchestrationServiceException } from "../../../../models/orchestrations/agents/exceptions/FailedAgentOrchestrationServiceException.js";

// A region localises its foundations' failures into the orchestration family, so the tier above
// never has to know which authority was behind the answer it asked for. The categorical wrapper
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
    error instanceof PolicyValidationException ||
    error instanceof PolicyDependencyValidationException ||
    error instanceof ApprovalValidationException ||
    error instanceof ApprovalDependencyValidationException ||
    error instanceof EffectLedgerValidationException ||
    error instanceof EffectLedgerDependencyValidationException
  );
}

function isDependency(error: unknown): error is { innerError: Error } {
  return (
    error instanceof PolicyDependencyException ||
    error instanceof PolicyServiceException ||
    error instanceof ApprovalDependencyException ||
    error instanceof ApprovalServiceException ||
    error instanceof EffectLedgerDependencyException ||
    error instanceof EffectLedgerServiceException
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
