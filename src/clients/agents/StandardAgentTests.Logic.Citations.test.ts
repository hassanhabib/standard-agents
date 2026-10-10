import { describe, expect, it } from "vitest";

import { createPromptRequest } from "../../models/clients/agents/PromptRequest.js";
import { StandardAgent } from "./StandardAgent.js";
import { createRandomString, createScriptedBrain, createSkillSource } from "./StandardAgentTests.js";

// A grounded answer cites its sources (SPEC.md 3.7, 4.1, 4.2, v1.18), composed the way a host
// would compose it: a sourced knowledge source, and citation asked for on the agent.
describe("StandardAgent citation logic", () => {
  const passage = "Refund policy. Enterprise customers may request a refund within 90 days of purchase.";

  it("ShouldCiteTheSourceOfRecalledKnowledgeWhenTheAgentAsksAsync", async () => {
    // given
    const brain = createScriptedBrain(["FINAL: enterprise customers have 90 days"]);

    const agent = new StandardAgent()
      .onBrain(brain.generate)
      .onSkills(createSkillSource(createRandomString()))
      .onSourcedKnowledge(async () => [{ text: passage, score: 0.9, source: "refunds.md" }])
      .citeKnowledge();

    // when
    const actualAnswer = await agent.processPrompt("what is our refund policy for enterprise customers");

    // then
    expect(actualAnswer).toBe("enterprise customers have 90 days\n\nSource: refunds.md");
    expect(brain.calls.some((call) => call.userPrompt.includes("within 90 days of purchase"))).toBe(true);
    expect(brain.calls.some((call) => call.userPrompt.includes("Source: refunds.md"))).toBe(false);
  });

  it("ShouldCiteWithTheConfiguredPrefixEvenWhenARequestDeclinesAsync", async () => {
    // given
    const agent = new StandardAgent()
      .onBrain(createScriptedBrain(["FINAL: enterprise customers have 90 days"]).generate)
      .onSkills(createSkillSource(createRandomString()))
      .onSourcedKnowledge(async () => [{ text: passage, score: 0.9, source: "refunds.md" }])
      .citeKnowledge(true, "Reference: ");

    // when
    const actualOutcome = await agent.runAsync({ ...createPromptRequest("refunds?"), citeKnowledge: false });

    // then
    expect(actualOutcome.result).toBe("enterprise customers have 90 days\n\nReference: refunds.md");
  });

  it("ShouldNeverCiteAPassageFromAPlainKnowledgeSourceAsync", async () => {
    // given
    const brain = createScriptedBrain(["FINAL: enterprise customers have 90 days"]);

    const agent = new StandardAgent()
      .onBrain(brain.generate)
      .onSkills(createSkillSource(createRandomString()))
      .onKnowledge(async () => [passage])
      .citeKnowledge();

    // when
    const actualAnswer = await agent.processPrompt("what is our refund policy for enterprise customers");

    // then
    expect(actualAnswer).toBe("enterprise customers have 90 days");
    expect(brain.calls.some((call) => call.userPrompt.includes("within 90 days of purchase"))).toBe(true);
  });
});
