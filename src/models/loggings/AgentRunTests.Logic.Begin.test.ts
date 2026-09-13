import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AgentRun } from "./AgentRun.js";

describe("AgentRun begin logic", () => {
  it("ShouldBeginRunWithFreshIdentityAsync", async () => {
    // given
    const controller = new AbortController();

    // when
    const runInside = await AgentRun.begin(null, controller.signal, async () => AgentRun.current());
    const runOutside = AgentRun.current();

    // then
    expect(runInside).not.toBeNull();
    expect(runInside?.id).toMatch(/^[0-9a-f]{32}$/);
    expect(runInside?.signal).toBe(controller.signal);
    expect(runOutside).toBeNull();
  });

  it("ShouldIsolateConcurrentRunsAsync", async () => {
    // given
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

    const observe = async (): Promise<[string | undefined, string | undefined]> =>
      await AgentRun.begin(null, undefined, async () => {
        const before = AgentRun.current()?.id;
        await settle();

        return [before, AgentRun.current()?.id];
      });

    // when
    const [[firstBefore, firstAfter], [secondBefore, secondAfter]] = await Promise.all([observe(), observe()]);

    // then
    expect(firstBefore).toBeDefined();
    expect(firstBefore).toBe(firstAfter);
    expect(secondBefore).toBe(secondAfter);
    expect(firstBefore).not.toBe(secondBefore);
  });

  it("ShouldRestoreEnclosingRunAfterNestedRunAsync", async () => {
    // when
    const [outerBefore, inner, outerAfter] = await AgentRun.begin(null, undefined, async () => {
      const before = AgentRun.current()?.id;
      const nested = await AgentRun.begin(null, undefined, async () => AgentRun.current()?.id);

      return [before, nested, AgentRun.current()?.id];
    });

    // then
    expect(outerBefore).toBeDefined();
    expect(inner).not.toBe(outerBefore);
    expect(outerAfter).toBe(outerBefore);
  });

  it("ShouldResumeRunWithGivenIdentityAsync", async () => {
    // given
    const resumedId = randomUUID().replace(/-/g, "");

    // when
    const actualId = await AgentRun.begin(resumedId, undefined, async () => AgentRun.current()?.id);

    // then
    expect(actualId).toBe(resumedId);
  });

});
