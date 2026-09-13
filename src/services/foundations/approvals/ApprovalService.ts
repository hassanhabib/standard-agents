import type { ApprovalBroker } from "../../../brokers/approvals/ApprovalBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import type { ApprovalVerdict } from "../../../models/orchestrations/effects/ApprovalVerdict.js";
import { createTryCatch, type TryCatch } from "./ApprovalService.Exceptions.js";
import { validateEffect } from "./ApprovalService.Validations.js";

// The approval foundation (SPEC.md 4.9): the authority asked before an act that requires it,
// never after. Pending is an answer too: no authority answered in time, and the act waits.
export class ApprovalService {
  private readonly approvalBroker: ApprovalBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(approvalBroker: ApprovalBroker, loggingBroker: LoggingBroker) {
    this.approvalBroker = approvalBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public requestApproval(effect: AgentEffect): Promise<ApprovalVerdict> {
    return this.tryCatch(async () => {
      validateEffect(effect);

      return await this.approvalBroker.request(effect);
    });
  }
}
