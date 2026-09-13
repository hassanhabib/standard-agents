import { createRedaction, type Redaction, type RedactionRule } from "../../models/brokers/redactions/RedactionRule.js";
import type { RedactionBroker } from "./RedactionBroker.js";

// Deterministic redaction by rule (SPEC.md 4.6). No model decides what is a secret here, because a
// model that misses one has already sent it; a pattern that misses one can be added and every
// later call is covered.

// The shapes that are a secret whatever they sit beside, and the names that make the value beside
// them one. A rule with a capture group redacts only the group, so a key's name survives and its
// value does not: the model needs to know a key was there and must not be told what it was.
export const DEFAULT_REDACTION_RULES: readonly RedactionRule[] = [
  { family: "PEM", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { family: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { family: "SECRET", pattern: /\b(?:sk|psk|ghp|ghs|gho|github_pat)_[A-Za-z0-9_-]{16,}\b/g },
  { family: "AWS", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },

  // Found by the name beside it: api key, secret, token, password, in the shapes a config file,
  // an environment file and a command line all write them.
  {
    family: "SECRET",
    pattern: /(?:api[_-]?key|secret|token|password|passwd|pwd)["']?\s*[:=]\s*["']?([^\s"',;]{8,})/gi,
  },
];

export class RuleRedactionBroker implements RedactionBroker {
  private readonly rules: readonly RedactionRule[];

  public constructor(rules: readonly RedactionRule[] = DEFAULT_REDACTION_RULES) {
    this.rules = rules;
  }

  public async redact(text: string): Promise<Redaction> {
    const tokensByValue = new Map<string, string>();
    const valuesByToken = new Map<string, string>();
    const countByFamily = new Map<string, number>();
    let redacted = text;

    for (const rule of this.rules) {
      redacted = replaceAll(redacted, rule, (value) => {
        // The same value gets the same token however many times it appears and whichever rule
        // found it, so a prompt that names one key twice reads as one key twice, and rehydration
        // has one answer rather than two.
        const existing = tokensByValue.get(value);

        if (existing !== undefined) {
          return existing;
        }

        const next = (countByFamily.get(rule.family) ?? 0) + 1;
        countByFamily.set(rule.family, next);
        const token = `{{${rule.family}_${next}}}`;
        tokensByValue.set(value, token);
        valuesByToken.set(token, value);

        return token;
      });
    }

    return createRedaction(redacted, valuesByToken);
  }

  public async rehydrate(text: string, tokens: ReadonlyMap<string, string>): Promise<string> {
    let rehydrated = text;

    for (const [token, value] of tokens) {
      rehydrated = rehydrated.split(token).join(value);
    }

    return rehydrated;
  }
}

// Replaces the whole match, or only the first capture group when the rule has one. Written by
// hand rather than with a replacer callback because the group's own span is what must move, and
// the surrounding text the rule matched has to survive untouched.
function replaceAll(text: string, rule: RedactionRule, tokenFor: (value: string) => string): string {
  const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const captured = match[1];
    const value = captured ?? match[0];

    if (value.length === 0 || match.index === undefined) {
      continue;
    }

    const valueIndex = captured === undefined ? match.index : match.index + match[0].indexOf(captured);
    result += text.slice(lastIndex, valueIndex) + tokenFor(value);
    lastIndex = valueIndex + value.length;
  }

  return result + text.slice(lastIndex);
}
