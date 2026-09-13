import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { NullAgentContextException } from "../../../models/orchestrations/agents/exceptions/NullAgentContextException.js";

// The validation partial: a nature asked to recall for no context has nothing to recall for.
export function validateContext(context: AgentContext | null | undefined): asserts context is AgentContext {
  if (context === null || context === undefined) {
    throw new NullAgentContextException("Agent context is null.");
  }
}
