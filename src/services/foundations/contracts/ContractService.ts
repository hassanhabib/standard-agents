import type { ContractBroker } from "../../../brokers/contracts/ContractBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { UNCONSTRAINED, type ContractVerdict } from "../../../models/foundations/contracts/ContractVerdict.js";
import { createTryCatch, type TryCatch } from "./ContractService.Exceptions.js";
import { validateAnswer } from "./ContractService.Validations.js";

// The Contract (SPEC.md 4.13): whether a final answer has the shape it was asked to have. It
// checks; it never rewrites. No schema means no constraint, and the broker is not asked.
export class ContractService {
  private readonly contractBroker: ContractBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(contractBroker: ContractBroker, loggingBroker: LoggingBroker) {
    this.contractBroker = contractBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public check(answer: string, schema: string): Promise<ContractVerdict> {
    return this.tryCatch(async () => {
      validateAnswer(answer);

      if (schema.trim().length === 0) {
        return UNCONSTRAINED;
      }

      const complaint = await this.contractBroker.validate(answer, schema);

      return complaint === null || complaint.trim().length === 0 ? UNCONSTRAINED : { satisfied: false, reason: complaint };
    });
  }
}
