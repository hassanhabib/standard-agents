import { createHash } from "node:crypto";

import type { AgentPrincipal } from "./AgentPrincipal.js";
import type { RiskLevel } from "./RiskLevel.js";

// A proposed act, described (SPEC.md 3.3): authorization, approval and run-once are all
// judgments about an act, and an act with no identity cannot be judged twice the same way.
export interface AgentEffect {
  readonly runId: string;
  readonly principal: string | null;
  readonly identity: AgentPrincipal | null;
  readonly toolName: string;
  readonly arguments: string;
  readonly callId: string;
  readonly scope: string;
  readonly riskLevel: RiskLevel;
  readonly approvalRequired: boolean;
  readonly idempotencyKey: string;
}

const KEY_SEPARATOR = "|";

export function createAgentEffect(
  runId: string,
  toolName: string,
  effectArguments: string,
  riskLevel: RiskLevel = "Safe",
  approvalRequired = false,
  principal: AgentPrincipal | null = null,
  scope = "",
): AgentEffect {
  return {
    runId,
    scope,
    principal: principal?.id ?? null,
    identity: principal,
    toolName,
    arguments: effectArguments,
    callId: "",
    riskLevel,
    approvalRequired,
    idempotencyKey: deriveIdempotencyKey(runId, toolName, effectArguments),
  };
}

// SHA-256, lowercase hex, over the run id, the trimmed lower-cased tool name and the arguments
// with whitespace runs collapsed to single spaces, joined by a pipe. The same bytes the reference
// hashes, so the two implementations agree on what "the same act" means.
export function deriveIdempotencyKey(
  runId: string,
  toolName: string,
  effectArguments: string,
): string {
  const canonicalArguments = effectArguments.split(/\s+/).filter((part) => part.length > 0).join(" ");
  const canonical = [runId, toolName.trim().toLowerCase(), canonicalArguments].join(KEY_SEPARATOR);

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
