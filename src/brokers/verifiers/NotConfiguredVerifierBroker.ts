import type { VerifierBroker } from "./VerifierBroker.js";

// The pass-through Judge the Core profile permits (SPEC.md 8.1): every candidate scores 1.
export class NotConfiguredVerifierBroker implements VerifierBroker {
  public async verify(_task: string, _candidate: string): Promise<string> {
    return "1";
  }
}
