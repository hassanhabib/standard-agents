import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { SkillBroker } from "../../../brokers/skills/SkillBroker.js";
import type { Skill } from "../../../models/foundations/skills/Skill.js";
import { SkillService } from "./SkillService.js";

// The setup and helpers every SkillService test file shares: the broker doubles, the service
// under test, random data, and the two assertions The Standard's tests end with.

export interface SkillBrokerMock {
  readonly selectSkills: Mock<() => Promise<readonly Skill[]>>;
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

export function createSkillServiceTests(): {
  skillBrokerMock: SkillBrokerMock;
  loggingBrokerMock: LoggingBrokerMock;
  skillService: SkillService;
} {
  const skillBrokerMock: SkillBrokerMock = { selectSkills: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const skillService = new SkillService(
    skillBrokerMock as unknown as SkillBroker,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { skillBrokerMock, loggingBrokerMock, skillService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomSkill(name: string): Skill {
  return { name, description: "", content: createRandomString() };
}

export function createErrnoException(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`${code}: ${createRandomString()}`);
  error.code = code;

  return error;
}

interface ExceptionShape {
  readonly name: string;
  readonly message: string;
  readonly innerError?: Error;
  readonly data?: Map<string, string[]>;
}

// The Standard's SameExceptionAs: name, message and data must match at every level of the inner
// chain, so a category with the wrong local exception beneath it does not pass.
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

// VerifyNoOtherCalls: every mocked method was called exactly as many times as the test named, and
// every method the test did not name was never called.
export function verifyNoOtherCalls(mock: object, expectedCalls: Readonly<Record<string, number>> = {}): void {
  for (const [name, member] of Object.entries(mock)) {
    const mocked = member as Mock;
    expect(mocked.mock.calls.length, `${name} call count`).toBe(expectedCalls[name] ?? 0);
  }
}
