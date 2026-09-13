import { describe, expect, it } from "vitest";

import { FunctionGeneratorBrokerV1, createGenerationResult } from "../../brokers/generators/FunctionGeneratorBrokerV1.js";
import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";
import { StandardAgent } from "./StandardAgent.js";
import { createRandomString, createScriptedBrain, createSkillSource } from "./StandardAgentTests.js";

describe("StandardAgent native brain logic", () => {
  it("ShouldThinkThroughTheNativeBrainWhenGivenOneAsync", async () => {
    // given
    const prompt = createRandomString();
    const textBrain = createScriptedBrain(["FINAL: the text door answered"]);
    const nativeCalls: number[] = [];

    const nativeBroker = new FunctionGeneratorBrokerV1(async (messages) => {
      nativeCalls.push(messages.length);

      return createGenerationResult({ content: "the native door answered" });
    });

    const agent = new StandardAgent()
      .onBrain(textBrain.generate)
      .useNativeGenerator(nativeBroker)
      .onSkills(createSkillSource(createRandomString()));

    // when
    const actualAnswer = await agent.processPrompt(prompt);

    // then
    // A composition that has a native brain holds the conversation as messages. The text door is
    // still there and is not used, because the two are not a fallback chain: they are two
    // protocols, and the composition said which one it speaks.
    expect(actualAnswer).toBe("the native door answered");
    expect(nativeCalls).toHaveLength(1);
    expect(textBrain.calls).toHaveLength(0);
  });

  it("ShouldComposeBothDoorsFromOneNativeEndpointAsync", async () => {
    // given
    const agent = new StandardAgent();

    // when
    const composed = agent.nativeBrain("https://api.example.com/v1/", "key_never_a_real_key", "example-model");

    // then
    // One endpoint, both doors: the same OpenAI-compatible base answers a native turn and a text
    // turn, so nothing fails the first time something asks for the other.
    expect(composed).toBe(agent);
  });

  it("ShouldCarryHowMuchTheModelMayWriteFromTheEndpointItWasGivenAsync", async () => {
    // given
    const seen: (ResolvedInference | undefined)[] = [];

    const capturing = new FunctionGeneratorBrokerV1(async (_messages, _tools, inference) => {
      seen.push(inference);

      return createGenerationResult({ content: "the native door answered" });
    });

    const agent = new StandardAgent()
      .nativeBrain("https://api.example.com/v1/", "key_never_a_real_key", "example-model", 0.2, 8192)
      .useNativeGenerator(capturing)
      .onSkills(createSkillSource(createRandomString()));

    // when
    await agent.processPrompt(createRandomString());

    // then
    // The text door already took both; the native one took neither, so a composition that named an
    // endpoint got the framework's 1024 whatever it meant to say. A thousand tokens is a chat
    // answer, and a run whose tools carry files was cut off mid-argument by it.
    expect(seen[0]?.maxTokens).toBe(8192);
    expect(seen[0]?.temperature).toBe(0.2);
  });

  it.each(["", "api.example.com/v1/", "https://api.example.com/v1", "https://api.example.com/v1/chat/completions"])(
    "ShouldRefuseANativeEndpointThatIsNotABaseAsync(%j)",
    (apiUrl) => {
      // given
      const agent = new StandardAgent();

      // when
      const raised = (() => {
        try {
          agent.nativeBrain(apiUrl, "key_never_a_real_key", "example-model");

          return null;
        } catch (error: unknown) {
          return error as Error;
        }
      })();

      // then
      // An endpoint is the base the route is appended to. The broker owns the route, so a base
      // that already names it would reach it twice.
      expect(raised?.name).toBe("InvalidAgentApiUrlException");
    },
  );

});
