import { describe, expect, it } from "vitest";

import { InvalidAgentApiUrlException } from "../../models/clients/agents/exceptions/InvalidAgentApiUrlException.js";
import { InvalidAgentBudgetException } from "../../models/clients/agents/exceptions/InvalidAgentBudgetException.js";
import { InvalidAgentCompositionException } from "../../models/clients/agents/exceptions/InvalidAgentCompositionException.js";
import { StandardAgent } from "./StandardAgent.js";
import { createRandomString } from "./StandardAgentTests.js";

describe("StandardAgent composition validations", () => {
  it("ShouldThrowCompositionExceptionOnProcessPromptIfBrainIsNotConfiguredAsync", async () => {
    // given
    const agent = new StandardAgent();

    // when
    const processTask = agent.processPrompt(createRandomString());

    // then
    const actualException = await processTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(InvalidAgentCompositionException);
    expect((actualException as Error).message).toContain("no brain");
  });

  it.each(["not a url", "https://api.example.com/v1", "https://api.example.com/v1/chat/completions/", "ftp://api.example.com/v1/"])(
    "ShouldThrowApiUrlExceptionOnBrainIfUrlIsNotABase (%s)",
    (invalidApiUrl) => {
      // given
      const agent = new StandardAgent();

      // when
      const brainAction = (): StandardAgent => agent.brain(invalidApiUrl, createRandomString(), createRandomString());

      // then
      expect(brainAction).toThrow(InvalidAgentApiUrlException);
    },
  );

  it("ShouldAcceptABaseApiUrlOnBrain", () => {
    // given
    const agent = new StandardAgent();

    // when
    const brainAction = (): StandardAgent => agent.brain("https://api.example.com/v1/", createRandomString(), createRandomString());

    // then
    expect(brainAction).not.toThrow();
  });

  it("ShouldThrowBudgetExceptionOnBudgetIfCostBoundHasNoRate", () => {
    // given
    const agent = new StandardAgent();

    // when
    const budgetAction = (): StandardAgent => agent.budget({ maxCostUsd: 1 });

    // then
    expect(budgetAction).toThrow(InvalidAgentBudgetException);
  });

});
