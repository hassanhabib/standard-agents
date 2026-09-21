import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { DataCoordinationService } from "../../coordinations/data/DataCoordinationService.js";
import type { DecisionCoordinationService } from "../../coordinations/decision/DecisionCoordinationService.js";
import type { DirectionCoordinationService } from "../../coordinations/direction/DirectionCoordinationService.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import type { AgentStreamEvent } from "../../../models/clients/agents/AgentStreamEvent.js";
import { createRunOptions, type RunOptions } from "../../../models/managements/runs/RunOptions.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { RunManagementService } from "./RunManagementService.js";

export interface DataCoordinationServiceMock {
  readonly recall: Mock;
  readonly remember: Mock;
  readonly recallSession: Mock;
  readonly recordSession: Mock;
  readonly retrieveRemoteTools: Mock;
}

export interface DecisionCoordinationServiceMock {
  readonly think: Mock;
  readonly thinkStream: Mock;
  readonly screen: Mock;
}

export interface DirectionCoordinationServiceMock {
  readonly act: Mock;
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

export function createRunManagementServiceTests(options: Partial<RunOptions> = {}, clock: { now: Date } = { now: new Date() }): {
  dataCoordinationServiceMock: DataCoordinationServiceMock;
  decisionCoordinationServiceMock: DecisionCoordinationServiceMock;
  directionCoordinationServiceMock: DirectionCoordinationServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  runManagementService: RunManagementService;
} {
  const dataCoordinationServiceMock: DataCoordinationServiceMock = { recall: vi.fn(), remember: vi.fn(), recallSession: vi.fn(), recordSession: vi.fn(), retrieveRemoteTools: vi.fn() };
  const decisionCoordinationServiceMock: DecisionCoordinationServiceMock = { think: vi.fn(), thinkStream: vi.fn(), screen: vi.fn() };
  const directionCoordinationServiceMock: DirectionCoordinationServiceMock = { act: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const runManagementService = new RunManagementService(
    dataCoordinationServiceMock as unknown as DataCoordinationService,
    decisionCoordinationServiceMock as unknown as DecisionCoordinationService,
    directionCoordinationServiceMock as unknown as DirectionCoordinationService,
    { getCurrentDateTime: () => clock.now } as TimeBroker,
    loggingBrokerMock as unknown as LoggingBroker,
    createRunOptions(options),
  );

  return { dataCoordinationServiceMock, decisionCoordinationServiceMock, directionCoordinationServiceMock, loggingBrokerMock, runManagementService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function recalled(context: AgentContext): AgentContext {
  return { ...context, systemPrompt: createRandomString() };
}

export function thoughtAnswer(context: AgentContext, answer: string): AgentContext {
  return { ...context, intent: "Respond", directionType: "ReturnResponse", payload: answer, rawReply: `FINAL: ${answer}`, narration: "", status: "Working", promptTokens: 3, completionTokens: 2, usageIsEstimated: true };
}

export function thoughtTool(context: AgentContext, toolName: string, payload: string): AgentContext {
  return { ...context, intent: toolName, directionType: toolName, payload, rawReply: `ACTION: ${toolName}: ${payload}`, narration: "", status: "Working", promptTokens: 3, completionTokens: 2, usageIsEstimated: true };
}

export function actedResponse(context: AgentContext): AgentContext {
  return { ...context, result: context.payload, status: "Responded" };
}

// The same call answered from the ledger rather than performed, the way the direction coordination
// records a replay: the exchange says so, because a loop counting a run's asks has to tell a
// replay from a call that ran.
export function actedReplay(context: AgentContext, output: string): AgentContext {
  const acted = actedTool(context, output);
  const last = acted.toolExchanges.at(-1);

  return last === undefined ? acted : { ...acted, toolExchanges: [...acted.toolExchanges.slice(0, -1), { ...last, replayed: true }] };
}

export function actedTool(context: AgentContext, output: string): AgentContext {
  return {
    ...context,
    result: output,
    observations: [...context.observations, `${context.directionType}: ${output}`],

    // The call and its answer, the way the direction coordination records them. A fake that
    // observed the output and kept no exchange could not model a turn that did work at all: every
    // turn it produced looked, from the outside, exactly like a turn that answered from memory.
    toolExchanges: [
      ...context.toolExchanges,
      { callId: `call-${String(context.toolExchanges.length + 1)}`, toolName: context.directionType, argumentsJson: context.payload, result: output },
    ],
    status: "Working",
  };
}

export function createRandomSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: createRandomString(),
    history: [{ prompt: createRandomString(), answer: createRandomString(), exchanges: [] }],
    status: "Responded",
    pendingQuestion: "",
    pendingEffect: null,
    runId: createRandomString(),
    owner: "",
    version: 1,
    ...overrides,
  };
}

export function collectEvents(): { events: AgentStreamEvent[]; emit: (event: AgentStreamEvent) => Promise<void> } {
  const events: AgentStreamEvent[] = [];

  return { events, emit: async (event) => { events.push(event); } };
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
