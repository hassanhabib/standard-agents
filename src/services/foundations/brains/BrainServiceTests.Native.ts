import { vi, type Mock } from "vitest";

import type { GeneratorBroker } from "../../../brokers/generators/GeneratorBroker.js";
import type { GeneratorBrokerV1 } from "../../../brokers/generators/GeneratorBrokerV1.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { createGenerationResult } from "../../../brokers/generators/FunctionGeneratorBrokerV1.js";
import type { GenerationResult } from "../../../models/brokers/generators/v1/GenerationResult.js";
import type { AgentTurn } from "../../../models/brokers/sessions/AgentTurn.js";
import { createNativeOptions, type NativeOptions } from "../../../models/foundations/brains/NativeAsk.js";
import type { ToolExchange } from "../../../models/orchestrations/agents/ToolExchange.js";
import { BrainService } from "./BrainService.js";
import { createLoggingBrokerMock, createRandomString, type LoggingBrokerMock } from "./BrainServiceTests.js";

export interface GeneratorBrokerV1Mock {
  honorsRequest: boolean;
  readonly generate: Mock;
  readonly generateStream: Mock;
}

export function createNativeBrainServiceTests(
  options: Partial<NativeOptions> = {},
  honorsRequest = true,
): {
  generatorBrokerV1Mock: GeneratorBrokerV1Mock;
  loggingBrokerMock: LoggingBrokerMock;
  brainService: BrainService;
} {
  const generatorBrokerV1Mock: GeneratorBrokerV1Mock = { honorsRequest, generate: vi.fn(), generateStream: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const brainService = new BrainService(
    { honorsRequest: true, generate: vi.fn() } as unknown as GeneratorBroker,
    loggingBrokerMock as unknown as LoggingBroker,
    generatorBrokerV1Mock as unknown as GeneratorBrokerV1,
    createNativeOptions(options),
  );

  return { generatorBrokerV1Mock, loggingBrokerMock, brainService };
}

export function createExchange(overrides: Partial<ToolExchange> = {}): ToolExchange {
  return {
    callId: `call_${Math.random().toString(36).slice(2, 10)}`,
    toolName: createRandomString(),
    argumentsJson: "{}",
    result: createRandomString(),
    ...overrides,
  };
}

export function createTurn(overrides: Partial<AgentTurn> = {}): AgentTurn {
  return { prompt: createRandomString(), answer: createRandomString(), exchanges: [], ...overrides };
}

export function createRandomGeneration(): GenerationResult {
  return createGenerationResult({ content: createRandomString() });
}

// The provider's own refusal of an over-large request, in the shape the HTTP broker raises it.
export function createTooLargeRejection(): Error {
  const rejection = new Error("HTTP 400") as Error & { status: number; body: string };
  rejection.name = "HttpResponseException";
  rejection.status = 400;
  rejection.body = '{"error":{"message":"maximum context length exceeded"}}';

  return rejection;
}
