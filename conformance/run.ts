// The conformance runner (PLAN.md 4.9, CONFORMANCE.md). It reads the JSON vectors and the
// readiness profiles from the pinned reference checkout, drives each vector through the real
// engine with a scripted Brain and stub internal tools, asserts the expectation fields, and exits
// non-zero on any failure. A profile is claimable only when every vector it requires passes.
//
// Two rules the reference harness follows, followed here: every double replaces a broker, never
// a service, so the whole tree under test is the real library; and the agent is observed through
// its real seams, the outcome and the tools' own records, never off to the side.
//
// Sprint 1 wired the Core fields; SPEC v1.14 added what a tool declares about itself, the
// repetition bound, and how a run ended; SPEC v1.15 added the streamed door and what a run spent,
// read off the stream as it went; SPEC v1.17's remote tool servers arrived with several at once,
// with selection over what they offer. A vector carrying a setup or expectation field this
// runner does not yet honor fails as unsupported, so a profile is never claimed on a vector
// half-run.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  StandardAgent,
  type AgentOutcome,
  type AgentStreamEvent,
  type GeneratorBroker,
  type McpBroker,
  type McpTool,
  type RiskLevel,
  type Tool,
} from "@hassanhabib/standard-agents";

interface Vector {
  readonly name: string;
  readonly description: string;
  readonly file: string;
  readonly generatorReplies: readonly string[];
  readonly tools?: Readonly<Record<string, string>>;
  readonly prompt: string;
  readonly expect: Readonly<Record<string, unknown>>;
  readonly maxTurns?: number;
  readonly toolDescriptions?: Readonly<Record<string, string>>;
  readonly toolRisk?: Readonly<Record<string, RiskLevel>>;
  readonly toolScopeFirstWord?: readonly string[];
  readonly identicalCallLimit?: number;
  readonly request?: Readonly<Record<string, unknown>>;
  readonly streamed?: boolean;
  readonly mcpServers?: readonly Readonly<Record<string, string>>[];
  readonly mcpToolSchemas?: Readonly<Record<string, string>>;
  readonly extraSkills?: readonly string[];
  readonly selectTools?: readonly string[];
  readonly enforceSelection?: boolean;
}

interface ScriptedMcpServer extends McpBroker {
  readonly callCount: () => number;
}

interface ScriptedGenerator extends GeneratorBroker {
  readonly inputs: string[];
}

interface Profile {
  readonly name: string;
  readonly inherits?: string;
  readonly requires: readonly string[];
}

interface VectorResult {
  readonly vector: Vector;
  readonly passed: boolean;
  readonly detail: string;
}

interface StubTool extends Tool {
  readonly inputs: string[];
}

const SUPPORTED_SETUP_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "description",
  "file",
  "generatorReplies",
  "tools",
  "prompt",
  "expect",
  "maxTurns",
  "toolDescriptions",
  "toolRisk",
  "toolScopeFirstWord",
  "identicalCallLimit",
  "request",
  "streamed",
  "mcpServers",
  "mcpToolSchemas",
  "extraSkills",
  "selectTools",
  "enforceSelection",
]);

const SUPPORTED_EXPECTATIONS: ReadonlySet<string> = new Set([
  "result",
  "resultContains",
  "toolInput",
  "toolRunCount",
  "toolNeverRan",
  "status",
  "failureCode",
  "brainSees",
  "usageEvents",
  "usageEstimated",
  "brainNeverSees",
  "mcpServerCalls",
]);

const referenceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "reference", "conformance");

async function readJsonFiles<T>(folder: string): Promise<Array<T & { file: string }>> {
  const names = (await readdir(folder)).filter((name) => name.endsWith(".json")).sort();
  const files: Array<T & { file: string }> = [];

  for (const name of names) {
    const content = await readFile(join(folder, name), "utf8");
    files.push({ ...(JSON.parse(content) as T), file: name });
  }

  return files;
}

// The scripted Brain (CONFORMANCE.md, runner contract 1): the replies in order, repeating the
// last when exhausted, so a single non-terminal reply exercises the turn cap. What it was handed
// is kept, so what reached the Brain is observed at the Brain rather than inferred.
function createScriptedGenerator(replies: readonly string[]): ScriptedGenerator {
  const inputs: string[] = [];
  let index = 0;

  return {
    honorsRequest: true,
    inputs,
    generate: async (systemPrompt: string, userPrompt: string) => {
      inputs.push(`${systemPrompt}\n${userPrompt}`);
      const reply = replies[Math.min(index, replies.length - 1)] ?? "";
      index += 1;

      return reply;
    },
  };
}

// Stub internal tools (runner contract 2): each returns its fixed output and records what it was
// called with. A description is the advertisement opt-in, given only when the vector says so. A
// tool declares its own risk, and names what it touches as the first word of its input when the
// vector says so, which is what makes a look after a write observable (SPEC.md 4.9).
function createStubTool(name: string, output: string, vector: Vector): StubTool {
  const inputs: string[] = [];
  const risk = vector.toolRisk?.[name];
  const scopeIsFirstWord = vector.toolScopeFirstWord?.includes(name) === true;

  return {
    name,
    description: vector.toolDescriptions?.[name] ?? "",
    inputs,
    ...(risk === undefined ? {} : { risk }),
    ...(scopeIsFirstWord ? { scopeOf: (input: string): string => input.split(" ")[0] ?? "" } : {}),
    execute: async (input: string) => {
      inputs.push(input);

      return output;
    },
  };
}

// A remote tool server, scripted (runner contract 4): its catalog is the tools the vector gave it,
// every one described, a declared schema where the vector gives one and an open object where it
// does not, and every call counted - routing across servers is certified by the owner being
// called and the bystander not (SPEC.md 4.8).
function createScriptedMcpServer(catalog: Readonly<Record<string, string>>, vector: Vector): ScriptedMcpServer {
  let calls = 0;

  return {
    callCount: () => calls,
    call: async (name: string) => {
      calls += 1;

      return catalog[name] ?? `[external '${name}' not configured]`;
    },
    listTools: async (): Promise<readonly McpTool[]> =>
      Object.keys(catalog).map((name) => ({
        name,
        description: `scripted tool ${name}`,
        inputSchemaJson: vector.mcpToolSchemas?.[name] ?? "{}",
      })),
  };
}

// A request with nothing in it only says "read the outcome", which is the one door this runner
// drives. A request that carries inference options is not honored yet, so it is unsupported.
function unsupportedFields(vector: Vector): string[] {
  const setup = Object.keys(vector).filter((key) => !SUPPORTED_SETUP_FIELDS.has(key));
  const expectations = Object.keys(vector.expect).filter((key) => !SUPPORTED_EXPECTATIONS.has(key));
  const request = vector.request === undefined ? [] : Object.keys(vector.request).map((key) => `request.${key}`);

  return [...setup, ...request, ...expectations.map((key) => `expect.${key}`)];
}

function assertExpectations(
  vector: Vector,
  outcome: AgentOutcome,
  tools: readonly StubTool[],
  brainInputs: readonly string[],
  events: readonly AgentStreamEvent[],
  mcpServers: readonly ScriptedMcpServer[],
): string[] {
  const failures: string[] = [...usageFailures(vector, events)];
  const expected = vector.expect;
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

  if (typeof expected["status"] === "string" && outcome.status !== expected["status"]) {
    failures.push(`status: expected ${expected["status"]}, got ${outcome.status}`);
  }

  if (typeof expected["failureCode"] === "string" && outcome.failure?.code !== expected["failureCode"]) {
    failures.push(`failureCode: expected ${expected["failureCode"]}, got ${outcome.failure?.code ?? "none"}`);
  }

  if (typeof expected["brainSees"] === "string" && !brainInputs.some((input) => input.includes(String(expected["brainSees"])))) {
    failures.push(`brainSees: the Brain was never shown ${JSON.stringify(expected["brainSees"])}`);
  }

  if (typeof expected["brainNeverSees"] === "string" && brainInputs.some((input) => input.includes(String(expected["brainNeverSees"])))) {
    failures.push(`brainNeverSees: the Brain was shown text that should have been withheld: ${JSON.stringify(expected["brainNeverSees"])}`);
  }

  const mcpServerCalls = expected["mcpServerCalls"];

  if (Array.isArray(mcpServerCalls)) {
    const actualCalls = mcpServers.map((server) => server.callCount());

    if (JSON.stringify(actualCalls) !== JSON.stringify(mcpServerCalls)) {
      failures.push(`mcpServerCalls: server calls were ${JSON.stringify(actualCalls)}, expected ${JSON.stringify(mcpServerCalls)}`);
    }
  }

  if (typeof expected["result"] === "string" && outcome.result !== expected["result"]) {
    failures.push(`result: expected ${JSON.stringify(expected["result"])}, got ${JSON.stringify(outcome.result)}`);
  }

  if (typeof expected["resultContains"] === "string" && !outcome.result.includes(expected["resultContains"])) {
    failures.push(`resultContains: expected to contain ${JSON.stringify(expected["resultContains"])}, got ${JSON.stringify(outcome.result)}`);
  }

  const toolInput = expected["toolInput"];

  if (typeof toolInput === "object" && toolInput !== null) {
    for (const [toolName, input] of Object.entries(toolInput as Record<string, unknown>)) {
      const inputs = toolByName.get(toolName)?.inputs ?? [];

      if (!inputs.includes(String(input))) {
        failures.push(`toolInput: expected '${toolName}' to be called with ${JSON.stringify(input)}, got ${JSON.stringify(inputs)}`);
      }
    }
  }

  const toolRunCount = expected["toolRunCount"];

  if (typeof toolRunCount === "object" && toolRunCount !== null) {
    for (const [toolName, count] of Object.entries(toolRunCount as Record<string, unknown>)) {
      const actual = toolByName.get(toolName)?.inputs.length ?? 0;

      if (actual !== Number(count)) {
        failures.push(`toolRunCount: expected '${toolName}' to run ${String(count)} time(s), ran ${actual}`);
      }
    }
  }

  const toolNeverRan = expected["toolNeverRan"];

  if (Array.isArray(toolNeverRan)) {
    for (const toolName of toolNeverRan) {
      const actual = toolByName.get(String(toolName))?.inputs.length ?? 0;

      if (actual > 0) {
        failures.push(`toolNeverRan: '${String(toolName)}' ran ${actual} time(s)`);
      }
    }
  }

  return failures;
}

// Usage as it is spent, read from the streamed events themselves (SPEC.md 4.14.1): one event per
// model call, each carrying the run's total so far as a record and as its text, a total that grows
// with every call, and marked estimated when nobody reported it.
//
// Not the numbers themselves. Every implementation counts in its own way where the provider says
// nothing, so a vector that pinned a figure would certify a tokenizer rather than the stream.
function usageFailures(vector: Vector, events: readonly AgentStreamEvent[]): string[] {
  const expectedCount = vector.expect["usageEvents"];
  const expectedEstimate = vector.expect["usageEstimated"];

  if (expectedCount === undefined && expectedEstimate === undefined) {
    return [];
  }

  if (vector.streamed !== true) {
    return ["usage expectations require \"streamed\": true; the batched door produces and discards its events"];
  }

  const usages = events.filter((event) => event.type === "Usage");

  if (typeof expectedCount === "number" && usages.length !== expectedCount) {
    return [`usageEvents: the stream carried ${String(usages.length)} Usage event(s), expected ${String(expectedCount)}, one after every model call`];
  }

  let previousTotal = 0;

  for (const usage of usages) {
    if (usage.usage === undefined) {
      return [`usage: a Usage event carried no record; its text was ${JSON.stringify(usage.content)}`];
    }

    const total = usage.usage.promptTokens + usage.usage.completionTokens;

    if (usage.content !== String(total)) {
      return [`usage: a Usage event's text was ${JSON.stringify(usage.content)} while its record totals ${String(total)}`];
    }

    if (total <= previousTotal) {
      return [`usage: the running total went from ${String(previousTotal)} to ${String(total)}; every model call spends something, so the total grows`];
    }

    previousTotal = total;
  }

  const last = usages.at(-1);

  if (typeof expectedEstimate === "boolean" && last !== undefined && last.usage?.isEstimated !== expectedEstimate) {
    return [`usageEstimated: the last Usage event said estimated=${String(last.usage?.isEstimated)}, expected ${String(expectedEstimate)}`];
  }

  return [];
}

async function runVector(vector: Vector): Promise<VectorResult> {
  const unsupported = unsupportedFields(vector);

  if (unsupported.length > 0) {
    return { vector, passed: false, detail: `unsupported field(s) in this runner: ${unsupported.join(", ")}` };
  }

  const tools = Object.entries(vector.tools ?? {}).map(([name, output]) => createStubTool(name, output, vector));
  const generator = createScriptedGenerator(vector.generatorReplies);

  // Runner contract 3: Skill returns any text; Memory, Knowledge and the remote servers stay not
  // configured; the Gate allows and the Judge scores 1 because nothing configured them; the log
  // is silent. Nothing below the client is replaced.
  const agent = new StandardAgent()
    .useGenerator(generator)
    .onSkills(async () => [{ name: "test-agent", description: "", content: "You are a test agent." }])
    .tools(tools);

  if (vector.maxTurns !== undefined) {
    agent.maxTurns(vector.maxTurns);
  }

  if (vector.identicalCallLimit !== undefined) {
    agent.identicalCallLimit(vector.identicalCallLimit);
  }

  // Plural integrations (SPEC.md 4.8): scripted servers join in registration order, because the
  // order is the contract under contention, and each extra skill source accumulates after the
  // harness's own through the same client verb a host would use.
  const mcpServers = (vector.mcpServers ?? []).map((catalog) => createScriptedMcpServer(catalog, vector));

  for (const server of mcpServers) {
    agent.useMcp(server);
  }

  for (const extraSkill of vector.extraSkills ?? []) {
    agent.onSkills(async () => [{ name: `extra-${String(extraSkill.length)}`, description: "", content: extraSkill }]);
  }

  // Selection (SPEC.md 4.15): the vector names what the run is offered, and whether it binds.
  const selectedTools = vector.selectTools;

  if (selectedTools !== undefined) {
    agent.onSelectTools(async () => selectedTools);
  }

  if (vector.enforceSelection === true) {
    agent.enforceSelection();
  }

  try {
    // A streamed vector is driven through the streamed door, and what that door yielded is kept,
    // because some guarantees are only observable on the stream itself.
    const events: AgentStreamEvent[] = [];

    const outcome = vector.streamed === true
      ? await agent.runStream(vector.prompt, async (event) => { events.push(event); })
      : await agent.runAsync(vector.prompt);

    const failures = assertExpectations(vector, outcome, tools, generator.inputs, events, mcpServers);

    return failures.length === 0
      ? { vector, passed: true, detail: `${outcome.status}: ${firstLine(outcome.result)}` }
      : { vector, passed: false, detail: failures.join("; ") };
  } catch (error: unknown) {
    return { vector, passed: false, detail: `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}` };
  }
}

function firstLine(text: string): string {
  const line = text.split("\n")[0] ?? "";

  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}

function requiredBy(profile: Profile, profiles: readonly Profile[]): string[] {
  const parent = profile.inherits === undefined
    ? undefined
    : profiles.find((candidate) => candidate.name === profile.inherits);

  const inherited = parent === undefined ? [] : requiredBy(parent, profiles);

  return [...inherited, ...profile.requires];
}

async function main(): Promise<number> {
  const vectors = await readJsonFiles<Vector>(join(referenceRoot, "vectors"));
  const profiles = await readJsonFiles<Profile>(join(referenceRoot, "profiles"));

  process.stdout.write(`conformance: ${vectors.length} vectors, ${profiles.length} profiles\n\n`);

  const results: VectorResult[] = [];

  for (const vector of vectors) {
    results.push(await runVector(vector));
  }

  for (const result of results) {
    const mark = result.passed ? "pass" : "FAIL";
    process.stdout.write(`${mark}  ${result.vector.file}  ${result.detail}\n`);
  }

  process.stdout.write("\n");

  const passedNames = new Set(results.filter((result) => result.passed).map((result) => result.vector.name));
  const listedNames = new Set(profiles.flatMap((profile) => profile.requires));
  const claimed: string[] = [];

  for (const profile of profiles) {
    const required = requiredBy(profile, profiles);
    const passed = required.filter((name) => passedNames.has(name)).length;
    const isClaimable = passed === required.length;
    process.stdout.write(`${profile.name.padEnd(12)} ${passed}/${required.length} ${isClaimable ? "claimable" : "not claimable"}\n`);

    if (isClaimable) {
      claimed.push(profile.name);
    }
  }

  const unlisted = vectors.filter((vector) => !listedNames.has(vector.name));

  if (unlisted.length > 0) {
    const passedUnlisted = unlisted.filter((vector) => passedNames.has(vector.name)).length;
    process.stdout.write(`${"outside profiles".padEnd(12)} ${passedUnlisted}/${unlisted.length} reported separately\n`);
  }

  const failed = results.filter((result) => !result.passed).length;
  process.stdout.write(`\n${results.length - failed} passed, ${failed} failed; claimed: ${claimed.length === 0 ? "none" : claimed.join(", ")}\n`);

  // The claim this release makes (README): the profile named here must be claimable, whatever
  // the vectors beyond it say. Sprint 1 claims Core; the exit code says whether it may.
  const requiredClaim = process.env["CONFORMANCE_CLAIM"] ?? "Core";

  if (!claimed.includes(requiredClaim)) {
    process.stdout.write(`the ${requiredClaim} profile is not claimable\n`);

    return 1;
  }

  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`conformance: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
