import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import type { ApprovalVerdict } from "../../models/orchestrations/effects/ApprovalVerdict.js";
import type { ApprovalBroker } from "./ApprovalBroker.js";

// The Custom mode of approval (SPEC.md 4.8): the host's own authority, which is where a desktop
// card or a terminal prompt plugs in.
export class FunctionApprovalBroker implements ApprovalBroker {
  private readonly decide: (effect: AgentEffect) => Promise<ApprovalVerdict>;

  public constructor(decide: (effect: AgentEffect) => Promise<ApprovalVerdict>) {
    this.decide = decide;
  }

  public async request(effect: AgentEffect): Promise<ApprovalVerdict> {
    return await this.decide(effect);
  }
}
