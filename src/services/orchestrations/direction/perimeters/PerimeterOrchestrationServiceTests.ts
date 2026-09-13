import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { PolicyService } from "../../../foundations/policies/PolicyService.js";
import type { ApprovalService } from "../../../foundations/approvals/ApprovalService.js";
import type { EffectLedgerService } from "../../../foundations/effects/EffectLedgerService.js";
import type { TimeBroker } from "../../../../brokers/times/TimeBroker.js";
import type { EffectRecord } from "../../../../models/brokers/effects/EffectRecord.js";
import { createAgentEffect, type AgentEffect } from "../../../../models/orchestrations/effects/AgentEffect.js";
import { PerimeterOrchestrationService } from "./PerimeterOrchestrationService.js";

export interface PolicyServiceMock {
  readonly authorize: Mock;
  readonly mentions: Mock;
}

export interface ApprovalServiceMock {
  readonly requestApproval: Mock;
}

export interface EffectLedgerServiceMock {
  readonly claim: Mock;
  readonly retrieveRecord: Mock;
  readonly recordOutcome: Mock;
  readonly recordFailure: Mock;
  readonly releaseClaim: Mock;
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

export function createPerimeterOrchestrationServiceTests(currentDateTime: Date = new Date()): {
  policyServiceMock: PolicyServiceMock;
  approvalServiceMock: ApprovalServiceMock;
  effectLedgerServiceMock: EffectLedgerServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  perimeterOrchestrationService: PerimeterOrchestrationService;
} {
  const policyServiceMock: PolicyServiceMock = { authorize: vi.fn(), mentions: vi.fn() };
  const approvalServiceMock: ApprovalServiceMock = { requestApproval: vi.fn() };
  const effectLedgerServiceMock: EffectLedgerServiceMock = { claim: vi.fn(), retrieveRecord: vi.fn(), recordOutcome: vi.fn(), recordFailure: vi.fn(), releaseClaim: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const perimeterOrchestrationService = new PerimeterOrchestrationService(
    policyServiceMock as unknown as PolicyService,
    approvalServiceMock as unknown as ApprovalService,
    effectLedgerServiceMock as unknown as EffectLedgerService,
    { getCurrentDateTime: () => currentDateTime } as TimeBroker,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { policyServiceMock, approvalServiceMock, effectLedgerServiceMock, loggingBrokerMock, perimeterOrchestrationService };
}

export function createRandomString(): string {
  return randomUUID();
}

export const DEFAULT_LEASE_MILLISECONDS = 300_000;

export function createRandomEffect(): AgentEffect {
  return createAgentEffect(createRandomString(), createRandomString(), createRandomString(), "Irreversible", true);
}

export function createRandomRecord(overrides: Partial<EffectRecord> = {}): EffectRecord {
  const claimedOn = new Date();

  return {
    idempotencyKey: createRandomString(),
    toolName: createRandomString(),
    state: "InFlight",
    owner: createRandomString(),
    claimedOn,
    leaseUntil: new Date(claimedOn.getTime() + DEFAULT_LEASE_MILLISECONDS),
    outcome: null,
    detail: null,
    recordedOn: null,
    ...overrides,
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
