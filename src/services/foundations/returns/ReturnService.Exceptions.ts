import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { InvalidReturnException } from "../../../models/foundations/returns/exceptions/InvalidReturnException.js";
import { ReturnValidationException } from "../../../models/foundations/returns/exceptions/ReturnValidationException.js";

// The exception partial (SPEC-cli 3.1): the only fault a return can have is an empty payload.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidReturnException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      throw error;
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ReturnValidationException> {
  const returnValidationException = new ReturnValidationException(
    "Return validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(returnValidationException);

  return returnValidationException;
}
