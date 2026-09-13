import { describe, expect, it } from "vitest";


import { createGateServiceTests, createRandomString, verifyNoOtherCalls } from "./GateServiceTests.js";

describe("GateService screen logic", () => {
  it("ShouldScreenAsync", async () => {
    // given
    const { classifierBrokerMock, loggingBrokerMock, gateService } = createGateServiceTests();
    const input = createRandomString();
    const expectedVerdict = createRandomString();
    classifierBrokerMock.classify.mockResolvedValue(expectedVerdict);

    // when
    const actualVerdict = await gateService.screen(input);

    // then
    expect(actualVerdict).toBe(expectedVerdict);
    expect(classifierBrokerMock.classify).toHaveBeenCalledWith(input);
    verifyNoOtherCalls(classifierBrokerMock, { classify: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
