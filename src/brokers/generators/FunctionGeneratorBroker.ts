import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";
import type { GeneratorBroker } from "./GeneratorBroker.js";

// The Custom mode of the brain (SPEC.md 4.8), and the seam the conformance runner scripts.
export class FunctionGeneratorBroker implements GeneratorBroker {
  public readonly honorsRequest = false;
  private readonly generateReply: (systemPrompt: string, userPrompt: string) => Promise<string>;

  public constructor(generateReply: (systemPrompt: string, userPrompt: string) => Promise<string>) {
    this.generateReply = generateReply;
  }

  public async generate(systemPrompt: string, userPrompt: string, _inference?: ResolvedInference): Promise<string> {
    return await this.generateReply(systemPrompt, userPrompt);
  }
}
