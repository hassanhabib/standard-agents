import { describe, expect, it } from "vitest";

import { createBrainServiceTests, createRandomInference, createRandomString, verifyNoOtherCalls } from "./BrainServiceTests.js";

describe("BrainService generate logic", () => {
  it("ShouldGenerateAsync", async () => {
    // given
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
    const systemPrompt = createRandomString();
    const userPrompt = createRandomString();
    const expectedReply = createRandomString();
    generatorBrokerMock.generate.mockResolvedValue(expectedReply);

    // when
    const actualReply = await brainService.generate(systemPrompt, userPrompt);

    // then
    expect(actualReply).toBe(expectedReply);
    expect(generatorBrokerMock.generate).toHaveBeenCalledWith(systemPrompt, userPrompt);
    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldGenerateWithResolvedInferenceAsync", async () => {
    // given
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests(true);
    const systemPrompt = createRandomString();
    const userPrompt = createRandomString();
    const inference = createRandomInference();
    const expectedReply = createRandomString();
    generatorBrokerMock.generate.mockResolvedValue(expectedReply);

    // when
    const actualReply = await brainService.generate(systemPrompt, userPrompt, inference);

    // then
    expect(actualReply).toBe(expectedReply);
    expect(generatorBrokerMock.generate).toHaveBeenCalledWith(systemPrompt, userPrompt, inference);
    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldAnnounceDegradationOnGenerateIfBrokerDoesNotHonorRequestAsync", async () => {
    // given
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests(false);
    const systemPrompt = createRandomString();
    const userPrompt = createRandomString();
    const inference = createRandomInference();
    const expectedReply = createRandomString();
    generatorBrokerMock.generate.mockResolvedValue(expectedReply);

    // when
    const actualReply = await brainService.generate(systemPrompt, userPrompt, inference);

    // then
    expect(actualReply).toBe(expectedReply);
    expect(generatorBrokerMock.generate).toHaveBeenCalledWith(systemPrompt, userPrompt, inference);

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> broker does not honor requests; shape enforced by guardian only",
      true,
    );

    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1 });
  });

});
