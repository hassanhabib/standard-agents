import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedKnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeServiceException.js";
import { InvalidKnowledgeException } from "../../../models/foundations/knowledges/exceptions/InvalidKnowledgeException.js";
import { KnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/KnowledgeServiceException.js";
import { KnowledgeValidationException } from "../../../models/foundations/knowledges/exceptions/KnowledgeValidationException.js";

// The exception partial (SPEC-cli 3.1): the knowledge family and its categories. A source that
// fails is the service failing to ground; the loop never proceeds as if nothing was found.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidKnowledgeException) {
        throw await createAndLogValidationException(loggingBroker, error);
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
