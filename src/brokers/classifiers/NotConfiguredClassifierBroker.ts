import type { ClassifierBroker } from "./ClassifierBroker.js";

// The pass-through Gate the Core profile permits (SPEC.md 8.1): everything is allowed and no
// conflict is ever found.
export class NotConfiguredClassifierBroker implements ClassifierBroker {
  public async classify(_input: string): Promise<string> {
    return "allow";
  }

  public async assess(_systemPrompt: string, _input: string): Promise<string> {
    return "NONE";
  }
}
