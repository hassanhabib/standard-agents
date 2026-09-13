import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedPolicyServiceException } from "../../../models/foundations/policies/exceptions/FailedPolicyServiceException.js";
import { NullPolicyEffectException } from "../../../models/foundations/policies/exceptions/NullPolicyEffectException.js";
import { PolicyServiceException } from "../../../models/foundations/policies/exceptions/PolicyServiceException.js";
import { PolicyValidationException } from "../../../models/foundations/policies/exceptions/PolicyValidationException.js";

// The exception partial (SPEC-cli 3.1): the policy family and its categories. A policy that
// fails is the service failing to decide, and an act it could not decide is never permitted.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof NullPolicyEffectException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedPolicyServiceException = new FailedPolicyServiceException(
        "Failed policy service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedPolicyServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<PolicyValidationException> {
  const policyValidationException = new PolicyValidationException(
    "Policy validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(policyValidationException);

  return policyValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<PolicyServiceException> {
  const policyServiceException = new PolicyServiceException(
    "Policy service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(policyServiceException);

  return policyServiceException;
}
