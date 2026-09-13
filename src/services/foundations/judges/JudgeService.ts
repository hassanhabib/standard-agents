import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { VerifierBroker } from "../../../brokers/verifiers/VerifierBroker.js";
import type { Judgement } from "../../../models/foundations/judges/Judgement.js";
import { createTryCatch, type TryCatch } from "./JudgeService.Exceptions.js";
import { validateCandidate, validateScore } from "./JudgeService.Validations.js";

// The Judge (SPEC.md 4.2, 4.5): the guardian after the brain. It scores a candidate answer
// against the task and never answers in its place.
export class JudgeService {
  private readonly verifierBroker: VerifierBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(verifierBroker: VerifierBroker, loggingBroker: LoggingBroker) {
    this.verifierBroker = verifierBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public evaluate(task: string, candidate: string): Promise<Judgement> {
    return this.tryCatch(async () => {
      validateCandidate(candidate);
      const verdict = await this.verifierBroker.verify(task, candidate);
      const judgement = parseJudgement(verdict);
      validateScore(judgement.score);

      return judgement;
    });
  }
}

// The verdict contract (SPEC.md 4.5): a score first, the reason after it. Anything before the
// number is ignored, so a verifier that says "Score: 0.8, grounded" is read as 0.8, "grounded".
function parseJudgement(verdict: string): Judgement {
  const match = /-?\d+(?:\.\d+)?/.exec(verdict);
  const score = match === null ? Number.NaN : Number.parseFloat(match[0]);
  const reason = match === null ? verdict.trim() : verdict.slice(match.index + match[0].length).replace(/^[\s:,|-]+/, "").trim();

  return { score, reason };
}
