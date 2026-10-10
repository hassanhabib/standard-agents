import { describe, expect, it } from "vitest";

import { FailedKnowledgeDependencyException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeDependencyException.js";
import { FailedKnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeServiceException.js";
import { KnowledgeDependencyException } from "../../../models/foundations/knowledges/exceptions/KnowledgeDependencyException.js";
import { KnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/KnowledgeServiceException.js";
import { createErrnoException, createKnowledgeServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve exceptions", () => {
  it.each(["ENOENT", "EACCES", "EPERM"])(
    "ShouldThrowDependencyExceptionOnRetrieveIfCriticalErrorOccursAndLogItAsync (%s)",
    async (code) => {
      // given
      const { knowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createKnowledgeServiceTests();
      const criticalDependencyException = createErrnoException(code);

      const failedKnowledgeDependencyException = new FailedKnowledgeDependencyException(
        "Failed knowledge dependency error occurred, contact support.",
        criticalDependencyException,
      );

      const expectedKnowledgeDependencyException = new KnowledgeDependencyException(
        "Knowledge dependency error occurred, contact support.",
        failedKnowledgeDependencyException,
      );

      knowledgeBrokerMock.selectKnowledge.mockRejectedValue(criticalDependencyException);

      // when
      const retrieveTask = knowledgeService.retrieve(createRandomString());

      // then
      const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(KnowledgeDependencyException);
      expectSameExceptionAs(actualException, expectedKnowledgeDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedKnowledgeDependencyException);
      verifyNoOtherCalls(knowledgeBrokerMock, { selectKnowledge: 1 });
      verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
    },
  );

  it("ShouldThrowDependencyExceptionOnRetrieveIfIOErrorOccursAndLogItAsync", async () => {
    // given
    const { knowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createKnowledgeServiceTests();
    const ioException = createErrnoException("EIO");

    const failedKnowledgeDependencyException = new FailedKnowledgeDependencyException(
      "Failed knowledge dependency error occurred, contact support.",
      ioException,
    );

    const expectedKnowledgeDependencyException = new KnowledgeDependencyException(
      "Knowledge dependency error occurred, contact support.",
      failedKnowledgeDependencyException,
    );

    knowledgeBrokerMock.selectKnowledge.mockRejectedValue(ioException);

    // when
    const retrieveTask = knowledgeService.retrieve(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(KnowledgeDependencyException);
    expectSameExceptionAs(actualException, expectedKnowledgeDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedKnowledgeDependencyException);
    verifyNoOtherCalls(knowledgeBrokerMock, { selectKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it("ShouldThrowServiceExceptionOnRetrieveIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { knowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createKnowledgeServiceTests();
    const serviceException = new Error(createRandomString());

    const failedKnowledgeServiceException = new FailedKnowledgeServiceException(
      "Failed knowledge service error occurred, contact support.",
      serviceException,
    );

    const expectedKnowledgeServiceException = new KnowledgeServiceException(
      "Knowledge service error occurred, contact support.",
      failedKnowledgeServiceException,
    );

    knowledgeBrokerMock.selectKnowledge.mockRejectedValue(serviceException);

    // when
    const retrieveTask = knowledgeService.retrieve(createRandomString());

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(KnowledgeServiceException);
    expectSameExceptionAs(actualException, expectedKnowledgeServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedKnowledgeServiceException);
    verifyNoOtherCalls(knowledgeBrokerMock, { selectKnowledge: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
