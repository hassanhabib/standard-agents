import { describe, expect, it } from "vitest";

import { FailedMemoryServiceException } from "../../../models/foundations/memorys/exceptions/FailedMemoryServiceException.js";
import { MemoryServiceException } from "../../../models/foundations/memorys/exceptions/MemoryServiceException.js";
import { createMemoryServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./MemoryServiceTests.js";

describe("MemoryService remember exceptions", () => {
  it("ShouldThrowServiceExceptionOnRememberIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { memoryBrokerMock, loggingBrokerMock, memoryService } = createMemoryServiceTests();
    const serviceException = new Error(createRandomString());

    const failedMemoryServiceException = new FailedMemoryServiceException(
      "Failed memory service error occurred, contact support.",
      serviceException,
    );

    const expectedMemoryServiceException = new MemoryServiceException(
      "Memory service error occurred, contact support.",
      failedMemoryServiceException,
    );

    memoryBrokerMock.insertMemory.mockRejectedValue(serviceException);

    // when
    const rememberTask = memoryService.remember(createRandomString());

    // then
    const actualException = await rememberTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(MemoryServiceException);
    expectSameExceptionAs(actualException, expectedMemoryServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedMemoryServiceException);
    verifyNoOtherCalls(memoryBrokerMock, { insertMemory: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
