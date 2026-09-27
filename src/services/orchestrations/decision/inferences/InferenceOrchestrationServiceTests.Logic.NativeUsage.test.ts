import { describe, expect, it } from "vitest";

import { createGenerationResult } from "../../../../brokers/generators/FunctionGeneratorBrokerV1.js";
import type { GenerationDelta } from "../../../../models/brokers/generators/v1/GenerationDelta.js";
import type { AgentUsage } from "../../../../models/foundations/usages/AgentUsage.js";
import { createAgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";
import { createRandomString } from "./InferenceOrchestrationServiceTests.js";
import { createNativeInferenceTests } from "./InferenceOrchestrationServiceTests.Native.js";

// What a native call cost when the provider did not say (SPEC.md 3.4).
//
// A provider on the native protocol usually reports its usage, and that report wins. "Usually" is
// not "always": the global network answers a streamed turn with no usage frame at all, and every
// native call was taken as costing nothing, marked reported. The window showed "0 tokens" a minute
// into a run that had made three calls, and a token budget on that run bounded nothing. The text
// protocol has counted what it sent and received since 1.1; the native one never did.
describe("InferenceOrchestrationService native usage", () => {
  it("ShouldCountAStreamedCallTheProviderSaidNothingAboutAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    const prompt = createRandomString();

    brainServiceMock.generateNativelyStream.mockResolvedValue(
      createGenerationResult({
        toolCalls: [{ id: "call_1", name: "read_file", argumentsJson: '{"path":"platformer.html"}' }],
        finishReason: "tool_calls",
      }),
    );

    usageServiceMock.measure.mockResolvedValue({ promptTokens: 4_210, completionTokens: 18, isEstimated: true });

    // when
    const actualContext = await inferenceOrchestrationService.decideStream(createAgentContext(prompt), async () => {});

    // then
    expect(actualContext.promptTokens).toBe(4_210);
    expect(actualContext.completionTokens).toBe(18);
    expect(actualContext.usageIsEstimated).toBe(true);

    // Counted from what was sent and what came back: the prompt it was asked, and the call it made.
    const [sent, received] = usageServiceMock.measure.mock.calls[0] as [string, string];
    expect(sent).toContain(prompt);
    expect(received).toContain('{"path":"platformer.html"}');
  });

  it("ShouldCountABatchedCallTheProviderSaidNothingAboutAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    const answer = createRandomString();

    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: answer }));
    usageServiceMock.measure.mockResolvedValue({ promptTokens: 900, completionTokens: 12, isEstimated: true });

    // when
    const actualContext = await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));

    // then
    expect(actualContext.promptTokens + actualContext.completionTokens).toBe(912);
    expect(actualContext.usageIsEstimated).toBe(true);
    expect((usageServiceMock.measure.mock.calls[0] as [string, string])[1]).toContain(answer);
  });

  it("ShouldSayWhatTheCallHasSpentWhileItIsAnsweredAsync", async () => {
    // given
    // The prompt is spent the moment the call is sent, and what comes back is spent piece by piece,
    // whether it is words, narration, or a file written into a call's arguments. A count that waited
    // for the call to end stood still for as long as the model took (SPEC.md 4.14.1, spending).
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();

    usageServiceMock.measure.mockImplementation(async (sent: string, received: string) => ({
      promptTokens: sent.length > 0 ? 100 : 0,
      completionTokens: received.length > 0 ? 5 : 0,
      isEstimated: true,
    }));

    brainServiceMock.generateNativelyStream.mockImplementation(async (_ask: unknown, voice: (delta: GenerationDelta) => Promise<void>) => {
      await voice({ content: "", narration: "", written: '{"path":"hat.css"', completed: null });
      await voice({ content: "Done.", narration: "", completed: null });

      return createGenerationResult({ content: "Done.", promptTokens: 120, completionTokens: 9 });
    });

    const spending: AgentUsage[] = [];

    // when
    await inferenceOrchestrationService.decideStream(
      createAgentContext(createRandomString()),
      async () => {},
      async (soFar) => {
        spending.push(soFar);
      },
    );

    // then
    expect(spending).toEqual([
      { promptTokens: 100, completionTokens: 0, isEstimated: true },
      { promptTokens: 100, completionTokens: 5, isEstimated: true },
      { promptTokens: 100, completionTokens: 10, isEstimated: true },
    ]);
  });

  it("ShouldKeepWhatTheProviderReportedAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();

    brainServiceMock.generateNativelyStream.mockResolvedValue(
      createGenerationResult({ content: createRandomString(), promptTokens: 842, completionTokens: 37 }),
    );

    // when
    const actualContext = await inferenceOrchestrationService.decideStream(createAgentContext(createRandomString()), async () => {});

    // then
    // What the invoice is drawn from.
    expect(actualContext.promptTokens).toBe(842);
    expect(actualContext.completionTokens).toBe(37);
    expect(actualContext.usageIsEstimated).toBe(false);
    expect(usageServiceMock.measure).not.toHaveBeenCalled();
  });
});
