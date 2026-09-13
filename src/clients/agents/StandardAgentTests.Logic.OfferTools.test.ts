import { describe, expect, it } from "vitest";

import { FunctionGeneratorBrokerV1, createGenerationResult } from "../../brokers/generators/FunctionGeneratorBrokerV1.js";
import type { ToolDefinition } from "../../models/brokers/generators/v1/ToolDefinition.js";
import { StandardAgent } from "./StandardAgent.js";
import { createRandomString, createScriptedBrain, createSkillSource, createStubTool } from "./StandardAgentTests.js";

describe("StandardAgent tool offering logic", () => {
  it("ShouldOfferTheToolsAsSchemasToANativeBrainAsync", async () => {
    // given
    let offered: readonly ToolDefinition[] = [];

    const nativeBroker = new FunctionGeneratorBrokerV1(async (_messages, tools) => {
      offered = tools;

      return createGenerationResult({ content: "done" });
    });

    const readFile = {
      ...createStubTool("read_file", "", "Read a file in the workspace."),
      parameters: JSON.stringify({ type: "object", properties: { path: { type: "string" } } }),
    };

    const agent = new StandardAgent()
      .onBrain(createScriptedBrain(["FINAL: unused"]).generate)
      .useNativeGenerator(nativeBroker)
      .tool(readFile)
      .onSkills(createSkillSource(createRandomString()));

    // when
    await agent.processPrompt("read something");

    // then
    // The native protocol's whole point: the brain is handed schemas it can call rather than a
    // paragraph describing them. Offered nothing, the best brain in the world can only talk.
    expect(offered).toHaveLength(1);
    expect(offered[0]?.name).toBe("read_file");
    expect(offered[0]?.description).toBe("Read a file in the workspace.");
    expect(JSON.parse(offered[0]?.parametersJson ?? "null")).toEqual({
      type: "object",
      properties: { path: { type: "string" } },
    });
  });

  it("ShouldOfferOnlyTheToolsTheCatalogAdvertisesAsync", async () => {
    // given
    let offered: readonly ToolDefinition[] = [];

    const nativeBroker = new FunctionGeneratorBrokerV1(async (_messages, tools) => {
      offered = tools;

      return createGenerationResult({ content: "done" });
    });

    const agent = new StandardAgent()
      .onBrain(createScriptedBrain(["FINAL: unused"]).generate)
      .useNativeGenerator(nativeBroker)
      .tool(createStubTool("described", "", "A tool the model may be told about."))
      .tool(createStubTool("undescribed", ""))
      .onSkills(createSkillSource(createRandomString()));

    // when
    await agent.processPrompt("do something");

    // then
    // A description is the advertisement opt-in. A tool without one stays callable and is never
    // listed, and the two protocols must agree about that or a tool changes behaviour with the
    // brain that answered.
    expect(offered.map((tool) => tool.name)).toEqual(["described"]);
  });

  it("ShouldOfferAnEmptySchemaForAToolThatDeclaresNoParametersAsync", async () => {
    // given
    let offered: readonly ToolDefinition[] = [];

    const nativeBroker = new FunctionGeneratorBrokerV1(async (_messages, tools) => {
      offered = tools;

      return createGenerationResult({ content: "done" });
    });

    const agent = new StandardAgent()
      .onBrain(createScriptedBrain(["FINAL: unused"]).generate)
      .useNativeGenerator(nativeBroker)
      .tool(createStubTool("git_status", "", "Say what git status says."))
      .onSkills(createSkillSource(createRandomString()));

    // when
    await agent.processPrompt("check the tree");

    // then
    // Offered as the empty object schema rather than omitted: a provider reads a missing schema as
    // a tool it cannot call.
    expect(JSON.parse(offered[0]?.parametersJson ?? "null")).toEqual({ type: "object", properties: {} });
  });

});
