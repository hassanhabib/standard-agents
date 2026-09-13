// The conformance runner (PLAN.md 4.9, CONFORMANCE.md). It reads the JSON vectors and the
// readiness profiles from the pinned reference checkout, drives each vector through the real
// engine with a scripted Brain and stub internal tools, asserts the expectation fields, and exits
// non-zero on any failure. A profile is claimable only when every vector it requires passes.
//
// Two rules the reference harness follows, followed here: every double replaces a broker, never
// a service, so the whole tree under test is the real library; and the agent is observed through
// its real seams, the outcome and the tools' own records, never off to the side.
//
// Sprint 1 wires the Core fields. A vector carrying a setup or expectation field this runner does
// not yet honor fails as unsupported, so a profile is never claimed on a vector half-run.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { StandardAgent, type AgentOutcome, type GeneratorBroker, type Tool } from "standard-agents";

interface Vector {
  readonly name: string;
  readonly description: string;
  readonly file: string;
  readonly generatorReplies: readonly string[];
  readonly tools: Readonly<Record<string, string>>;
  readonly prompt: string;
  readonly expect: Readonly<Record<string, unknown>>;
  readonly maxTurns?: number;
  readonly toolDescriptions?: Readonly<Record<string, string>>;
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
]);

const SUPPORTED_EXPECTATIONS: ReadonlySet<string> = new Set(["result", "resultContains", "toolInput", "toolRunCount", "toolNeverRan"]);

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
// last when exhausted, so a single non-terminal reply exercises the turn cap.
function createScriptedGenerator(replies: readonly string[]): GeneratorBroker {
  let index = 0;

  return {
    honorsRequest: true,
    generate: async () => {
      const reply = replies[Math.min(index, replies.length - 1)] ?? "";
      index += 1;

      return reply;
    },
  };
}

// Stub internal tools (runner contract 2): each returns its fixed output and records what it was
// called with. A description is the advertisement opt-in, given only when the vector says so.
function createStubTool(name: string, output: string, description: string): StubTool {
  const inputs: string[] = [];

  return {
    name,
    description,
    inputs,
    execute: async (input: string) => {
      inputs.push(input);

      return output;
    },
  };
}

function unsupportedFields(vector: Vector): string[] {
  const setup = Object.keys(vector).filter((key) => !SUPPORTED_SETUP_FIELDS.has(key));
  const expectations = Object.keys(vector.expect).filter((key) => !SUPPORTED_EXPECTATIONS.has(key));

  return [...setup, ...expectations.map((key) => `expect.${key}`)];
}

function assertExpectations(vector: Vector, outcome: AgentOutcome, tools: readonly StubTool[]): string[] {
  const failures: string[] = [];
  const expected = vector.expect;
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

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

async function runVector(vector: Vector): Promise<VectorResult> {
  const unsupported = unsupportedFields(vector);

  if (unsupported.length > 0) {
    return { vector, passed: false, detail: `unsupported field(s) in this runner: ${unsupported.join(", ")}` };
  }

  const tools = Object.entries(vector.tools).map(([name, output]) =>
    createStubTool(name, output, vector.toolDescriptions?.[name] ?? ""),
  );

  // Runner contract 3: Skill returns any text; Memory, Knowledge and the remote servers stay not
  // configured; the Gate allows and the Judge scores 1 because nothing configured them; the log
  // is silent. Nothing below the client is replaced.
  const agent = new StandardAgent()
    .useGenerator(createScriptedGenerator(vector.generatorReplies))
    .onSkills(async () => [{ name: "test-agent", description: "", content: "You are a test agent." }])
    .tools(tools);

  if (vector.maxTurns !== undefined) {
    agent.maxTurns(vector.maxTurns);
  }

  try {
    const outcome = await agent.runAsync(vector.prompt);
    const failures = assertExpectations(vector, outcome, tools);

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
