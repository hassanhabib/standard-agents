import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import type { AuthorizationDecision } from "../../models/orchestrations/effects/AuthorizationDecision.js";

// The perimeter's policy (SPEC.md 4.9): decides whether an act, with its principal and scope, is
// permitted. mentions says whether the policy names the tool at all, which is what the
// permission mode reads when nothing explicitly permits an act.
export interface PolicyBroker {
  authorize(effect: AgentEffect): Promise<AuthorizationDecision>;
  mentions(effect: AgentEffect): boolean;
}
