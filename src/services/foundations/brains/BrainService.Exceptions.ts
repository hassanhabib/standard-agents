import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { BrainDependencyException } from "../../../models/foundations/brains/exceptions/BrainDependencyException.js";
import { BrainDependencyValidationException } from "../../../models/foundations/brains/exceptions/BrainDependencyValidationException.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { BrainValidationException } from "../../../models/foundations/brains/exceptions/BrainValidationException.js";
import { FailedBrainDependencyException } from "../../../models/foundations/brains/exceptions/FailedBrainDependencyException.js";
import { FailedBrainServiceException } from "../../../models/foundations/brains/exceptions/FailedBrainServiceException.js";
import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import { UnreachableBrainException } from "../../../models/foundations/brains/exceptions/UnreachableBrainException.js";

// The exception partial (SPEC-cli 3.1): the brain family's categories, each localising the
// native fault beneath it and logging at the severity the category carries. A refused key, a
// forbidden route, a route that is not there, or a host that cannot be reached at all is a
// configuration fault, so it is critical; a failing status from a reachable host is a
// dependency fault that may pass; anything else is the service's own.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

const CRITICAL_STATUSES = new Set([401, 403, 404]);

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidBrainException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      if (error instanceof HttpResponseException && error.status === 400) {
        const invalidBrainException = new InvalidBrainException(
          "Invalid brain request. Please correct the error and try again.",
        );

        invalidBrainException.upsertDataList("status", String(error.status));
        invalidBrainException.upsertDataList("body", error.body);

        throw await createAndLogDependencyValidationException(loggingBroker, invalidBrainException);
      }

      if (error instanceof HttpResponseException && CRITICAL_STATUSES.has(error.status)) {
        throw await createAndLogCriticalDependencyException(loggingBroker, error);
      }

      // Nothing answered at all, which is what fetch raises a TypeError for. Localised here rather
      // than carried up: "fetch failed" is the name of a browser API failing, and it rises through
      // every tier above this one to whoever is waiting, who is left with a sentence naming
      // nothing they own and nothing they can do. The address, and whatever is meant to be
      // listening at it, are the two things worth looking at.
      if (error instanceof TypeError) {
        throw await createAndLogCriticalDependencyException(
          loggingBroker,
          new UnreachableBrainException(
            "nothing answered at that address. Check that it is right and that the service is running.",
            error,
          ),
        );
      }

      if (error instanceof HttpResponseException) {
        throw await createAndLogDependencyException(loggingBroker, error);
      }

      const failedBrainServiceException = new FailedBrainServiceException(
        "Failed brain service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedBrainServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<BrainValidationException> {
  const brainValidationException = new BrainValidationException(
    "Brain validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(brainValidationException);

  return brainValidationException;
}

async function createAndLogDependencyValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<BrainDependencyValidationException> {
  const brainDependencyValidationException = new BrainDependencyValidationException(
    "Brain dependency validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(brainDependencyValidationException);

  return brainDependencyValidationException;
}

async function createAndLogCriticalDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<BrainDependencyException> {
  const failedBrainDependencyException = new FailedBrainDependencyException(
    "Failed brain dependency error occurred, contact support.",
    error,
  );

  const brainDependencyException = new BrainDependencyException(
    "Brain dependency error occurred, contact support.",
    failedBrainDependencyException,
  );

  await loggingBroker.logCritical(brainDependencyException);

  return brainDependencyException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<BrainDependencyException> {
  const failedBrainDependencyException = new FailedBrainDependencyException(
    "Failed brain dependency error occurred, contact support.",
    error,
  );

  const brainDependencyException = new BrainDependencyException(
    "Brain dependency error occurred, contact support.",
    failedBrainDependencyException,
  );

  await loggingBroker.logError(brainDependencyException);

  return brainDependencyException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<BrainServiceException> {
  const brainServiceException = new BrainServiceException(
    "Brain service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(brainServiceException);

  return brainServiceException;
}
