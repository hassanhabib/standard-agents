import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { EffectLedgerBroker } from "../../../brokers/effects/EffectLedgerBroker.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import type { EffectRecord } from "../../../models/brokers/effects/EffectRecord.js";
import { createAgentEffect, type AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import { EffectLedgerService } from "./EffectLedgerService.js";

export interface EffectLedgerBrokerMock {
  readonly insertClaim: Mock;
  readonly selectRecord: Mock;
  readonly updateRecord: Mock;
  readonly deleteRecord: Mock;
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

export function createEffectLedgerServiceTests(currentDateTime: Date = new Date()): {
  effectLedgerBrokerMock: EffectLedgerBrokerMock;
  loggingBrokerMock: LoggingBrokerMock;
  effectLedgerService: EffectLedgerService;
} {
  const effectLedgerBrokerMock: EffectLedgerBrokerMock = { insertClaim: vi.fn(), selectRecord: vi.fn(), updateRecord: vi.fn(), deleteRecord: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const effectLedgerService = new EffectLedgerService(
    effectLedgerBrokerMock as unknown as EffectLedgerBroker,
    { getCurrentDateTime: () => currentDateTime } as TimeBroker,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { effectLedgerBrokerMock, loggingBrokerMock, effectLedgerService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomEffect(): AgentEffect {
  return createAgentEffect(createRandomString(), createRandomString(), createRandomString(), "Irreversible", true);
}

export function createRandomRecord(claimedOn: Date = new Date()): EffectRecord {
  return {
    idempotencyKey: createRandomString(),
    toolName: createRandomString(),
    state: "InFlight",
    owner: createRandomString(),
    claimedOn,
    leaseUntil: new Date(claimedOn.getTime() + 60_000),
    outcome: null,
    detail: null,
    recordedOn: null,
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
