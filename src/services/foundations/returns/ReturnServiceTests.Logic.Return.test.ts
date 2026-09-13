import { describe, expect, it } from "vitest";

import { createRandomString, createReturnServiceTests, verifyNoOtherCalls } from "./ReturnServiceTests.js";

describe("ReturnService return logic", () => {
  it("ShouldReturnAsync", async () => {
    // given
    const { loggingBrokerMock, returnService } = createReturnServiceTests();
    const expectedPayload = createRandomString();

    // when
    const actualPayload = await returnService.return(expectedPayload);

    // then
    expect(actualPayload).toBe(expectedPayload);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
