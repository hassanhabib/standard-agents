import { randomUUID } from "node:crypto";
import { basename, dirname } from "node:path";

import { expect, vi, type Mock } from "vitest";

import type { FileBroker } from "../../../brokers/files/FileBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { FileStat } from "../../../models/brokers/files/FileStat.js";
import type { KnowledgeFolder } from "../../../models/foundations/knowledges/KnowledgeFolder.js";
import type { KnowledgeBroker } from "../../../brokers/knowledges/KnowledgeBroker.js";
import type { SourcedKnowledgeBroker } from "../../../brokers/knowledges/SourcedKnowledgeBroker.js";

import { KnowledgeService } from "./KnowledgeService.js";

export interface KnowledgeBrokerMock {
  readonly selectKnowledge: Mock;
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

export function createKnowledgeServiceTests(): {
  knowledgeBrokerMock: KnowledgeBrokerMock;
  loggingBrokerMock: LoggingBrokerMock;
  knowledgeService: KnowledgeService;
} {
  const knowledgeBrokerMock: KnowledgeBrokerMock = { selectKnowledge: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const knowledgeService = new KnowledgeService(
    knowledgeBrokerMock as unknown as KnowledgeBroker,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { knowledgeBrokerMock, loggingBrokerMock, knowledgeService };
}

export interface SourcedKnowledgeBrokerMock {
  readonly selectSourcedKnowledge: Mock;
}

export function createSourcedKnowledgeServiceTests(): {
  sourcedKnowledgeBrokerMock: SourcedKnowledgeBrokerMock;
  loggingBrokerMock: LoggingBrokerMock;
  knowledgeService: KnowledgeService;
} {
  const sourcedKnowledgeBrokerMock: SourcedKnowledgeBrokerMock = { selectSourcedKnowledge: vi.fn() };
  const loggingBrokerMock = createLoggingBrokerMock();

  const knowledgeService = new KnowledgeService(
    sourcedKnowledgeBrokerMock as unknown as SourcedKnowledgeBroker,
    loggingBrokerMock as unknown as LoggingBroker,
  );

  return { sourcedKnowledgeBrokerMock, loggingBrokerMock, knowledgeService };
}

export interface FileBrokerMock {
  readonly readFile: Mock<(path: string) => Promise<string>>;
  readonly writeFile: Mock;
  readonly writeFileAtomic: Mock;
  readonly rename: Mock;
  readonly unlink: Mock;
  readonly stat: Mock<(path: string) => Promise<FileStat | null>>;
  readonly readdir: Mock<(path: string) => Promise<readonly string[]>>;
  readonly openExclusive: Mock;
  readonly realpath: Mock;
  readonly fsync: Mock;
}

// A file system held in memory: every path a folder and its entries, or a document and its text.
// The broker's primitives answer from it, so the folder walk, the pattern and the ordering under
// test are the service's own.
export function createFileBrokerMock(documents: Readonly<Record<string, string>>, folders: readonly string[]): FileBrokerMock {
  const folderSet = new Set(folders);

  return {
    readFile: vi.fn(async (path: string) => documents[path] ?? ""),
    writeFile: vi.fn(),
    writeFileAtomic: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(async (path: string) => {
      if (folderSet.has(path)) {
        return { size: 0, modifiedOn: new Date(0), isDirectory: true };
      }

      return path in documents ? { size: documents[path]?.length ?? 0, modifiedOn: new Date(0), isDirectory: false } : null;
    }),
    readdir: vi.fn(async (path: string) =>
      [...folderSet, ...Object.keys(documents)]
        .filter((entry) => dirname(entry) === path && entry !== path)
        .map((entry) => basename(entry))),
    openExclusive: vi.fn(),
    realpath: vi.fn(),
    fsync: vi.fn(),
  };
}

export function createFolderKnowledgeServiceTests(
  knowledgeFolder: KnowledgeFolder,
  documents: Readonly<Record<string, string>>,
  folders: readonly string[],
): {
  fileBrokerMock: FileBrokerMock;
  loggingBrokerMock: LoggingBrokerMock;
  knowledgeService: KnowledgeService;
} {
  const fileBrokerMock = createFileBrokerMock(documents, folders);
  const loggingBrokerMock = createLoggingBrokerMock();

  const knowledgeService = new KnowledgeService(
    fileBrokerMock as unknown as FileBroker,
    loggingBrokerMock as unknown as LoggingBroker,
    knowledgeFolder,
  );

  return { fileBrokerMock, loggingBrokerMock, knowledgeService };
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

export function createErrnoException(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`${code}: ${createRandomString()}`);
  error.code = code;

  return error;
}
