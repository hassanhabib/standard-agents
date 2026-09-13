import type { Redaction } from "../../models/brokers/redactions/RedactionRule.js";

// The boundary redactor (SPEC.md 4.6). Every model the agent drives reads redacted text, not just
// the brain: the Gate screens the raw task and the Judge reads the task and the draft, and either
// may run on a different host, so redacting only the brain narrows nothing.
//
// It is applied by decorating each model broker rather than by handing this to each service, which
// is what makes "every model call" structural: a foundation holds one broker, knows nothing of
// redaction, and a fourth model call added tomorrow cannot forget.
export interface RedactionBroker {
  redact(text: string): Promise<Redaction>;

  // The values put back, by the tokens the redaction handed out. Applied to what comes back from
  // a model, so the user reads their own data and the provider never did.
  rehydrate(text: string, tokens: ReadonlyMap<string, string>): Promise<string>;
}
