import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { StandardAgent } from "./StandardAgent.js";
import { createRandomString, createScriptedBrain, createSkillSource } from "./StandardAgentTests.js";

// The Local knowledge mode (SPEC.md 4.2), composed the way a host would compose it: a real folder
// of documents on disk, named on the agent, ranked by relevance and citable out of the box.
describe("StandardAgent knowledge folder logic", () => {
  const prompt = "what is our refund policy for enterprise customers";
  let knowledgePath = "";

  beforeAll(async () => {
    knowledgePath = await mkdtemp(join(tmpdir(), "standard-agents-knowledge-"));
    await mkdir(join(knowledgePath, "policies"));

    await writeFile(
      join(knowledgePath, "policies", "refunds.md"),
      "Refund policy. Enterprise customers may request a refund within 90 days of purchase.",
    );

    await writeFile(join(knowledgePath, "shipping.md"), "Shipping policy. Orders ship within two business days.");
    await writeFile(join(knowledgePath, "holidays.md"), "The office is closed on public holidays.");
  });

  afterAll(async () => {
    await rm(knowledgePath, { recursive: true, force: true });
  });

  it("ShouldGroundTheRunInTheMostRelevantPassageOfAKnowledgeFolderAsync", async () => {
    // given
    const brain = createScriptedBrain(["FINAL: enterprise customers have 90 days"]);

    const agent = new StandardAgent()
      .onBrain(brain.generate)
      .onSkills(createSkillSource(createRandomString()))
      .knowledge(knowledgePath, "*.md", 1);

    // when
    const actualAnswer = await agent.processPrompt(prompt);

    // then
    expect(actualAnswer).toBe("enterprise customers have 90 days");
    expect(brain.calls.some((call) => call.userPrompt.includes("within 90 days of purchase"))).toBe(true);
    expect(brain.calls.some((call) => call.userPrompt.includes("public holidays"))).toBe(false);
  });

  it("ShouldCiteTheDocumentAKnowledgeFolderPassageCameFromAsync", async () => {
    // given
    const agent = new StandardAgent()
      .onBrain(createScriptedBrain(["FINAL: enterprise customers have 90 days"]).generate)
      .onSkills(createSkillSource(createRandomString()))
      .knowledge(knowledgePath, "*.md", 1)
      .citeKnowledge();

    // when
    const actualAnswer = await agent.processPrompt(prompt);

    // then
    expect(actualAnswer).toBe("enterprise customers have 90 days\n\nSource: policies/refunds.md");
  });

  // A knowledge broker is the External mode and the folder the Local one; when a host configured
  // both, the broker answers whatever order the verbs were called in, as in the reference.
  it("ShouldPreferAKnowledgeBrokerOverAKnowledgeFolderWhateverTheOrderAsync", async () => {
    // given
    const brain = createScriptedBrain(["FINAL: noted"]);
    const brokerPassage = createRandomString();

    const agent = new StandardAgent()
      .onBrain(brain.generate)
      .onSkills(createSkillSource(createRandomString()))
      .onKnowledge(async () => [brokerPassage])
      .knowledge(knowledgePath);

    // when
    await agent.processPrompt(prompt);

    // then
    expect(brain.calls.some((call) => call.userPrompt.includes(brokerPassage))).toBe(true);
    expect(brain.calls.some((call) => call.userPrompt.includes("within 90 days of purchase"))).toBe(false);
  });
});
