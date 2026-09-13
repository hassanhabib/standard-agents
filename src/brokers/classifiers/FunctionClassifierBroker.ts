import type { ClassifierBroker } from "./ClassifierBroker.js";

// The Custom mode of the Gate (SPEC.md 4.8), and the seam the conformance runner scripts.
export class FunctionClassifierBroker implements ClassifierBroker {
  private readonly classifyInput: (input: string) => Promise<string>;
  private readonly assessInput: (systemPrompt: string, input: string) => Promise<string>;

  public constructor(
    classifyInput: (input: string) => Promise<string>,
    assessInput: (systemPrompt: string, input: string) => Promise<string> = async () => "NONE",
  ) {
    this.classifyInput = classifyInput;
    this.assessInput = assessInput;
  }

  public async classify(input: string): Promise<string> {
    return await this.classifyInput(input);
  }

  public async assess(systemPrompt: string, input: string): Promise<string> {
    return await this.assessInput(systemPrompt, input);
  }
}
