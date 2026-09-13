import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { ExternalToolDependencyException } from "../../../models/foundations/externalTools/exceptions/ExternalToolDependencyException.js";
import { ExternalToolValidationException } from "../../../models/foundations/externalTools/exceptions/ExternalToolValidationException.js";
import { FailedExternalToolDependencyException } from "../../../models/foundations/externalTools/exceptions/FailedExternalToolDependencyException.js";
import { InvalidExternalToolException } from "../../../models/foundations/externalTools/exceptions/InvalidExternalToolException.js";

// The exception partial (SPEC-cli 3.1): the external tool family and its categories. The remote
// server is the dependency, so whatever it throws, including a call the signal cut short, is a
// dependency fault: the loop hears that the act did not complete, never a result it invented.
// A server that cannot list its tools is the same fault; the loop never advertises tools it
// could not see.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatchCall(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidExternalToolException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      throw await localiseDependencyFailure(loggingBroker, error);
    }
  };
}

export function createTryCatchRetrieveTools(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      throw await localiseDependencyFailure(loggingBroker, error);
    }
  };
}

async function localiseDependencyFailure(loggingBroker: LoggingBroker, error: unknown): Promise<ExternalToolDependencyException> {
  const failedExternalToolDependencyException = new FailedExternalToolDependencyException(
    "Failed external tool dependency error occurred, contact support.",
    error instanceof Error ? error : new Error(String(error)),
  );

  return await createAndLogDependencyException(loggingBroker, failedExternalToolDependencyException);
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ExternalToolValidationException> {
  const externalToolValidationException = new ExternalToolValidationException(
    "External tool validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(externalToolValidationException);

  return externalToolValidationException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ExternalToolDependencyException> {
  const externalToolDependencyException = new ExternalToolDependencyException(
    "External tool dependency error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(externalToolDependencyException);

  return externalToolDependencyException;
}
