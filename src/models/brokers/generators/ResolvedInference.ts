import type { ToolDefinition } from "./v1/ToolDefinition.js";

// The inference options a run actually uses once precedence has resolved at the boundary
// (SPEC.md 4.13): configuration first, then the request, then these defaults, per field.
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 1024;

export interface ResolvedInference {
  readonly temperature: number;
  readonly maxTokens: number;
  readonly seed: number | null;
  readonly stop: readonly string[];
  readonly responseSchemaJson: string | null;
  readonly callerTools: readonly ToolDefinition[];
  readonly providerOptionsJson: string | null;
}

export function createResolvedInference(): ResolvedInference {
  return {
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    seed: null,
    stop: [],
    responseSchemaJson: null,
    callerTools: [],
    providerOptionsJson: null,
  };
}
