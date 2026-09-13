import type { Redaction } from "../../models/brokers/redactions/RedactionRule.js";
import type { RedactionBroker } from "./RedactionBroker.js";

// The Custom mode (SPEC.md 4.8): the host's own tokenizer, which is how a deployment that already
// owns a structured redactor keeps using it rather than describing its rules again as patterns.
export class FunctionRedactionBroker implements RedactionBroker {
  private readonly redactText: (text: string) => Promise<Redaction>;
  private readonly rehydrateText: (text: string, tokens: ReadonlyMap<string, string>) => Promise<string>;

  public constructor(
    redactText: (text: string) => Promise<Redaction>,
    rehydrateText: (text: string, tokens: ReadonlyMap<string, string>) => Promise<string>,
  ) {
    this.redactText = redactText;
    this.rehydrateText = rehydrateText;
  }

  public async redact(text: string): Promise<Redaction> {
    return await this.redactText(text);
  }

  public async rehydrate(text: string, tokens: ReadonlyMap<string, string>): Promise<string> {
    return await this.rehydrateText(text, tokens);
  }
}
