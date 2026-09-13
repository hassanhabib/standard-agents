import { describe, expect, it } from "vitest";


import { createRandomString, createUsageServiceTests, verifyNoOtherCalls } from "./UsageServiceTests.js";

describe("UsageService measure logic", () => {
  it("ShouldMeasureUsageAsync", async () => {
    // given
    const { usageBrokerMock, loggingBrokerMock, usageService } = createUsageServiceTests();
    const prompt = createRandomString();
    const completion = createRandomString();
    const promptTokens = Math.floor(Math.random() * 1000) + 1;
    const completionTokens = Math.floor(Math.random() * 1000) + 1;
    usageBrokerMock.countTokens.mockResolvedValueOnce(promptTokens).mockResolvedValueOnce(completionTokens);

    // when
    const actualUsage = await usageService.measure(prompt, completion);

    // then
    expect(actualUsage).toEqual({ promptTokens, completionTokens, isEstimated: true });
    expect(usageBrokerMock.countTokens).toHaveBeenNthCalledWith(1, prompt);
    expect(usageBrokerMock.countTokens).toHaveBeenNthCalledWith(2, completion);
    verifyNoOtherCalls(usageBrokerMock, { countTokens: 2 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
