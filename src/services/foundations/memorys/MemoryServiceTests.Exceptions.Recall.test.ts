import { describe, expect, it } from "vitest";

import { FailedMemoryServiceException } from "../../../models/foundations/memorys/exceptions/FailedMemoryServiceException.js";
import { MemoryServiceException } from "../../../models/foundations/memorys/exceptions/MemoryServiceException.js";
import { createMemoryServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./MemoryServiceTests.js";

describe("MemoryService recall exceptions", () => {
  it("ShouldThrowServiceExceptionOnRecallIfServiceErrorOccursAndLogItAsync", async () => {
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

    memoryBrokerMock.selectMemories.mockRejectedValue(serviceException);

    // when
    const recallTask = memoryService.recall();

    // then
    const actualException = await recallTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(MemoryServiceException);
    expectSameExceptionAs(actualException, expectedMemoryServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedMemoryServiceException);
    verifyNoOtherCalls(memoryBrokerMock, { selectMemories: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
