import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { RetrievalOrchestrationService } from "../../orchestrations/data/retrievals/RetrievalOrchestrationService.js";
import type { RecollectionOrchestrationService } from "../../orchestrations/data/recollections/RecollectionOrchestrationService.js";
import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { createAgentContext, type AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { DataCoordinationService } from "./DataCoordinationService.js";

export interface RetrievalOrchestrationServiceMock {
  readonly retrieveInstructions: Mock;
  readonly retrieveGrounding: Mock;
  readonly retrieveRemoteTools: Mock;
}

export interface RecollectionOrchestrationServiceMock {
  readonly recallMemories: Mock;
  readonly remember: Mock;
  readonly recallSession: Mock;
  readonly recordSession: Mock;
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

export function createDataCoordinationServiceTests(): {
  retrievalOrchestrationServiceMock: RetrievalOrchestrationServiceMock;
  recollectionOrchestrationServiceMock: RecollectionOrchestrationServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  dataCoordinationService: DataCoordinationService;
} {
  const retrievalOrchestrationServiceMock: RetrievalOrchestrationServiceMock = { retrieveInstructions: vi.fn(), retrieveGrounding: vi.fn(), retrieveRemoteTools: vi.fn() };
  const recollectionOrchestrationServiceMock: RecollectionOrchestrationServiceMock = { recallMemories: vi.fn(), remember: vi.fn(), recallSession: vi.fn(), recordSession: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const dataCoordinationService = new DataCoordinationService(
    retrievalOrchestrationServiceMock as unknown as RetrievalOrchestrationService,
    recollectionOrchestrationServiceMock as unknown as RecollectionOrchestrationService,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { retrievalOrchestrationServiceMock, recollectionOrchestrationServiceMock, loggingBrokerMock, dataCoordinationService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomContext(): AgentContext {
  return { ...createAgentContext(createRandomString()), route: createRandomString(), observations: [createRandomString()] };
}

export function createRandomSession(): AgentSession {
  return {
    id: createRandomString(),
    history: [],
    status: "Responded",
    pendingQuestion: "",
    pendingEffect: null,
    runId: createRandomString(),
    owner: createRandomString(),
    version: 1,
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
