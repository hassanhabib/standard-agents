import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedGateServiceException } from "../../../models/foundations/gates/exceptions/FailedGateServiceException.js";
import { GateServiceException } from "../../../models/foundations/gates/exceptions/GateServiceException.js";
import { GateValidationException } from "../../../models/foundations/gates/exceptions/GateValidationException.js";
import { InvalidGateException } from "../../../models/foundations/gates/exceptions/InvalidGateException.js";

// The exception partial (SPEC-cli 3.1): the gate family and its categories. A classifier that
// fails is the service failing to guard; it is never silently allowed through.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidGateException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedGateServiceException = new FailedGateServiceException(
        "Failed gate service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedGateServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<GateValidationException> {
  const gateValidationException = new GateValidationException(
    "Gate validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(gateValidationException);

  return gateValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<GateServiceException> {
  const gateServiceException = new GateServiceException(
    "Gate service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(gateServiceException);

  return gateServiceException;
}
