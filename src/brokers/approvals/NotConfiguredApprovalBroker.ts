import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import type { ApprovalVerdict } from "../../models/orchestrations/effects/ApprovalVerdict.js";
import type { ApprovalBroker } from "./ApprovalBroker.js";

// No authority configured: an act that needs approval is held, never presumed approved.
export class NotConfiguredApprovalBroker implements ApprovalBroker {
  public async request(_effect: AgentEffect): Promise<ApprovalVerdict> {
    return "Pending";
  }
}
