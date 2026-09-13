import type { ToolDefinition } from "../../brokers/generators/v1/ToolDefinition.js";
import type { AgentTurn } from "../../brokers/sessions/AgentTurn.js";
import type { ToolExchange } from "../../orchestrations/agents/ToolExchange.js";
import type { ApprovalDecision } from "./ApprovalDecision.js";

// One caller's ask (SPEC.md 4.13). Every field but prompt is optional; a session wins over the
// caller's history; callerTools are vocabulary the model may name and never capability the agent
// runs; toolExchanges is this turn's in-flight work only. decision is additive over the reference.
export interface PromptRequest {
  readonly prompt: string;
  readonly sessionId: string;
  readonly history: readonly AgentTurn[];
  readonly toolExchanges: readonly ToolExchange[];
  readonly responseSchemaJson: string | null;
  readonly temperature: number | null;
  readonly maxTokens: number | null;
  readonly seed: number | null;
  readonly stop: readonly string[];
  readonly callerTools: readonly ToolDefinition[];
  readonly providerOptionsJson: string | null;
  readonly decision: ApprovalDecision | null;
}

export function createPromptRequest(prompt: string, sessionId = ""): PromptRequest {
  return {
    prompt,
    sessionId,
    history: [],
    toolExchanges: [],
    responseSchemaJson: null,
    temperature: null,
    maxTokens: null,
    seed: null,
    stop: [],
    callerTools: [],
    providerOptionsJson: null,
    decision: null,
  };
}
