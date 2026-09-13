import type { ClassifierBroker } from "../../../brokers/classifiers/ClassifierBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { createTryCatch, type TryCatch } from "./GateService.Exceptions.js";
import { validateInput } from "./GateService.Validations.js";

// The rubric the conflict check assesses instructions against. It is framework-owned contract
// text (SPEC.md 4.5), so a replacement policy can never break how the answer is parsed.
const CONFLICT_RUBRIC =
  "You review an AI agent's active skill instructions for a DIRECT CONTRADICTION: two " +
  "instructions that cannot both be obeyed at once, for example 'answer in Arabic' versus " +
  "'answer in English'. If such a contradiction exists, reply with a single line in the " +
  "form: CONFLICT: <short label> | <instruction> || <short label> | <instruction>. If there " +
  "is no contradiction, reply with a single word: NONE.";

// The Gate (SPEC.md 4.2, 4.5): the guardian before the brain. It screens what goes in and
// detects contradictions between the instructions that were loaded, and it is never the Brain.
export class GateService {
  private readonly classifierBroker: ClassifierBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(classifierBroker: ClassifierBroker, loggingBroker: LoggingBroker) {
    this.classifierBroker = classifierBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public screen(input: string): Promise<string> {
    return this.tryCatch(async () => {
      validateInput(input);

      return await this.classifierBroker.classify(input);
    });
  }

  public detectConflict(instructions: string): Promise<string> {
    return this.tryCatch(async () => {
      validateInput(instructions);

      return await this.classifierBroker.assess(CONFLICT_RUBRIC, instructions);
    });
  }
}
