import type { ContractBroker } from "./ContractBroker.js";

// The Custom mode of the Contract (SPEC.md 4.8).
export class FunctionContractBroker implements ContractBroker {
  private readonly validateAnswer: (answer: string, schema: string) => Promise<string | null>;

  public constructor(validateAnswer: (answer: string, schema: string) => Promise<string | null>) {
    this.validateAnswer = validateAnswer;
  }

  public async validate(answer: string, schema: string): Promise<string | null> {
    return await this.validateAnswer(answer, schema);
  }
}
