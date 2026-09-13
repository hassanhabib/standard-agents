import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { InferenceOrchestrationService } from "../../orchestrations/decision/inferences/InferenceOrchestrationService.js";
import type { GuardianOrchestrationService } from "../../orchestrations/decision/guardians/GuardianOrchestrationService.js";
import { UNCONSTRAINED } from "../../../models/foundations/contracts/ContractVerdict.js";
import { createAgentContext, type AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { DecisionCoordinationService } from "./DecisionCoordinationService.js";

export interface InferenceOrchestrationServiceMock {
  readonly decide: Mock;
  readonly decideStream: Mock;
}

export interface GuardianOrchestrationServiceMock {
  readonly screen: Mock;
  readonly detectConflict: Mock;
  readonly evaluate: Mock;
  readonly checkShape: Mock;
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

export function createDecisionCoordinationServiceTests(contractSchema = ""): {
  inferenceOrchestrationServiceMock: InferenceOrchestrationServiceMock;
  guardianOrchestrationServiceMock: GuardianOrchestrationServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  decisionCoordinationService: DecisionCoordinationService;
} {
  const inferenceOrchestrationServiceMock: InferenceOrchestrationServiceMock = { decide: vi.fn(), decideStream: vi.fn() };
  const guardianOrchestrationServiceMock: GuardianOrchestrationServiceMock = { screen: vi.fn(), detectConflict: vi.fn(), evaluate: vi.fn(), checkShape: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const decisionCoordinationService = new DecisionCoordinationService(
    inferenceOrchestrationServiceMock as unknown as InferenceOrchestrationService,
    guardianOrchestrationServiceMock as unknown as GuardianOrchestrationService,
    loggingBrokerMock as unknown as LoggingBroker,
    contractSchema,
  );

  return { inferenceOrchestrationServiceMock, guardianOrchestrationServiceMock, loggingBrokerMock, decisionCoordinationService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomContext(): AgentContext {
  return { ...createAgentContext(createRandomString()), systemPrompt: createRandomString() };
}

export function decidedAnswer(context: AgentContext, answer: string): AgentContext {
  return { ...context, intent: "Respond", directionType: "ReturnResponse", payload: answer, rawReply: `FINAL: ${answer}` };
}

export function decidedTool(context: AgentContext, toolName: string, payload: string): AgentContext {
  return { ...context, intent: toolName, directionType: toolName, payload, rawReply: `ACTION: ${toolName}: ${payload}` };
}

export function allowingGuardians(mocks: { screen: { mockResolvedValue(value: string): unknown }; detectConflict: { mockResolvedValue(value: string): unknown }; evaluate: { mockResolvedValue(value: { score: number; reason: string }): unknown }; checkShape: { mockResolvedValue(value: typeof UNCONSTRAINED): unknown } }): void {
  mocks.screen.mockResolvedValue("allow");
  mocks.detectConflict.mockResolvedValue("NONE");
  mocks.evaluate.mockResolvedValue({ score: 1, reason: "" });
  mocks.checkShape.mockResolvedValue(UNCONSTRAINED);
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
