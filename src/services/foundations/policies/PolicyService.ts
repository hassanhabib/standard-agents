import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { PolicyBroker } from "../../../brokers/policies/PolicyBroker.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import type { AuthorizationDecision } from "../../../models/orchestrations/effects/AuthorizationDecision.js";
import { createTryCatch, type TryCatch } from "./PolicyService.Exceptions.js";
import { validateEffect } from "./PolicyService.Validations.js";

// The policy foundation (SPEC.md 4.9): whether an act, with its principal and scope, is
// permitted, and whether the policy names the tool at all. It answers; it never performs.
export class PolicyService {
  private readonly policyBroker: PolicyBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(policyBroker: PolicyBroker, loggingBroker: LoggingBroker) {
    this.policyBroker = policyBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public authorize(effect: AgentEffect): Promise<AuthorizationDecision> {
    return this.tryCatch(async () => {
      validateEffect(effect);

      return await this.policyBroker.authorize(effect);
    });
  }

  public mentions(effect: AgentEffect): Promise<boolean> {
    return this.tryCatch(async () => {
      validateEffect(effect);

      return this.policyBroker.mentions(effect);
    });
  }
}
