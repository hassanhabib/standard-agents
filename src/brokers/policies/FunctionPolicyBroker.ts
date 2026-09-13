import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import type { AuthorizationDecision } from "../../models/orchestrations/effects/AuthorizationDecision.js";
import type { PolicyBroker } from "./PolicyBroker.js";

// The Custom mode of policy (SPEC.md 4.8): a host-supplied decision over the whole effect,
// principal included, which is how identity-aware authorization reaches the decision itself.
export class FunctionPolicyBroker implements PolicyBroker {
  private readonly decide: (effect: AgentEffect) => Promise<AuthorizationDecision>;

  public constructor(decide: (effect: AgentEffect) => Promise<AuthorizationDecision>) {
    this.decide = decide;
  }

  public async authorize(effect: AgentEffect): Promise<AuthorizationDecision> {
    return await this.decide(effect);
  }

  public mentions(_effect: AgentEffect): boolean {
    return true;
  }
}
