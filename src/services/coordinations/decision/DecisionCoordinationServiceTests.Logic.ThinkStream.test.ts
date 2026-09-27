import { describe, expect, it } from "vitest";

import type { GenerationDelta } from "../../../models/brokers/generators/v1/GenerationDelta.js";
import { UNCONSTRAINED } from "../../../models/foundations/contracts/ContractVerdict.js";
import type { AgentUsage } from "../../../models/foundations/usages/AgentUsage.js";
import { createDecisionCoordinationServiceTests, createRandomContext, createRandomString } from "./DecisionCoordinationServiceTests.js";

describe("DecisionCoordinationService streamed think", () => {
  it("ShouldScreenJudgeAndCheckAStreamedTurnExactlyAsItDoesABatchedOneAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = createRandomContext();
    const answer = createRandomString();
    guardianOrchestrationServiceMock.screen.mockResolvedValue("allow");
    guardianOrchestrationServiceMock.detectConflict.mockResolvedValue("NONE");
    guardianOrchestrationServiceMock.evaluate.mockResolvedValue({ score: 1, reason: "grounded" });
    guardianOrchestrationServiceMock.checkShape.mockResolvedValue(UNCONSTRAINED);

    inferenceOrchestrationServiceMock.decideStream.mockImplementation(async (resolved: { prompt: string }, voice: (delta: GenerationDelta) => Promise<void>) => {
      await voice({ content: answer, narration: "", completed: null });

      return { ...resolved, intent: "Respond", directionType: "ReturnResponse", payload: answer };
    });

    const voiced: string[] = [];

    // when
    const actualContext = await decisionCoordinationService.thinkStream(context, async (delta) => {
      voiced.push(delta.content);
    });

    // then
    expect(actualContext.payload).toBe(answer);
    expect(voiced).toEqual([answer]);

    // The same guardians, in the same order, as the batched door.
    expect(guardianOrchestrationServiceMock.screen).toHaveBeenCalledWith(context.prompt);
    expect(guardianOrchestrationServiceMock.evaluate).toHaveBeenCalledWith(context.prompt, answer);
    expect(guardianOrchestrationServiceMock.checkShape).toHaveBeenCalled();
    expect(inferenceOrchestrationServiceMock.decide).not.toHaveBeenCalled();
  });

  it("ShouldPassOnWhatTheCallHasSpentWhileItIsAnsweredAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const answer = createRandomString();
    guardianOrchestrationServiceMock.screen.mockResolvedValue("allow");
    guardianOrchestrationServiceMock.detectConflict.mockResolvedValue("NONE");
    guardianOrchestrationServiceMock.evaluate.mockResolvedValue({ score: 1, reason: "grounded" });
    guardianOrchestrationServiceMock.checkShape.mockResolvedValue(UNCONSTRAINED);

    inferenceOrchestrationServiceMock.decideStream.mockImplementation(
      async (resolved: { prompt: string }, _voice: unknown, spend?: (soFar: AgentUsage) => Promise<void>) => {
        await spend?.({ promptTokens: 4_210, completionTokens: 0, isEstimated: true });

        return { ...resolved, intent: "Respond", directionType: "ReturnResponse", payload: answer };
      },
    );

    const heard: AgentUsage[] = [];

    // when
    await decisionCoordinationService.thinkStream(
      createRandomContext(),
      async () => {},
      async (soFar) => {
        heard.push(soFar);
      },
    );

    // then
    expect(heard).toEqual([{ promptTokens: 4_210, completionTokens: 0, isEstimated: true }]);
  });

  it("ShouldRefuseAStreamedPromptTheGateRefusesBeforeTheBrainIsAskedAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    guardianOrchestrationServiceMock.screen.mockResolvedValue("refuse: not allowed");
    const voiced: string[] = [];

    // when
    const actualContext = await decisionCoordinationService.thinkStream(createRandomContext(), async (delta) => {
      voiced.push(delta.content);
    });

    // then
    expect(actualContext.payload).toBe("I'm not able to help with that.");
    expect(inferenceOrchestrationServiceMock.decideStream).not.toHaveBeenCalled();

    // Nothing was voiced, because nothing was said: the refusal is the loop's to report.
    expect(voiced).toEqual([]);
  });

});
