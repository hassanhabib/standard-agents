import { describe, expect, it } from "vitest";

import { FailedKnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/FailedKnowledgeServiceException.js";
import { KnowledgeServiceException } from "../../../models/foundations/knowledges/exceptions/KnowledgeServiceException.js";
import { createRandomString, createSourcedKnowledgeServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve sourced exceptions", () => {
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
