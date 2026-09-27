import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { GeneratorBroker } from "../../../brokers/generators/GeneratorBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import type { ResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import { createNativeOptions } from "../../../models/foundations/brains/NativeAsk.js";
import { createResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import { BrainService } from "./BrainService.js";

export interface GeneratorBrokerMock {
  honorsRequest: boolean;
  readonly generate: Mock<(systemPrompt: string, userPrompt: string, inference?: ResolvedInference) => Promise<string>>;
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

export function createBrainServiceTests(honorsRequest = true): {
  generatorBrokerMock: GeneratorBrokerMock;
  loggingBrokerMock: LoggingBrokerMock;
  timeBrokerMock: TimeBrokerMock;
  brainService: BrainService;
} {
  const generatorBrokerMock: GeneratorBrokerMock = { honorsRequest, generate: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();
  const timeBrokerMock = createTimeBrokerMock();

  const brainService = new BrainService(
    generatorBrokerMock as unknown as GeneratorBroker,
    loggingBrokerMock as unknown as LoggingBroker,
    null,
    createNativeOptions(),
    timeBrokerMock as unknown as TimeBroker,
  );

  return { generatorBrokerMock, loggingBrokerMock, timeBrokerMock, brainService };
}

// A clock whose waits return at once, so a test of waiting never waits.
export interface TimeBrokerMock {
  readonly getCurrentDateTime: Mock<() => Date>;
  readonly delay: Mock<(milliseconds: number, signal?: AbortSignal) => Promise<void>>;
}

export function createTimeBrokerMock(): TimeBrokerMock {
  return {
    getCurrentDateTime: vi.fn(() => new Date()),
    delay: vi.fn(async () => {}),
  };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomInference(): ResolvedInference {
  return { ...createResolvedInference(), temperature: Math.random(), maxTokens: 100 + Math.floor(Math.random() * 900) };
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
