import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import { allow, type AuthorizationDecision } from "../../models/orchestrations/effects/AuthorizationDecision.js";
import type { PolicyBroker } from "./PolicyBroker.js";

// No policy configured: every act is permitted and none is mentioned, so the permission mode
// alone decides what happens to an act nothing permitted.
export class NotConfiguredPolicyBroker implements PolicyBroker {
  public async authorize(_effect: AgentEffect): Promise<AuthorizationDecision> {
    return allow();
  }

  public mentions(_effect: AgentEffect): boolean {
    return false;
  }
}
