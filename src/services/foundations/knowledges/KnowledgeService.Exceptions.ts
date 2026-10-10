import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedKnowledgeDependencyException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeDependencyException.js";
import { FailedKnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeServiceException.js";
import { InvalidKnowledgeException } from "../../../models/foundations/knowledges/exceptions/InvalidKnowledgeException.js";
import { KnowledgeDependencyException } from "../../../models/foundations/knowledges/exceptions/KnowledgeDependencyException.js";
import { KnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/KnowledgeServiceException.js";
import { KnowledgeValidationException } from "../../../models/foundations/knowledges/exceptions/KnowledgeValidationException.js";

// The exception partial (SPEC-cli 3.1): the knowledge family and its categories. A source that
// fails is the service failing to ground; the loop never proceeds as if nothing was found. A
// knowledge folder that is missing or refused is critical, because the composition points at
// something that is not there; any other file fault is a dependency fault.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

const CRITICAL_CODES = new Set(["ENOENT", "ENOTDIR", "EACCES", "EPERM"]);

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidKnowledgeException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      if (isErrnoException(error) && CRITICAL_CODES.has(error.code ?? "")) {
        throw await createAndLogCriticalDependencyException(loggingBroker, error);
      }

      if (isErrnoException(error)) {
        throw await createAndLogDependencyException(loggingBroker, error);
      }

      const failedKnowledgeServiceException = new FailedKnowledgeServiceException(
        "Failed knowledge service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedKnowledgeServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<KnowledgeValidationException> {
  const knowledgeValidationException = new KnowledgeValidationException(
    "Knowledge validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(knowledgeValidationException);

  return knowledgeValidationException;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === "string";
}

async function createAndLogCriticalDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<KnowledgeDependencyException> {
  const failedKnowledgeDependencyException = new FailedKnowledgeDependencyException(
    "Failed knowledge dependency error occurred, contact support.",
    error,
  );

  const knowledgeDependencyException = new KnowledgeDependencyException(
    "Knowledge dependency error occurred, contact support.",
    failedKnowledgeDependencyException,
  );

  await loggingBroker.logCritical(knowledgeDependencyException);

  return knowledgeDependencyException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<KnowledgeDependencyException> {
  const failedKnowledgeDependencyException = new FailedKnowledgeDependencyException(
    "Failed knowledge dependency error occurred, contact support.",
    error,
  );

  const knowledgeDependencyException = new KnowledgeDependencyException(
    "Knowledge dependency error occurred, contact support.",
    failedKnowledgeDependencyException,
  );

  await loggingBroker.logError(knowledgeDependencyException);

  return knowledgeDependencyException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<KnowledgeServiceException> {
  const knowledgeServiceException = new KnowledgeServiceException(
    "Knowledge service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(knowledgeServiceException);

  return knowledgeServiceException;
}
