import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedUsageServiceException } from "../../../models/foundations/usages/exceptions/FailedUsageServiceException.js";
import { UsageServiceException } from "../../../models/foundations/usages/exceptions/UsageServiceException.js";

// The exception partial (SPEC-cli 3.1): the usage family and its categories. A counter that
// fails is the service failing to measure; a budget is never fed a zero it did not earn.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      const failedUsageServiceException = new FailedUsageServiceException(
        "Failed usage service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedUsageServiceException);
    }
  };
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<UsageServiceException> {
  const usageServiceException = new UsageServiceException(
    "Usage service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(usageServiceException);

  return usageServiceException;
}
