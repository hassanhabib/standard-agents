import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AgentRun } from "./AgentRun.js";

describe("AgentRun remember logic", () => {
  it("ShouldRememberVerdictForTheRun", () => {
    // given
    const run = AgentRun.detached();
    const prompt = randomUUID();
    const verdict = randomUUID();

    // when
    const before = run.tryGetVerdict(prompt);
    run.rememberVerdict(prompt, verdict);
    const after = run.tryGetVerdict(prompt);

    // then
    expect(before).toBeUndefined();
    expect(after).toBe(verdict);
  });

  it("ShouldRememberGrantForExactlyTheToolAndScope", () => {
    // given
    const run = AgentRun.detached();
    const toolName = randomUUID();
    const scope = `/${randomUUID()}`;

    // when
    run.rememberGrant(toolName, scope);

    // then
    expect(run.wasGranted(toolName, scope)).toBe(true);
    expect(run.wasGranted(toolName.toUpperCase(), scope)).toBe(true);
    expect(run.wasGranted(toolName, `${scope}/deeper`)).toBe(false);
    expect(run.wasGranted(toolName, "")).toBe(false);
    expect(run.wasGranted(randomUUID(), scope)).toBe(false);
  });

  it("ShouldRecordPerformedEffectsInOrderAndCountRecords", () => {
    // given
    const run = AgentRun.detached();
    const first = { toolName: randomUUID(), arguments: randomUUID(), outcome: randomUUID(), idempotencyKey: randomUUID() };
    const second = { toolName: randomUUID(), arguments: randomUUID(), outcome: randomUUID(), idempotencyKey: randomUUID() };

    // when
    run.recordPerformed(first);
    run.recordPerformed(second);
    const sequences = [run.nextSequence(), run.nextSequence()];
    const processes = [run.nextProcessIndex(), run.nextProcessIndex()];
    run.resetProcessIndex();

    // then
    expect(run.performedEffects).toEqual([first, second]);
    expect(sequences).toEqual([0, 1]);
    expect(processes).toEqual([0, 1]);
    expect(run.nextProcessIndex()).toBe(0);
  });

});
