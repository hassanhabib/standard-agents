import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedMemoryServiceException } from "../../../models/foundations/memorys/exceptions/FailedMemoryServiceException.js";
import { InvalidMemoryException } from "../../../models/foundations/memorys/exceptions/InvalidMemoryException.js";
import { MemoryServiceException } from "../../../models/foundations/memorys/exceptions/MemoryServiceException.js";
import { MemoryValidationException } from "../../../models/foundations/memorys/exceptions/MemoryValidationException.js";

// The exception partial (SPEC-cli 3.1): the memory family and its categories. A store that fails
// is the service failing to recall or to remember; the loop never proceeds as if nothing was
// remembered, and never reports a memory kept that the store refused.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatchRecall(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      throw await localiseServiceFailure(loggingBroker, error);
    }
  };
}

export function createTryCatchRemember(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidMemoryException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      throw await localiseServiceFailure(loggingBroker, error);
    }
  };
}

async function localiseServiceFailure(loggingBroker: LoggingBroker, error: unknown): Promise<MemoryServiceException> {
  const failedMemoryServiceException = new FailedMemoryServiceException(
    "Failed memory service error occurred, contact support.",
    error instanceof Error ? error : new Error(String(error)),
  );

  return await createAndLogServiceException(loggingBroker, failedMemoryServiceException);
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<MemoryValidationException> {
  const memoryValidationException = new MemoryValidationException(
    "Memory validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(memoryValidationException);

  return memoryValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<MemoryServiceException> {
  const memoryServiceException = new MemoryServiceException(
    "Memory service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(memoryServiceException);

  return memoryServiceException;
}
