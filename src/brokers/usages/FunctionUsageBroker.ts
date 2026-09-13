import type { UsageBroker } from "./UsageBroker.js";

// The Custom mode of the token counter (SPEC.md 4.8): a real tokenizer, when the host has one.
export class FunctionUsageBroker implements UsageBroker {
  private readonly count: (text: string) => Promise<number>;

  public constructor(count: (text: string) => Promise<number>) {
    this.count = count;
  }

  public async countTokens(text: string): Promise<number> {
    return await this.count(text);
  }
}
