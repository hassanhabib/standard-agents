import { createRedaction, type Redaction } from "../../models/brokers/redactions/RedactionRule.js";
import type { RedactionBroker } from "./RedactionBroker.js";

// No redaction configured: the text goes as it is. The decorators are still in place, so turning
// redaction on is a composition change and never a change to a service.
export class NotConfiguredRedactionBroker implements RedactionBroker {
  public async redact(text: string): Promise<Redaction> {
    return createRedaction(text);
  }

  public async rehydrate(text: string, _tokens: ReadonlyMap<string, string>): Promise<string> {
    return text;
  }
}
