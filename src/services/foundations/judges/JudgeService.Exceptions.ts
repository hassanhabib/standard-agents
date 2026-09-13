import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedJudgeServiceException } from "../../../models/foundations/judges/exceptions/FailedJudgeServiceException.js";
import { InvalidJudgeException } from "../../../models/foundations/judges/exceptions/InvalidJudgeException.js";
import { InvalidJudgeScoreException } from "../../../models/foundations/judges/exceptions/InvalidJudgeScoreException.js";
import { JudgeServiceException } from "../../../models/foundations/judges/exceptions/JudgeServiceException.js";
import { JudgeValidationException } from "../../../models/foundations/judges/exceptions/JudgeValidationException.js";

// The exception partial (SPEC-cli 3.1): the judge family and its categories. A verifier that
// fails is the service failing to judge; the draft is never accepted by default.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (error instanceof InvalidJudgeException || error instanceof InvalidJudgeScoreException) {
        throw await createAndLogValidationException(loggingBroker, error);
      }

      const failedJudgeServiceException = new FailedJudgeServiceException(
        "Failed judge service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedJudgeServiceException);
    }
  };
}

async function createAndLogValidationException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<JudgeValidationException> {
  const judgeValidationException = new JudgeValidationException(
    "Judge validation error occurred, fix the error and try again.",
    error,
  );

  await loggingBroker.logError(judgeValidationException);

  return judgeValidationException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<JudgeServiceException> {
  const judgeServiceException = new JudgeServiceException(
    "Judge service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(judgeServiceException);

  return judgeServiceException;
}
