import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedInternalToolDependencyException } from "../../../models/foundations/internalTools/exceptions/FailedInternalToolDependencyException.js";
import { FailedInternalToolServiceException } from "../../../models/foundations/internalTools/exceptions/FailedInternalToolServiceException.js";
import { InternalToolDependencyException } from "../../../models/foundations/internalTools/exceptions/InternalToolDependencyException.js";
import { InternalToolServiceException } from "../../../models/foundations/internalTools/exceptions/InternalToolServiceException.js";
import { InternalToolValidationException } from "../../../models/foundations/internalTools/exceptions/InternalToolValidationException.js";
import { InvalidInternalToolException } from "../../../models/foundations/internalTools/exceptions/InvalidInternalToolException.js";

// The exception partial (SPEC-cli 3.1). Asking whether a tool exists can only fail on the name or
// in the service itself; running one can also fail in the tool, which is a dependency fault. A
// name the registry does not hold is the registry refusing, so it is a dependency fault too, and
// so is anything a tool throws: the tool is the dependency.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatchHandles(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidInternalToolException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedInternalToolServiceException = new FailedInternalToolServiceException(
        "Failed internal tool service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedInternalToolServiceException);
    }
  };
}

export function createTryCatchRun(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidInternalToolException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedInternalToolDependencyException = new FailedInternalToolDependencyException(
        "Failed internal tool dependency error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogDependencyException(loggingBroker, failedInternalToolDependencyException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<InternalToolValidationException> {
  const internalToolValidationException = new InternalToolValidationException(
    "Internal tool validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(internalToolValidationException);

  return internalToolValidationException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<InternalToolDependencyException> {
  const internalToolDependencyException = new InternalToolDependencyException(
    "Internal tool dependency error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(internalToolDependencyException);

  return internalToolDependencyException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<InternalToolServiceException> {
  const internalToolServiceException = new InternalToolServiceException(
    "Internal tool service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(internalToolServiceException);

  return internalToolServiceException;
}
