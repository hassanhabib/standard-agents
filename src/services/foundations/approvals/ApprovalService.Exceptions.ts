import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { ApprovalServiceException } from "../../../models/foundations/approvals/exceptions/ApprovalServiceException.js";
import { ApprovalValidationException } from "../../../models/foundations/approvals/exceptions/ApprovalValidationException.js";
import { FailedApprovalServiceException } from "../../../models/foundations/approvals/exceptions/FailedApprovalServiceException.js";
import { NullApprovalEffectException } from "../../../models/foundations/approvals/exceptions/NullApprovalEffectException.js";

// The exception partial (SPEC-cli 3.1): the approval family and its categories. An authority
// that fails is the service failing to ask, and an act nobody could be asked about is never
// treated as approved.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof NullApprovalEffectException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedApprovalServiceException = new FailedApprovalServiceException(
        "Failed approval service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedApprovalServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ApprovalValidationException> {
  const approvalValidationException = new ApprovalValidationException(
    "Approval validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(approvalValidationException);

  return approvalValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ApprovalServiceException> {
  const approvalServiceException = new ApprovalServiceException(
    "Approval service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(approvalServiceException);

  return approvalServiceException;
}
