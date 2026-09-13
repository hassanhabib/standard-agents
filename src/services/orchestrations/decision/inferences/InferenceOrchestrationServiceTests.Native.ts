import { vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { ToolDefinition } from "../../../../models/brokers/generators/v1/ToolDefinition.js";
import type { McpTool } from "../../../../models/brokers/mcps/McpTool.js";
import type { BrainService } from "../../../foundations/brains/BrainService.js";
import type { UsageService } from "../../../foundations/usages/UsageService.js";
import { InferenceOrchestrationService } from "./InferenceOrchestrationService.js";
import { createLoggingBrokerMock, type LoggingBrokerMock } from "./InferenceOrchestrationServiceTests.js";

export interface NativeBrainServiceMock {
  speaksNatively: boolean;
  readonly generate: Mock;
  readonly generateNatively: Mock;
  readonly generateNativelyStream: Mock;
}

export interface UsageServiceMock {
  readonly measure: Mock;
}

export function createNativeInferenceTests(toolDefinitions: readonly ToolDefinition[] = []): {
  brainServiceMock: NativeBrainServiceMock;
  usageServiceMock: UsageServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  inferenceOrchestrationService: InferenceOrchestrationService;
} {
  const brainServiceMock: NativeBrainServiceMock = {
    speaksNatively: true,
    generate: vi.fn(),
    generateNatively: vi.fn(),
    generateNativelyStream: vi.fn(),
  };
  const usageServiceMock: UsageServiceMock = { measure: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const inferenceOrchestrationService = new InferenceOrchestrationService(
    brainServiceMock as unknown as BrainService,
    usageServiceMock as unknown as UsageService,
    loggingBrokerMock as unknown as LoggingBroker,
    toolDefinitions,
  );

  return { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService };
}

export function createToolDefinition(name: string): ToolDefinition {
  return { name, description: `the ${name} tool`, parametersJson: "{}" };
}

// A tool a server declared, as the run carries it. Discovery happens at the top of the run, so a
// test that wants remote tools writes them where the run keeps them.
export function createRemoteTool(name: string, description = `the ${name} tool`): McpTool {
  return { name, description, inputSchemaJson: `{"type":"object","title":"${name}"}` };
}
