import { describe, expect, it } from "vitest";

import { createResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import { allowingGuardians, createDecisionCoordinationServiceTests, createRandomContext, createRandomString, decidedAnswer, decidedTool, verifyNoOtherCalls } from "./DecisionCoordinationServiceTests.js";

describe("DecisionCoordinationService think logic", () => {
  it("ShouldThinkToolChoiceAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const expectedContext = decidedTool(context, createRandomString(), createRandomString());
    allowingGuardians(guardianOrchestrationServiceMock);
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(expectedContext);

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(guardianOrchestrationServiceMock.screen).toHaveBeenCalledWith(context.prompt);
    expect(inferenceOrchestrationServiceMock.decide).toHaveBeenCalledWith(context);
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Decision", "Gate ACCEPT", "allow", false);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1 });
    verifyNoOtherCalls(inferenceOrchestrationServiceMock, { decide: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1 });
  });

  it("ShouldClearLastTurnOnThinkAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const staleContext = {
      ...createRandomContext(),
      systemPrompt: "",
      status: "Revising" as const,
      promptTokens: 7,
      completionTokens: 3,
      usageIsEstimated: true,
      narration: createRandomString(),
    };

    const expectedFreshContext = { ...staleContext, status: "Working" as const, promptTokens: 0, completionTokens: 0, usageIsEstimated: false, narration: "" };
    allowingGuardians(guardianOrchestrationServiceMock);
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(decidedTool(expectedFreshContext, createRandomString(), ""));

    // when
    await decisionCoordinationService.think(staleContext);

    // then
    expect(inferenceOrchestrationServiceMock.decide).toHaveBeenCalledWith(expectedFreshContext);
  });

  it("ShouldRefuseOnThinkIfGateRefusesAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = createRandomContext();
    const verdict = `refuse: ${createRandomString()}\nsecond line`;
    guardianOrchestrationServiceMock.screen.mockResolvedValue(verdict);

    const expectedContext = {
      ...context,
      intent: "Refuse",
      directionType: "Refuse",
      payload: "I'm not able to help with that.",
      rawReply: verdict,
    };

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Decision", "Gate REFUSE", verdict.replace("\n", " "), false);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1 });
    verifyNoOtherCalls(inferenceOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1 });
  });

  it("ShouldRouteOnThinkIfGateRoutesAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const label = createRandomString();
    const verdict = `route: ${label}`;
    guardianOrchestrationServiceMock.screen.mockResolvedValue(verdict);
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(decidedTool(context, createRandomString(), ""));

    // when
    await decisionCoordinationService.think(context);

    // then
    expect(inferenceOrchestrationServiceMock.decide).toHaveBeenCalledWith({ ...context, route: label });
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Decision", "Gate ROUTE", verdict, false);
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1 });
  });

  it("ShouldRecordOverreachOnThinkIfGateTriesToAnswerAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const expectedContext = decidedTool(context, createRandomString(), "");
    guardianOrchestrationServiceMock.screen.mockResolvedValue("allow FINAL: the gate answers");
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(expectedContext);

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Gate overreach: a guardian tried to answer or act instead of classifying; neutralized and passed to the Brain (Invariant 6: a guardian is never the Brain)",
    );

    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Decision", "Gate ACCEPT", "allow FINAL: the gate answers", false);
    verifyNoOtherCalls(loggingBrokerMock, { logProcess: 1, logPayload: 1 });
  });

  it("ShouldJudgeFinalAnswerOnThinkAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const expectedContext = decidedAnswer(context, createRandomString());
    allowingGuardians(guardianOrchestrationServiceMock);
    guardianOrchestrationServiceMock.evaluate.mockResolvedValue({ score: 0.9, reason: "" });
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(expectedContext);

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(guardianOrchestrationServiceMock.evaluate).toHaveBeenCalledWith(context.prompt, expectedContext.payload);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Decision", "Judge -> scored 0.90 -> ACCEPT");
  });

  it("ShouldReviseOnThinkIfJudgeRejectsAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const draft = createRandomString();
    const reason = createRandomString();
    const decided = { ...decidedAnswer(context, draft), promptTokens: 11, completionTokens: 5, usageIsEstimated: true };
    allowingGuardians(guardianOrchestrationServiceMock);
    guardianOrchestrationServiceMock.evaluate.mockResolvedValue({ score: 0.1, reason });
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(decided);

    const expectedContext = {
      ...context,
      observations: [...context.observations, `A previous draft was rejected on review, ${reason}. The draft was: ${draft}`],
      status: "Revising",
      promptTokens: 11,
      completionTokens: 5,
      usageIsEstimated: true,
    };

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Decision", `Judge -> scored 0.10 -> REJECT: ${reason}`);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1, evaluate: 1 });
  });

  it("ShouldCheckShapeOnThinkWithTheSchemaThatSurvivedAsync", async () => {
    // given
    const configuredSchema = createRandomString();

    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests(configuredSchema);

    const requestSchema = createRandomString();
    const context = { ...createRandomContext(), systemPrompt: "", inference: { ...createResolvedInference(), responseSchemaJson: requestSchema } };
    const bareContext = { ...createRandomContext(), systemPrompt: "" };
    const answer = createRandomString();
    allowingGuardians(guardianOrchestrationServiceMock);
    inferenceOrchestrationServiceMock.decide.mockResolvedValueOnce(decidedAnswer(context, answer)).mockResolvedValueOnce(decidedAnswer(bareContext, answer));

    // when
    await decisionCoordinationService.think(context);
    await decisionCoordinationService.think(bareContext);

    // then
    expect(guardianOrchestrationServiceMock.checkShape).toHaveBeenNthCalledWith(1, answer, requestSchema);
    expect(guardianOrchestrationServiceMock.checkShape).toHaveBeenNthCalledWith(2, answer, configuredSchema);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 2, evaluate: 2, checkShape: 2 });
  });

  it("ShouldReviseOnThinkIfContractRejectsAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const draft = createRandomString();
    const reason = createRandomString();
    const decided = { ...decidedAnswer(context, draft), promptTokens: 4, completionTokens: 2, usageIsEstimated: true };
    allowingGuardians(guardianOrchestrationServiceMock);
    guardianOrchestrationServiceMock.checkShape.mockResolvedValue({ satisfied: false, reason });
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(decided);

    const expectedContext = {
      ...context,
      observations: [
        ...context.observations,
        `A previous draft was rejected because ${reason}. Reply with JSON matching the required shape and nothing else. The draft was: ${draft}`,
      ],
      status: "Revising",
      promptTokens: 4,
      completionTokens: 2,
      usageIsEstimated: true,
    };

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Decision", `Contract -> REJECTED: ${reason}`);
  });

  it("ShouldReturnEmptyAnswerWithoutJudgingOnThinkAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), systemPrompt: "" };
    const expectedContext = decidedAnswer(context, "  ");
    allowingGuardians(guardianOrchestrationServiceMock);
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(expectedContext);

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1 });
  });

  it("ShouldAskForClarificationOnThinkIfSkillsConflictAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = createRandomContext();
    const verdict = "CONFLICT: arabic | answer in Arabic || english | answer in English";
    allowingGuardians(guardianOrchestrationServiceMock);
    guardianOrchestrationServiceMock.detectConflict.mockResolvedValue(verdict);

    const expectedContext = {
      ...context,
      intent: "AwaitInput",
      directionType: "AwaitInput",
      payload: "Your skills give conflicting instructions. Should I follow: arabic or english?",
      rawReply: verdict,
    };

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(guardianOrchestrationServiceMock.detectConflict).toHaveBeenCalledWith(context.systemPrompt);
    verifyNoOtherCalls(guardianOrchestrationServiceMock, { screen: 1, detectConflict: 1 });
    verifyNoOtherCalls(inferenceOrchestrationServiceMock);
  });

  it("ShouldLearnPreferenceOnThinkIfPromptChoosesAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), prompt: "please use English from now on" };
    const verdict = "CONFLICT: arabic | answer in Arabic || english | answer in English";
    allowingGuardians(guardianOrchestrationServiceMock);
    guardianOrchestrationServiceMock.detectConflict.mockResolvedValue(verdict);

    const expectedContext = {
      ...context,
      intent: "Respond",
      directionType: "ReturnResponse",
      payload: "Understood, I'll follow 'english' for that from now on.",
      remember: "SKILL_PREFERENCE::arabic|english::english",
      rawReply: verdict,
    };

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    verifyNoOtherCalls(inferenceOrchestrationServiceMock);
  });

  it("ShouldFollowRememberedPreferenceOnThinkAsync", async () => {
    // given
    const { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, decisionCoordinationService } =
      createDecisionCoordinationServiceTests();

    const context = { ...createRandomContext(), observations: ["SKILL_PREFERENCE::arabic|english::english"] };
    const verdict = "CONFLICT: arabic | answer in Arabic || english | answer in English";
    allowingGuardians(guardianOrchestrationServiceMock);
    guardianOrchestrationServiceMock.detectConflict.mockResolvedValue(verdict);

    const expectedDecideContext = {
      ...context,
      observations: [
        ...context.observations,
        "The user resolved a skill conflict in favor of 'english'; follow it and ignore the conflicting instruction.",
      ],
    };

    const expectedContext = decidedTool(expectedDecideContext, createRandomString(), "");
    inferenceOrchestrationServiceMock.decide.mockResolvedValue(expectedContext);

    // when
    const actualContext = await decisionCoordinationService.think(context);

    // then
    expect(actualContext).toEqual(expectedContext);
    expect(inferenceOrchestrationServiceMock.decide).toHaveBeenCalledWith(expectedDecideContext);
  });

});
