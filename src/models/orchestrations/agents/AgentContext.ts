import type { ResolvedInference } from "../../brokers/generators/ResolvedInference.js";
import type { AgentTurn } from "../../brokers/sessions/AgentTurn.js";
import type { AgentEffect } from "../effects/AgentEffect.js";
import type { AgentStatus } from "./AgentStatus.js";
import type { ToolExchange } from "./ToolExchange.js";

// The single carrier that threads the loop (SPEC.md 3.2). All content is Data; the regions mark
// which nature last wrote each field. Updates are copy-on-write: a nature returns a spread copy
// and never mutates a shared instance, which is why every field is readonly.
export interface AgentContext {
  readonly prompt: string;
  readonly sessionId: string;
  readonly history: readonly AgentTurn[];
  readonly inference: ResolvedInference | null;
  readonly systemPrompt: string;
  readonly observations: readonly string[];
  readonly toolExchanges: readonly ToolExchange[];
  readonly toolCallId: string;

  // What the model said in the same breath as calling a tool. Empty when it only spoke or only
  // acted; kept so the exchange the run records carries the words as well as the act.
  readonly assistantContent: string;
  readonly pendingEffect: AgentEffect | null;
  readonly intent: string;
  readonly route: string;
  readonly directionType: string;
  readonly payload: string;
  readonly rawReply: string;
  readonly narration: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly usageIsEstimated: boolean;
  readonly transferring: boolean;
  readonly result: string;
  readonly remember: string;
  readonly status: AgentStatus;
}

export function createAgentContext(prompt: string): AgentContext {
  return {
    prompt,
    sessionId: "",
    history: [],
    inference: null,
    systemPrompt: "",
    observations: [],
    toolExchanges: [],
    toolCallId: "",
    assistantContent: "",
    pendingEffect: null,
    intent: "",
    route: "",
    directionType: "",
    payload: "",
    rawReply: "",
    narration: "",
    promptTokens: 0,
    completionTokens: 0,
    usageIsEstimated: false,
    transferring: false,
    result: "",
    remember: "",
    status: "Working",
  };
}
