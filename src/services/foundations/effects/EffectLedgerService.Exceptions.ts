import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { EffectLedgerServiceException } from "../../../models/foundations/effects/exceptions/EffectLedgerServiceException.js";
import { EffectLedgerValidationException } from "../../../models/foundations/effects/exceptions/EffectLedgerValidationException.js";
import { FailedEffectLedgerServiceException } from "../../../models/foundations/effects/exceptions/FailedEffectLedgerServiceException.js";
import { NotFoundEffectRecordException } from "../../../models/foundations/effects/exceptions/NotFoundEffectRecordException.js";
import { NullEffectException } from "../../../models/foundations/effects/exceptions/NullEffectException.js";

// The exception partial (SPEC-cli 3.1): the effect ledger family and its categories. A ledger
// that fails is the service failing to claim or record, and an act whose claim is uncertain is
// never performed. A record that is not there to update is a validation fault: the caller named
// a claim that was never made or was already released.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof NullEffectException || error instanceof NotFoundEffectRecordException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedEffectLedgerServiceException = new FailedEffectLedgerServiceException(
        "Failed effect ledger service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedEffectLedgerServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<EffectLedgerValidationException> {
  const effectLedgerValidationException = new EffectLedgerValidationException(
    "Effect ledger validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(effectLedgerValidationException);

  return effectLedgerValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<EffectLedgerServiceException> {
  const effectLedgerServiceException = new EffectLedgerServiceException(
    "Effect ledger service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(effectLedgerServiceException);

  return effectLedgerServiceException;
}
