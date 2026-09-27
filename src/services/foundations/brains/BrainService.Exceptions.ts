import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { BusyBrainException } from "../../../models/foundations/brains/exceptions/BusyBrainException.js";
import { BrainDependencyException } from "../../../models/foundations/brains/exceptions/BrainDependencyException.js";
import { BrainDependencyValidationException } from "../../../models/foundations/brains/exceptions/BrainDependencyValidationException.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { BrainValidationException } from "../../../models/foundations/brains/exceptions/BrainValidationException.js";
import { FailedBrainDependencyException } from "../../../models/foundations/brains/exceptions/FailedBrainDependencyException.js";
import { FailedBrainServiceException } from "../../../models/foundations/brains/exceptions/FailedBrainServiceException.js";
import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import { NotFoundBrainException } from "../../../models/foundations/brains/exceptions/NotFoundBrainException.js";
import { RefusedBrainException } from "../../../models/foundations/brains/exceptions/RefusedBrainException.js";
import { UnreachableBrainException } from "../../../models/foundations/brains/exceptions/UnreachableBrainException.js";

// The exception partial (SPEC-cli 3.1): the brain family's categories, each localising the
// native fault beneath it and logging at the severity the category carries. A refused key, a
// forbidden route, a route that is not there, or a host that cannot be reached at all is a
// configuration fault, so it is critical; a failing status from a reachable host is a
// dependency fault that may pass; anything else is the service's own.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

const REFUSED_STATUSES = new Set([401, 403]);

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

      // The service answered, and would not take the key. Said as that, with the status beside it
      // for whoever reads a log, rather than as the status alone.
      if (error instanceof HttpResponseException && REFUSED_STATUSES.has(error.status)) {
        throw await createAndLogCriticalDependencyException(
          loggingBroker,
          new RefusedBrainException(
            `the model service did not accept this connection's key (${String(error.status)}). Check the key, and that it belongs to this service.`,
            error,
          ),
        );
      }

      // The service said "not now", and usually said for how long. The wait it named is the one
      // number worth giving whoever is waiting, so it is kept rather than dropped with the header.
      if (error instanceof HttpResponseException && error.status === 429) {
        throw await createAndLogDependencyException(
          loggingBroker,
          new BusyBrainException(
            `the model service is taking too many requests right now (429). ${howLongToWait(error.retryAfter)}`,
            error,
          ),
        );
      }

      // Something answered at that address and it is not a chat endpoint, or the model is not
      // installed there. Configuration, so critical, and said as the two things to check.
      if (error instanceof HttpResponseException && error.status === 404) {
        throw await createAndLogCriticalDependencyException(
          loggingBroker,
          new NotFoundBrainException(
            "nothing at that address answers chat requests (404). Check the address, and that the model it names is installed there.",
            error,
          ),
        );
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

// Retry-After as a sentence. A whole number of seconds is said as that; anything else, a date or
// nothing at all, is "a moment", because a guess dressed as a number is worse than no number.
function howLongToWait(retryAfter: string | null): string {
  const trimmed = (retryAfter ?? "").trim();

  if (!/^\d+$/.test(trimmed)) {
    return "Try again in a moment.";
  }

  const seconds = Number(trimmed);

  return `Try again in ${String(seconds)} ${seconds === 1 ? "second" : "seconds"}.`;
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
