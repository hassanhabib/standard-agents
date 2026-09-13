import { describe, expect, it } from "vitest";

import { InvalidMemoryException } from "../../../models/foundations/memorys/exceptions/InvalidMemoryException.js";
import { MemoryValidationException } from "../../../models/foundations/memorys/exceptions/MemoryValidationException.js";
import { createMemoryServiceTests, expectSameExceptionAs, verifyNoOtherCalls } from "./MemoryServiceTests.js";

describe("MemoryService remember validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnRememberIfMemoryIsInvalidAndLogItAsync (%j)", async (invalidMemory) => {
    // given
    const { memoryBrokerMock, loggingBrokerMock, memoryService } = createMemoryServiceTests();

    const invalidMemoryException = new InvalidMemoryException(
      "Invalid memory. Please correct the error and try again.",
    );

    const expectedMemoryValidationException = new MemoryValidationException(
      "Memory validation error occurred, fix the error and try again.",
      invalidMemoryException,
    );

    // when
    const rememberTask = memoryService.remember(invalidMemory);

    // then
    const actualException = await rememberTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(MemoryValidationException);
    expectSameExceptionAs(actualException, expectedMemoryValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedMemoryValidationException);
    verifyNoOtherCalls(memoryBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
