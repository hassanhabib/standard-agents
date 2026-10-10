import { describe, expect, it } from "vitest";

import { FailedKnowledgeDependencyException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeDependencyException.js";
import { FailedKnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeServiceException.js";
import { KnowledgeDependencyException } from "../../../models/foundations/knowledges/exceptions/KnowledgeDependencyException.js";
import { KnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/KnowledgeServiceException.js";
import { createErrnoException, createRandomString, createSourcedKnowledgeServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve sourced exceptions", () => {
  it.each(["ENOENT", "EACCES", "EPERM"])(
    "ShouldThrowDependencyExceptionOnRetrieveSourcedIfCriticalErrorOccursAndLogItAsync (%s)",
    async (code) => {
      // given
      const { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createSourcedKnowledgeServiceTests();
      const criticalDependencyException = createErrnoException(code);

      const failedKnowledgeDependencyException = new FailedKnowledgeDependencyException(
        "Failed knowledge dependency error occurred, contact support.",
        criticalDependencyException,
      );

      const expectedKnowledgeDependencyException = new KnowledgeDependencyException(
        "Knowledge dependency error occurred, contact support.",
        failedKnowledgeDependencyException,
      );

      sourcedKnowledgeBrokerMock.selectSourcedKnowledge.mockRejectedValue(criticalDependencyException);

      // when
      const retrieveTask = knowledgeService.retrieveSourced(createRandomString());

      // then
      const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(KnowledgeDependencyException);
      expectSameExceptionAs(actualException, expectedKnowledgeDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedKnowledgeDependencyException);
      verifyNoOtherCalls(sourcedKnowledgeBrokerMock, { selectSourcedKnowledge: 1 });
      verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
    },
  );

  it("ShouldThrowDependencyExceptionOnRetrieveSourcedIfIOErrorOccursAndLogItAsync", async () => {
    // given
    const { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createSourcedKnowledgeServiceTests();
    const ioException = createErrnoException("EIO");

    const failedKnowledgeDependencyException = new FailedKnowledgeDependencyException(
      "Failed knowledge dependency error occurred, contact support.",
      ioException,
    );

    const expectedKnowledgeDependencyException = new KnowledgeDependencyException(
      "Knowledge dependency error occurred, contact support.",
      failedKnowledgeDependencyException,
    );

    sourcedKnowledgeBrokerMock.selectSourcedKnowledge.mockRejectedValue(ioException);

    // when
    const retrieveTask = knowledgeService.retrieveSourced(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(KnowledgeDependencyException);
    expectSameExceptionAs(actualException, expectedKnowledgeDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedKnowledgeDependencyException);
    verifyNoOtherCalls(sourcedKnowledgeBrokerMock, { selectSourcedKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowServiceExceptionOnRetrieveSourcedIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createSourcedKnowledgeServiceTests();
    const serviceException = new Error(createRandomString());

    const failedKnowledgeServiceException = new FailedKnowledgeServiceException(
      "Failed knowledge service error occurred, contact support.",
      serviceException,
    );

    const expectedKnowledgeServiceException = new KnowledgeServiceException(
      "Knowledge service error occurred, contact support.",
      failedKnowledgeServiceException,
    );

    sourcedKnowledgeBrokerMock.selectSourcedKnowledge.mockRejectedValue(serviceException);

    // when
    const retrieveTask = knowledgeService.retrieveSourced(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(KnowledgeServiceException);
    expectSameExceptionAs(actualException, expectedKnowledgeServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedKnowledgeServiceException);
    verifyNoOtherCalls(sourcedKnowledgeBrokerMock, { selectSourcedKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });
});
