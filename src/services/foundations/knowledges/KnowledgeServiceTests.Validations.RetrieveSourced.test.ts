import { describe, expect, it } from "vitest";

import { InvalidKnowledgeException } from "../../../models/foundations/knowledges/exceptions/InvalidKnowledgeException.js";
import { KnowledgeValidationException } from "../../../models/foundations/knowledges/exceptions/KnowledgeValidationException.js";
import { createSourcedKnowledgeServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve sourced validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnRetrieveSourcedIfQueryIsInvalidAndLogItAsync (%j)", async (invalidQuery) => {
    // given
    const { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createSourcedKnowledgeServiceTests();

    const invalidKnowledgeException = new InvalidKnowledgeException(
      "Invalid knowledge query. Please correct the error and try again.",
    );

    const expectedKnowledgeValidationException = new KnowledgeValidationException(
      "Knowledge validation error occurred, fix the error and try again.",
      invalidKnowledgeException,
    );

    // when
    const retrieveTask = knowledgeService.retrieveSourced(invalidQuery);

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(KnowledgeValidationException);
    expectSameExceptionAs(actualException, expectedKnowledgeValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedKnowledgeValidationException);
    verifyNoOtherCalls(sourcedKnowledgeBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });
});
