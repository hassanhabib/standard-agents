import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import type { McpTool } from "../brokers/mcps/McpTool.js";
import type { AgentOutcome } from "../clients/agents/AgentOutcome.js";
import type { ApprovalDecision } from "../clients/agents/ApprovalDecision.js";
import type { PerformedEffect } from "./PerformedEffect.js";

// One prompt's run: its identity and its counters (SPEC.md 4.4). Run state is per invocation,
// never per instance: one agent serves many prompts at once, and a run kept in a shared field
// lets a second prompt corrupt the first's record. The run rides the async continuation of the
// prompt, so every tier beneath the loop reads the same run and a concurrent prompt sees its own.
export class AgentRun {
  private static readonly storage = new AsyncLocalStorage<AgentRun>();

  public readonly id: string;
  public readonly signal: AbortSignal | undefined;
  public prompt = "";
  public offeredTools: readonly string[] | null = null;
  public remoteTools: readonly McpTool[] = [];
  public handoffOutcome: AgentOutcome | null = null;
  public decision: ApprovalDecision | null = null;

  private readonly verdicts = new Map<string, string>();
  private readonly grants = new Set<string>();
  private readonly performed: PerformedEffect[] = [];
  private latestAskReplays = 0;
  private sequence = 0;
  private processIndex = 0;

  private constructor(id: string, signal: AbortSignal | undefined) {
    this.id = id;
    this.signal = signal;
  }

  // The run active on this flow, or null outside a run.
  public static current(): AgentRun | null {
    return AgentRun.storage.getStore() ?? null;
  }

  // Starts a run for the duration of the routine. A resumed run keeps the interrupted run's
  // identity so the effects it already performed are recognised as its own (SPEC.md 4.9, 4.11).
  // The enclosing run, if any, is what the flow returns to afterwards: a nested agent gives its
  // caller back its own run.
  public static async begin<T>(
    resumedId: string | null,
    signal: AbortSignal | undefined,
    routine: () => Promise<T>,
  ): Promise<T> {
    const id = resumedId === null || resumedId.length === 0 ? freshId() : resumedId;

    return await AgentRun.storage.run(new AgentRun(id, signal), routine);
  }

  // A run that is not on any flow, for a trace driven outside the loop.
  public static detached(): AgentRun {
    return new AgentRun(freshId(), undefined);
  }

  // A guardian verdict remembered for the life of this run, so an unchanged prompt is screened
  // once rather than once per turn (SPEC.md 4.10). It lives on the run rather than in a service
  // so the run ending evicts it, with nothing to remember to clear.
  public tryGetVerdict(prompt: string): string | undefined {
    return this.verdicts.get(prompt);
  }

  public rememberVerdict(prompt: string, verdict: string): void {
    this.verdicts.set(prompt, verdict);
  }

  // A grant is for what it was granted for: the tool and the scope, matched exactly. Approving a
  // write to one file is not approving writes to every file; a broader grant is a judgement
  // only the authority can make (SPEC.md 4.9).
  public wasGranted(toolName: string, scope: string): boolean {
    return this.grants.has(grantKey(toolName, scope));
  }

  public rememberGrant(toolName: string, scope: string): void {
    this.grants.add(grantKey(toolName, scope));
  }

  // What this run actually performed, in order, so the run can be unwound (SPEC.md 4.9).
  public get performedEffects(): readonly PerformedEffect[] {
    return [...this.performed];
  }

  public recordPerformed(effect: PerformedEffect): void {
    this.performed.push(effect);
  }

  // How many times the ledger has answered the most recent ask that reached it, or zero when that
  // ask was performed. What a repetition bound reads between turns (SPEC.md 4.10, v1.14).
  public get replaysOfLatestAsk(): number {
    return this.latestAskReplays;
  }

  // How many acts this run has performed on a scope that were not Safe: what a look at that scope
  // would see has changed that many times since the run began (SPEC.md 4.9, v1.14). Counted from
  // what the run performed, so it holds on every protocol, not only the one that carries exchanges.
  public writesTo(scope: string): number {
    return this.performed.filter(
      (performed) => performed.riskLevel !== undefined && performed.riskLevel !== "Safe" && performed.scope === scope,
    ).length;
  }

  // The next record number for this run, monotonic from zero, and the process number within
  // the current step, restarted when a step begins.
  public nextSequence(): number {
    return this.sequence++;
  }

  public nextProcessIndex(): number {
    return this.processIndex++;
  }

  public resetProcessIndex(): void {
    this.processIndex = 0;
  }
}

function grantKey(toolName: string, scope: string): string {
  return `${toolName.toLowerCase()} ${scope}`;
}

function freshId(): string {
  return randomUUID().replace(/-/g, "");
}
