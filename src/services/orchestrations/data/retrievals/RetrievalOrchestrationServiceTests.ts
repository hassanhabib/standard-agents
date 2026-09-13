import { randomUUID } from "node:crypto";

import { expect, vi, type Mock } from "vitest";

import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { SkillService } from "../../../foundations/skills/SkillService.js";
import type { KnowledgeService } from "../../../foundations/knowledges/KnowledgeService.js";
import type { ExternalToolService } from "../../../foundations/externalTools/ExternalToolService.js";
import type { McpTool } from "../../../../models/brokers/mcps/McpTool.js";
import { RetrievalOrchestrationService } from "./RetrievalOrchestrationService.js";

export interface SkillServiceMock {
  readonly retrieveSkills: Mock;
  readonly retrieveSkillCatalog: Mock;
}

export interface KnowledgeServiceMock {
  readonly retrieve: Mock;
}

export interface ExternalToolServiceMock {
  readonly call: Mock;
  readonly retrieveTools: Mock;
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

export function createRetrievalOrchestrationServiceTests(toolCatalog = "", toolCatalogEntries: ReadonlyMap<string, string> | null = null): {
  skillServiceMock: SkillServiceMock;
  knowledgeServiceMock: KnowledgeServiceMock;
  externalToolServiceMock: ExternalToolServiceMock;
  loggingBrokerMock: LoggingBrokerMock;
  retrievalOrchestrationService: RetrievalOrchestrationService;
} {
  const skillServiceMock: SkillServiceMock = { retrieveSkills: vi.fn(), retrieveSkillCatalog: vi.fn() };
  const knowledgeServiceMock: KnowledgeServiceMock = { retrieve: vi.fn() };
  const externalToolServiceMock: ExternalToolServiceMock = { call: vi.fn(), retrieveTools: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const retrievalOrchestrationService = new RetrievalOrchestrationService(
    skillServiceMock as unknown as SkillService,
    knowledgeServiceMock as unknown as KnowledgeService,
    externalToolServiceMock as unknown as ExternalToolService,
    loggingBrokerMock as unknown as LoggingBroker,
    toolCatalog,
    toolCatalogEntries,
  );

  return { skillServiceMock, knowledgeServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService };
}

export function createRandomString(): string {
  return randomUUID();
}

export function createRandomTool(description = createRandomString()): McpTool {
  return { name: createRandomString(), description, inputSchemaJson: "{}" };
}

export function catalogLine(tool: McpTool): string {
  return `- ${tool.name}: ${tool.description} parameters: ${tool.inputSchemaJson}`;
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
