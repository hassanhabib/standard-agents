import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import type { ApprovalVerdict } from "../../models/orchestrations/effects/ApprovalVerdict.js";

// The perimeter's authority (SPEC.md 4.9): asked before an act that requires approval, never after.
export interface ApprovalBroker {
  request(effect: AgentEffect): Promise<ApprovalVerdict>;
}
