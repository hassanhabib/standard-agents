import { describe, expect, it } from "vitest";


import { createGateServiceTests, createRandomString, verifyNoOtherCalls } from "./GateServiceTests.js";

describe("GateService detectConflict logic", () => {
  it("ShouldDetectConflictAsync", async () => {
    // given
    const { classifierBrokerMock, loggingBrokerMock, gateService } = createGateServiceTests();
    const instructions = createRandomString();
    const expectedVerdict = createRandomString();
    classifierBrokerMock.assess.mockResolvedValue(expectedVerdict);

    // when
    const actualVerdict = await gateService.detectConflict(instructions);

    // then
    expect(actualVerdict).toBe(expectedVerdict);
    expect(classifierBrokerMock.assess).toHaveBeenCalledTimes(1);
    expect(classifierBrokerMock.assess.mock.calls[0]?.[0]).toContain("CONFLICT:");
    expect(classifierBrokerMock.assess.mock.calls[0]?.[1]).toBe(instructions);
    verifyNoOtherCalls(classifierBrokerMock, { assess: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
