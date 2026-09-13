import { describe, expect, it } from "vitest";

import { createGenerationResult } from "../../../../brokers/generators/FunctionGeneratorBrokerV1.js";
import { createResolvedInference } from "../../../../models/brokers/generators/ResolvedInference.js";
import type { ToolDefinition } from "../../../../models/brokers/generators/v1/ToolDefinition.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import { createAgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";
import { createRandomString } from "./InferenceOrchestrationServiceTests.js";
import { createNativeInferenceTests, createRemoteTool, createToolDefinition } from "./InferenceOrchestrationServiceTests.Native.js";

describe("InferenceOrchestrationService native logic", () => {
  it("ShouldReadAnAnswerOutOfAStructuredGenerationAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService } = createNativeInferenceTests();
    const answer = createRandomString();

    brainServiceMock.generateNatively.mockResolvedValue(
      createGenerationResult({ content: answer, narration: "Reading first.", promptTokens: 40, completionTokens: 9 }),
    );

    const context = { ...createAgentContext("explain this repository"), systemPrompt: "You are a test agent." };

    // when
    const actualContext = await inferenceOrchestrationService.decide(context);

    // then
    expect(actualContext.intent).toBe("Respond");
    expect(actualContext.directionType).toBe("ReturnResponse");
    expect(actualContext.payload).toBe(answer);
    expect(actualContext.narration).toBe("Reading first.");
    expect(actualContext.promptTokens).toBe(40);
    expect(actualContext.completionTokens).toBe(9);

    // Reported by the provider, so never counted and never called an estimate.
    expect(actualContext.usageIsEstimated).toBe(false);
    expect(usageServiceMock.measure).not.toHaveBeenCalled();

    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { prompt: string; systemPrompt: string };
    expect(ask.prompt).toBe("explain this repository");
    expect(ask.systemPrompt).toBe("You are a test agent.");
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Decision", "Interpreted -> ReturnResponse");
  });

  it("ShouldReadACallOutOfAStructuredGenerationAsync", async () => {
    // given
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();

    brainServiceMock.generateNatively.mockResolvedValue(
      createGenerationResult({
        content: "Let me look at the entry point.",
        toolCalls: [{ id: "call_7", name: "read_file", argumentsJson: '{"path":"src/index.ts"}' }],
        finishReason: "tool_calls",
      }),
    );

    // when
    const actualContext = await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));

    // then
    expect(actualContext.intent).toBe("read_file");
    expect(actualContext.directionType).toBe("read_file");
    expect(actualContext.payload).toBe('{"path":"src/index.ts"}');
    expect(actualContext.toolCallId).toBe("call_7");

    // What the model said while calling is kept beside what it did.
    expect(actualContext.assistantContent).toBe("Let me look at the entry point.");
  });

  it("ShouldPerformTheFirstCallAndNameTheOnesItDropsAsync", async () => {
    // given
    const { brainServiceMock, loggingBrokerMock, inferenceOrchestrationService } = createNativeInferenceTests();

    brainServiceMock.generateNatively.mockResolvedValue(
      createGenerationResult({
        toolCalls: [
          { id: "call_1", name: "read_file", argumentsJson: "{}" },
          { id: "call_2", name: "grep_files", argumentsJson: "{}" },
          { id: "call_3", name: "list_directory", argumentsJson: "{}" },
        ],
        finishReason: "tool_calls",
      }),
    );

    // when
    const actualContext = await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));

    // then
    expect(actualContext.directionType).toBe("read_file");

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith(
      "Decision",
      "Brain -> proposed 3 calls in one turn; performing the first and dropping [call_2, call_3]",
      true,
    );
  });

  it("ShouldOfferTheConfiguredToolsAndTheCallersOwnAsync", async () => {
    // given
    const configured = [createToolDefinition("read_file"), createToolDefinition("delete_path")];
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests(configured);
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    const callerTool = createToolDefinition("caller_lookup");

    const context = {
      ...createAgentContext(createRandomString()),
      inference: { ...createResolvedInference(), callerTools: [callerTool] },
    };

    // when
    await inferenceOrchestrationService.decide(context);

    // then
    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { tools: ToolDefinition[] };
    expect(ask.tools.map((tool) => tool.name)).toEqual(["read_file", "delete_path", "caller_lookup"]);
  });

  it("ShouldOfferOnlyWhatSelectionOfferedThisRunAsync", async () => {
    // given
    const configured = [createToolDefinition("read_file"), createToolDefinition("delete_path")];
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests(configured);
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    // when
    await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.offeredTools = ["read_file"];
      }

      await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));
    });

    // then
    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { tools: ToolDefinition[] };
    expect(ask.tools.map((tool) => tool.name)).toEqual(["read_file"]);
  });

  it("ShouldOfferTheServersToolsBesideTheAgentsOwnAsync", async () => {
    // given
    // The text protocol lists a server's tools in the catalog. A model that speaks natively never
    // reads that catalog: it is handed schemas, and a tool that is not among them does not exist to
    // it. Configured tools are not the whole of what a run may call.
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests([createToolDefinition("read_file")]);
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    const remote = createRemoteTool("memory__read_graph");

    // when
    await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.remoteTools = [remote];
      }

      await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));
    });

    // then
    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { tools: ToolDefinition[] };
    expect(ask.tools.map((tool) => tool.name)).toContain("memory__read_graph");

    // What the tool takes rides across with it. A name with no schema is a tool the model can see
    // and cannot call.
    expect(ask.tools.find((tool) => tool.name === "memory__read_graph")?.parametersJson).toBe(remote.inputSchemaJson);
  });

  it("ShouldLeaveARemoteToolWithNoDescriptionUnlistedAsync", async () => {
    // given
    // A description is the advertisement opt-in, and it is the same opt-in on both protocols. A
    // server that declared a tool without describing it did not ask for it to be offered, and a
    // model handed a schema with nothing to read will call it to find out what it does.
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests([createToolDefinition("read_file")]);
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    // when
    await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.remoteTools = [createRemoteTool("memory__read_graph"), createRemoteTool("memory__wipe", "   ")];
      }

      await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));
    });

    // then
    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { tools: ToolDefinition[] };
    expect(ask.tools.map((tool) => tool.name)).not.toContain("memory__wipe");
    expect(ask.tools.map((tool) => tool.name)).toContain("memory__read_graph");
  });

  it("ShouldKeepAConfiguredToolsNameWhenAServerClaimsItAsync", async () => {
    // given
    // A call carries a name and nothing else, so a name offered twice is a call with two meanings.
    // First to claim it keeps it: a server cannot take delete_path away from the agent by declaring
    // one, and the agent's own tool is the one under the agent's own controls.
    const configured = [createToolDefinition("read_file"), createToolDefinition("delete_path")];
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests(configured);
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    // when
    await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.remoteTools = [createRemoteTool("DELETE_PATH"), createRemoteTool("memory__read_graph")];
      }

      await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));
    });

    // then
    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { tools: ToolDefinition[] };
    expect(ask.tools.map((tool) => tool.name)).toEqual(["read_file", "delete_path", "memory__read_graph"]);
  });

  it("ShouldWithholdARemoteToolSelectionDidNotOfferAsync", async () => {
    // given
    // Selection judges the agent's described tools and its servers' together, and what it withheld
    // it withheld. A remote tool that came back as a schema anyway would make the offering a
    // suggestion, which is not what a perimeter is.
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests([createToolDefinition("read_file")]);
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    // when
    await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.remoteTools = [createRemoteTool("memory__read_graph"), createRemoteTool("memory__delete_entities")];
        run.offeredTools = ["read_file", "memory__read_graph"];
      }

      await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));
    });

    // then
    const ask = brainServiceMock.generateNatively.mock.calls[0]?.[0] as { tools: ToolDefinition[] };
    expect(ask.tools.map((tool) => tool.name)).toEqual(["read_file", "memory__read_graph"]);
  });

  it("ShouldReachTheBrainWithTheRunsOwnStopAsync", async () => {
    // given
    // Stop is the only thing a person has once a run is going, and the longest thing in a turn is
    // the model answering. A stop that only took effect between turns would be a button that does
    // nothing for the ninety seconds somebody most wants it to.
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: createRandomString() }));

    const controller = new AbortController();

    // when
    await AgentRun.begin(null, controller.signal, async () => {
      await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));
    });

    // then
    // Read off the ambient run rather than threaded through every signature, which is where the
    // run already keeps it and where this tier already reads the offering.
    expect(brainServiceMock.generateNatively.mock.calls[0]?.[1]).toBe(controller.signal);
  });

  it("ShouldReadAFilteredGenerationAsARefusalRatherThanAnEmptyAnswerAsync", async () => {
    // given
    const { brainServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    brainServiceMock.generateNatively.mockResolvedValue(createGenerationResult({ content: "", finishReason: "content_filter" }));

    // when
    const actualContext = await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));

    // then
    expect(actualContext.intent).toBe("Refuse");
    expect(actualContext.directionType).toBe("Refuse");
    expect(actualContext.payload).toBe("I'm not able to help with that.");
  });

  it("ShouldStillReadTheTextProtocolWhenTheBrainDoesNotSpeakNativelyAsync", async () => {
    // given
    const { brainServiceMock, usageServiceMock, inferenceOrchestrationService } = createNativeInferenceTests();
    brainServiceMock.speaksNatively = false;
    brainServiceMock.generate.mockResolvedValue("FINAL: 42");
    usageServiceMock.measure.mockResolvedValue({ promptTokens: 3, completionTokens: 2, isEstimated: true });

    // when
    const actualContext = await inferenceOrchestrationService.decide(createAgentContext(createRandomString()));

    // then
    expect(actualContext.payload).toBe("42");
    expect(brainServiceMock.generateNatively).not.toHaveBeenCalled();
  });

});
