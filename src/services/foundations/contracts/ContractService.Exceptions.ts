import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { ContractServiceException } from "../../../models/foundations/contracts/exceptions/ContractServiceException.js";
import { ContractValidationException } from "../../../models/foundations/contracts/exceptions/ContractValidationException.js";
import { FailedContractServiceException } from "../../../models/foundations/contracts/exceptions/FailedContractServiceException.js";
import { InvalidContractException } from "../../../models/foundations/contracts/exceptions/InvalidContractException.js";

// The exception partial (SPEC-cli 3.1): the contract family and its categories. A broker that
// fails is the service failing to check; the answer is never presumed to satisfy.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidContractException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedContractServiceException = new FailedContractServiceException(
        "Failed contract service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedContractServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ContractValidationException> {
  const contractValidationException = new ContractValidationException(
    "Contract validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(contractValidationException);

  return contractValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<ContractServiceException> {
  const contractServiceException = new ContractServiceException(
    "Contract service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(contractServiceException);

  return contractServiceException;
}
