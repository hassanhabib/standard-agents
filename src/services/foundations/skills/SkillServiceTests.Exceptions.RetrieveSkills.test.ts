import { describe, expect, it } from "vitest";

import { FailedSkillDependencyException } from "../../../models/foundations/skills/exceptions/FailedSkillDependencyException.js";
import { FailedSkillServiceException } from "../../../models/foundations/skills/exceptions/FailedSkillServiceException.js";
import { SkillDependencyException } from "../../../models/foundations/skills/exceptions/SkillDependencyException.js";
import { SkillServiceException } from "../../../models/foundations/skills/exceptions/SkillServiceException.js";
import {
  createErrnoException,
  createRandomString,
  createSkillServiceTests,
  expectSameExceptionAs,
  verifyNoOtherCalls,
} from "./SkillServiceTests.js";

describe("SkillService retrieveSkills exceptions", () => {
  it.each(["ENOENT", "ENOTDIR", "EACCES", "EPERM"])(
    "ShouldThrowCriticalDependencyExceptionOnRetrieveSkillsIf%sOccursAndLogItAsync",
    async (code) => {
      // given
      const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
      const criticalDependencyException = createErrnoException(code);

      const failedSkillDependencyException = new FailedSkillDependencyException(
        "Failed skill dependency error occurred, contact support.",
        criticalDependencyException,
      );

      const expectedSkillDependencyException = new SkillDependencyException(
        "Skill dependency error occurred, contact support.",
        failedSkillDependencyException,
      );

      skillBrokerMock.selectSkills.mockRejectedValue(criticalDependencyException);

      // when
      const retrieveSkillsTask = skillService.retrieveSkills();

      // then
      const actualSkillDependencyException = await retrieveSkillsTask.then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(actualSkillDependencyException).toBeInstanceOf(SkillDependencyException);
      expectSameExceptionAs(actualSkillDependencyException, expectedSkillDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedSkillDependencyException);
      verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
      verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
    },
  );

  it("ShouldThrowDependencyExceptionOnRetrieveSkillsIfIOErrorOccursAndLogItAsync", async () => {
    // given
    const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
    const ioException = createErrnoException("EIO");

    const failedSkillDependencyException = new FailedSkillDependencyException(
      "Failed skill dependency error occurred, contact support.",
      ioException,
    );

    const expectedSkillDependencyException = new SkillDependencyException(
      "Skill dependency error occurred, contact support.",
      failedSkillDependencyException,
    );

    skillBrokerMock.selectSkills.mockRejectedValue(ioException);

    // when
    const retrieveSkillsTask = skillService.retrieveSkills();

    // then
    const actualSkillDependencyException = await retrieveSkillsTask.then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(actualSkillDependencyException).toBeInstanceOf(SkillDependencyException);
    expectSameExceptionAs(actualSkillDependencyException, expectedSkillDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSkillDependencyException);
    verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowServiceExceptionOnRetrieveSkillsIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
    const serviceException = new Error(createRandomString());

    const failedSkillServiceException = new FailedSkillServiceException(
      "Failed skill service error occurred, contact support.",
      serviceException,
    );

    const expectedSkillServiceException = new SkillServiceException(
      "Skill service error occurred, contact support.",
      failedSkillServiceException,
    );

    skillBrokerMock.selectSkills.mockRejectedValue(serviceException);

    // when
    const retrieveSkillsTask = skillService.retrieveSkills();

    // then
    const actualSkillServiceException = await retrieveSkillsTask.then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(actualSkillServiceException).toBeInstanceOf(SkillServiceException);
    expectSameExceptionAs(actualSkillServiceException, expectedSkillServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedSkillServiceException);
    verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
