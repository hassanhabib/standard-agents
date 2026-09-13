import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { BrainService } from "../../../foundations/brains/BrainService.js";
import type { UsageService } from "../../../foundations/usages/UsageService.js";
import { createAgentContext, type AgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";
import type { AgentUsage } from "../../../../models/foundations/usages/AgentUsage.js";
import { InferenceOrchestrationService } from "./InferenceOrchestrationService.js";

export interface BrainServiceMock {
  readonly generate: Mock;
}

export interface UsageServiceMock {
  readonly measure: Mock;
}

export interface LoggingBrokerMock {
  readonly logInformation: Mock<(message: string) => Promise<void>>;
  readonly logTrace: Mock<(message: string) => Promise<void>>;
  readonly logDebug: Mock<(message: string) => Promise<void>>;
  readonly logWarning: Mock<(message: string) => Promise<void>>;
  readonly logError: Mock<(error: Error) => Promise<void>>;
  readonly logCritical: Mock<(error: Error) => Promise<void>>;
  readonly logReset: Mock<() => Promise<void>>;
  readonly logTurn: Mock<(turn: number) => Promise<void>>;
  readonly logOutcome: Mock<(message: string) => Promise<void>>;
  readonly logStep: Mock<(step: "Data" | "Decision" | "Direction") => Promise<void>>;
  readonly logProcess: Mock<(actor: string, message: string, detail?: boolean) => Promise<void>>;
  readonly logPayload: Mock<(actor: string, summary: string, payload: string, detail: boolean) => Promise<void>>;
}

export function createLoggingBrokerMock(): LoggingBrokerMock {
  return {
    logInformation: vi.fn(async () => {}),
    logTrace: vi.fn(async () => {}),
    logDebug: vi.fn(async () => {}),
    logWarning: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
    logCritical: vi.fn(async () => {}),
    logReset: vi.fn(async () => {}),
    logTurn: vi.fn(async () => {}),
    logOutcome: vi.fn(async () => {}),
    logStep: vi.fn(async () => {}),
    logProcess: vi.fn(async () => {}),
    logPayload: vi.fn(async () => {}),
  };
}

export function createInferenceOrchestrationServiceTests(): {
  brainServiceMock: BrainServiceMock;
  usageServiceMock: UsageServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  inferenceOrchestrationService: InferenceOrchestrationService;
} {
  const brainServiceMock: BrainServiceMock = { generate: vi.fn() };
  const usageServiceMock: UsageServiceMock = { measure: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const inferenceOrchestrationService = new InferenceOrchestrationService(
    brainServiceMock as unknown as BrainService,
    usageServiceMock as unknown as UsageService,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { brainServiceMock, usageServiceMock, loggingBrokerMock, inferenceOrchestrationService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomContext(): AgentContext {
  return { ...createAgentContext(createRandomString()), systemPrompt: createRandomString() };
}

export function createRandomUsage(): AgentUsage {
  return {
    promptTokens: Math.floor(Math.random() * 100) + 1,
    completionTokens: Math.floor(Math.random() * 100) + 1,
    isEstimated: true,
  };
}

interface ExceptionShape {
  readonly name: string;
  readonly message: string;
  readonly innerError?: Error;
  readonly data?: Map<string, string[]>;
}

export function expectSameExceptionAs(actual: unknown, expected: Error): void {
  const actualShape = actual as ExceptionShape;
  const expectedShape = expected as unknown as ExceptionShape;

  expect(actualShape.name).toBe(expectedShape.name);
  expect(actualShape.message).toBe(expectedShape.message);
  expect([...(actualShape.data ?? new Map())]).toEqual([...(expectedShape.data ?? new Map())]);

  if (expectedShape.innerError === undefined) {
    expect(actualShape.innerError).toBeUndefined();
    return;
  }

  expect(actualShape.innerError).toBeDefined();
  expectSameExceptionAs(actualShape.innerError, expectedShape.innerError);
}

export function verifyNoOtherCalls(mock: object, expectedCalls: Readonly<Record<string, number>> = {}): void {
  for (const [name, member] of Object.entries(mock)) {
    if (typeof member !== "function") {
      continue;
    }

    const mocked = member as Mock;
    expect(mocked.mock.calls.length, `${name} call count`).toBe(expectedCalls[name] ?? 0);
  }
}
