import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { StaleSessionWriteError } from "../../../models/brokers/sessions/StaleSessionWriteError.js";
import { FailedSessionServiceException } from "../../../models/foundations/sessions/exceptions/FailedSessionServiceException.js";
import { InvalidSessionException } from "../../../models/foundations/sessions/exceptions/InvalidSessionException.js";
import { NullSessionException } from "../../../models/foundations/sessions/exceptions/NullSessionException.js";
import { SessionDependencyValidationException } from "../../../models/foundations/sessions/exceptions/SessionDependencyValidationException.js";
import { SessionServiceException } from "../../../models/foundations/sessions/exceptions/SessionServiceException.js";
import { SessionValidationException } from "../../../models/foundations/sessions/exceptions/SessionValidationException.js";
import { StaleSessionException } from "../../../models/foundations/sessions/exceptions/StaleSessionException.js";

// The exception partial (SPEC-cli 3.1): the session family and its categories. A store that
// refuses a write because the session moved on is the store validating the version the write
// carried, so it is a dependency validation fault that says which versions disagreed: the loop
// reads again and retries, it never overwrites. Any other failure of the store is the service
// failing to read or to record; the loop never reports a conversation kept that was not.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatchRetrieve(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidSessionException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      throw await localiseServiceFailure(loggingBroker, error);
    }
  };
}

export function createTryCatchRecord(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof NullSessionException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      if (error instanceof StaleSessionWriteError) {
        throw await createAndLogDependencyValidationException(loggingBroker, localiseStaleWrite(error));
      }

      throw await localiseServiceFailure(loggingBroker, error);
    }
  };
}

function localiseStaleWrite(error: StaleSessionWriteError): StaleSessionException {
  const staleSessionException = new StaleSessionException(
    "Stale session write. The session changed since it was read; read it again and retry.",
  );

  staleSessionException.upsertDataList("sessionId", error.sessionId);
  staleSessionException.upsertDataList("storedVersion", String(error.storedVersion));
  staleSessionException.upsertDataList("attemptedVersion", String(error.attemptedVersion));

  return staleSessionException;
}

async function localiseServiceFailure(loggingBroker: LoggingBroker, error: unknown): Promise<SessionServiceException> {
  const failedSessionServiceException = new FailedSessionServiceException(
    "Failed session service error occurred, contact support.",
    error instanceof Error ? error : new Error(String(error)),
  );

  return await createAndLogServiceException(loggingBroker, failedSessionServiceException);
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<SessionValidationException> {
  const sessionValidationException = new SessionValidationException(
    "Session validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(sessionValidationException);

  return sessionValidationException;
}

async function createAndLogDependencyValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<SessionDependencyValidationException> {
  const sessionDependencyValidationException = new SessionDependencyValidationException(
    "Session dependency validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(sessionDependencyValidationException);

  return sessionDependencyValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<SessionServiceException> {
  const sessionServiceException = new SessionServiceException(
    "Session service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(sessionServiceException);

  return sessionServiceException;
}
