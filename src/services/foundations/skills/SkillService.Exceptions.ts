import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { FailedSkillDependencyException } from "../../../models/foundations/skills/exceptions/FailedSkillDependencyException.js";
import { FailedSkillServiceException } from "../../../models/foundations/skills/exceptions/FailedSkillServiceException.js";
import { SkillDependencyException } from "../../../models/foundations/skills/exceptions/SkillDependencyException.js";
import { SkillServiceException } from "../../../models/foundations/skills/exceptions/SkillServiceException.js";

// The exception partial: native faults localised into the skill family and categorised
// (SPEC-cli 3.1). A missing folder or file and a permission refusal are critical, because the
// composition points at something that is not there; any other I/O fault is a dependency fault;
// anything else is the service's own.

export type TryCatch = <T>(routine: () => Promise<T>) => Promise<T>;

const CRITICAL_CODES = new Set(["ENOENT", "ENOTDIR", "EACCES", "EPERM"]);

export function createTryCatch(loggingBroker: LoggingBroker): TryCatch {
  return async function tryCatch<T>(routine: () => Promise<T>): Promise<T> {
    try {
      return await routine();
    } catch (error: unknown) {
      if (isErrnoException(error) && CRITICAL_CODES.has(error.code ?? "")) {
        const failedSkillDependencyException = new FailedSkillDependencyException(
          "Failed skill dependency error occurred, contact support.",
          error,
        );

        throw await createAndLogCriticalDependencyException(loggingBroker, failedSkillDependencyException);
      }

      if (isErrnoException(error)) {
        const failedSkillDependencyException = new FailedSkillDependencyException(
          "Failed skill dependency error occurred, contact support.",
          error,
        );

        throw await createAndLogDependencyException(loggingBroker, failedSkillDependencyException);
      }

      const failedSkillServiceException = new FailedSkillServiceException(
        "Failed skill service error occurred, contact support.",
        error instanceof Error ? error : new Error(String(error)),
      );

      throw await createAndLogServiceException(loggingBroker, failedSkillServiceException);
    }
  };
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === "string";
}

async function createAndLogCriticalDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<SkillDependencyException> {
  const skillDependencyException = new SkillDependencyException(
    "Skill dependency error occurred, contact support.",
    error,
  );

  await loggingBroker.logCritical(skillDependencyException);

  return skillDependencyException;
}

async function createAndLogDependencyException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<SkillDependencyException> {
  const skillDependencyException = new SkillDependencyException(
    "Skill dependency error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(skillDependencyException);

  return skillDependencyException;
}

async function createAndLogServiceException(
  loggingBroker: LoggingBroker,
  error: Error,
): Promise<SkillServiceException> {
  const skillServiceException = new SkillServiceException(
    "Skill service error occurred, contact support.",
    error,
  );

  await loggingBroker.logError(skillServiceException);

  return skillServiceException;
}
