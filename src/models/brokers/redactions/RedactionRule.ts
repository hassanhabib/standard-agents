// What a redaction rule matches and what family its matches belong to (SPEC.md 4.6). The family
// becomes the placeholder's prefix, so a model reading a redacted prompt can still tell an email
// from a key and reason about the shape of what it cannot see.
//
// A pattern with a capture group redacts only that group, which is how a rule can find a value by
// the name beside it and still leave the name legible: the model needs to know an API key was
// there, and must not be told what it was.
export interface RedactionRule {
  readonly family: string;
  readonly pattern: RegExp;
}

// A redacted text and the tokens that will put it back. The map is the run's alone and never
// leaves the machine; it is what rehydration reads, and what makes the redaction reversible for
// the user without ever making it reversible for the provider.
export interface Redaction {
  readonly text: string;
  readonly tokens: ReadonlyMap<string, string>;
}

export function createRedaction(text: string, tokens: ReadonlyMap<string, string> = new Map()): Redaction {
  return { text, tokens };
}
