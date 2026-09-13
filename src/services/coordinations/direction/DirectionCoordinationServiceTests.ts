import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { PerimeterOrchestrationService } from "../../orchestrations/direction/perimeters/PerimeterOrchestrationService.js";
import type { ExecutionOrchestrationService } from "../../orchestrations/direction/executions/ExecutionOrchestrationService.js";
import type { PerimeterPolicy } from "../../../models/coordinations/directions/PerimeterPolicy.js";
import { createAgentContext, type AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { EffectClaim } from "../../../models/orchestrations/effects/EffectClaim.js";
import { DirectionCoordinationService } from "./DirectionCoordinationService.js";

export interface PerimeterOrchestrationServiceMock {
  readonly authorize: Mock;
  readonly claim: Mock;
  readonly requestApproval: Mock;
  readonly recordOutcome: Mock;
  readonly recordFailure: Mock;
  readonly releaseClaim: Mock;
}

export interface ExecutionOrchestrationServiceMock {
  readonly handlesLocally: Mock;
  readonly run: Mock;
  readonly return: Mock;
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

export function createDirectionCoordinationServiceTests(policy: Partial<PerimeterPolicy> = {}): {
  perimeterOrchestrationServiceMock: PerimeterOrchestrationServiceMock;
  executionOrchestrationServiceMock: ExecutionOrchestrationServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  directionCoordinationService: DirectionCoordinationService;
} {
  const perimeterOrchestrationServiceMock: PerimeterOrchestrationServiceMock = { authorize: vi.fn(), claim: vi.fn(), requestApproval: vi.fn(), recordOutcome: vi.fn(), recordFailure: vi.fn(), releaseClaim: vi.fn() };
  const executionOrchestrationServiceMock: ExecutionOrchestrationServiceMock = { handlesLocally: vi.fn(), run: vi.fn(), return: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const directionCoordinationService = new DirectionCoordinationService(
    perimeterOrchestrationServiceMock as unknown as PerimeterOrchestrationService,
    executionOrchestrationServiceMock as unknown as ExecutionOrchestrationService,
    loggingBrokerMock as unknown as LoggingBroker,
    policy,
  );

  return { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function toolContext(toolName = createRandomString(), payload = createRandomString()): AgentContext {
  return { ...createAgentContext(createRandomString()), intent: toolName, directionType: toolName, payload, observations: [createRandomString()] };
}

export function proceed(): EffectClaim {
  return { verdict: "Proceed", outcome: null, record: null };
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
