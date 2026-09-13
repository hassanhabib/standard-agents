import { describe, expect, it } from "vitest";

import { InvalidKnowledgeException } from "../../../models/foundations/knowledges/exceptions/InvalidKnowledgeException.js";
import { KnowledgeValidationException } from "../../../models/foundations/knowledges/exceptions/KnowledgeValidationException.js";
import { createKnowledgeServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./KnowledgeServiceTests.js";

describe("KnowledgeService retrieve validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnRetrieveIfQueryIsInvalidAndLogItAsync (%j)", async (invalidQuery) => {
    // given
    const { knowledgeBrokerMock, loggingBrokerMock, knowledgeService } = createKnowledgeServiceTests();

    const invalidKnowledgeException = new InvalidKnowledgeException(
      "Invalid knowledge query. Please correct the error and try again.",
    );

    const expectedKnowledgeValidationException = new KnowledgeValidationException(
      "Knowledge validation error occurred, fix the error and try again.",
      invalidKnowledgeException,
    );

    // when
    const retrieveTask = knowledgeService.retrieve(invalidQuery);

    // then
    const actualException = await retrieveTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(KnowledgeValidationException);
    expectSameExceptionAs(actualException, expectedKnowledgeValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedKnowledgeValidationException);
    verifyNoOtherCalls(knowledgeBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
