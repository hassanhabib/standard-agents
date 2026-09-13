import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";

// The Decision nature's brain, V0: text in, text out (SPEC.md 6.0). honorsRequest says whether
// the broker applies the resolved inference or ignores it, so the foundation can announce the
// degradation (SPEC.md 4.13).
export interface GeneratorBroker {
  readonly honorsRequest: boolean;
  generate(systemPrompt: string, userPrompt: string, inference?: ResolvedInference): Promise<string>;
}
