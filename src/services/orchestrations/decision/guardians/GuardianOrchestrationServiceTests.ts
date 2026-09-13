import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { GateService } from "../../../foundations/gates/GateService.js";
import type { JudgeService } from "../../../foundations/judges/JudgeService.js";
import type { ContractService } from "../../../foundations/contracts/ContractService.js";

import { GuardianOrchestrationService } from "./GuardianOrchestrationService.js";

export interface GateServiceMock {
  readonly screen: Mock;
  readonly detectConflict: Mock;
}

export interface JudgeServiceMock {
  readonly evaluate: Mock;
}

export interface ContractServiceMock {
  readonly check: Mock;
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

export function createGuardianOrchestrationServiceTests(): {
  gateServiceMock: GateServiceMock;
  judgeServiceMock: JudgeServiceMock;
  contractServiceMock: ContractServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  guardianOrchestrationService: GuardianOrchestrationService;
} {
  const gateServiceMock: GateServiceMock = { screen: vi.fn(), detectConflict: vi.fn() };
  const judgeServiceMock: JudgeServiceMock = { evaluate: vi.fn() };
  const contractServiceMock: ContractServiceMock = { check: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const guardianOrchestrationService = new GuardianOrchestrationService(
    gateServiceMock as unknown as GateService,
    judgeServiceMock as unknown as JudgeService,
    contractServiceMock as unknown as ContractService,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { gateServiceMock, judgeServiceMock, contractServiceMock, loggingBrokerMock, guardianOrchestrationService };
}

export function createRandomString(): string {
  return randomUUID();
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
