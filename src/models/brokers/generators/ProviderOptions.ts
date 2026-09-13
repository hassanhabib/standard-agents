// The opaque provider passthrough a request may carry (SPEC.md 4.13), sanitized once at the
// boundary so no broker, built in or third party, can ever be handed a passthrough carrying a
// key the core owns: those are the resolved inference's to set, and a caller cannot add a tool
// or beat a resolved value by naming its wire field.

const CORE_OWNED_KEYS: readonly string[] = [
  "model",
  "messages",
  "tools",
  "tool_choice",
  "temperature",
  "max_tokens",
  "max_completion_tokens",
  "stream",
  "response_format",
  "seed",
  "stop",
];

export interface SanitizedProviderOptions {
  readonly json: string | null;
  readonly strippedKeys: readonly string[];
  readonly malformed: boolean;
}

export function sanitizeProviderOptions(json: string | null): SanitizedProviderOptions {
  if (json === null || json.trim().length === 0) {
    return { json: null, strippedKeys: [], malformed: false };
  }

  let root: unknown;

  try {
    root = JSON.parse(json);
  } catch {
    return { json: null, strippedKeys: [], malformed: true };
  }

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { json: null, strippedKeys: [], malformed: true };
  }

  const entries = Object.entries(root as Record<string, unknown>);
  const strippedKeys = entries.map(([key]) => key).filter((key) => CORE_OWNED_KEYS.includes(key.toLowerCase()));
  const kept = Object.fromEntries(entries.filter(([key]) => !CORE_OWNED_KEYS.includes(key.toLowerCase())));

  return {
    json: Object.keys(kept).length === 0 ? null : JSON.stringify(kept),
    strippedKeys,
    malformed: false,
  };
}
