import type { PromptRequest } from "../../../models/clients/agents/PromptRequest.js";
import type { RunOptions } from "../../../models/managements/runs/RunOptions.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";

// A grounded answer cites its sources (SPEC.md 4.2, v1.18).
//
// The loop cites, not the model. A model asked to name its sources names them when it feels like
// it, so the citation is written here, from the sources Recall put on the run, once the run has
// answered: after the Judge, which scores the model's answer and not lines the agent wrote, and
// before the Response event and the session write, so every door carries the same text.

// Precedence, as every request field obeys it: what the deployment configured, then what the
// request asked for, then off. A deployment that must cite cannot be switched off by a caller, and
// one that never cites cannot be switched on.
export function isCitingKnowledge(options: RunOptions, request: PromptRequest): boolean {
  return options.configuredCiteKnowledge ?? request.citeKnowledge ?? false;
}

// Only an answer is cited: a run that refused, asked, is waiting or failed has nothing to credit.
// Nor is an answer held to a response schema, because a line after it breaks the very shape the
// caller was promised. A source the answer already credits is not repeated.
export function withCitations(context: AgentContext, prefix: string): AgentContext {
  const schema = context.inference?.responseSchemaJson ?? null;

  if (context.status !== "Responded" || (schema !== null && schema.trim().length > 0)) {
    return context;
  }

  const answer = context.result.toLowerCase();

  const citations = context.groundingSources
    .map((source) => `${prefix}${source}`)
    .filter((citation) => !answer.includes(citation.toLowerCase()));

  if (citations.length === 0) {
    return context;
  }

  return { ...context, result: `${context.result.trimEnd()}\n\n${citations.join("\n")}` };
}
