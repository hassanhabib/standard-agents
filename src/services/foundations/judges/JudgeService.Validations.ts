import { InvalidJudgeException } from "../../../models/foundations/judges/exceptions/InvalidJudgeException.js";
import { InvalidJudgeScoreException } from "../../../models/foundations/judges/exceptions/InvalidJudgeScoreException.js";

// The validation partial (SPEC-cli 3.1): a judge with nothing to judge has nothing to score, and
// a verdict that carries no score between 0 and 1 is not a judgement the loop can act on.
export function validateCandidate(candidate: string): void {
  if (candidate.trim().length === 0) {
    throw new InvalidJudgeException("Invalid judge candidate. Please correct the error and try again.");
  }
}

export function validateScore(score: number): void {
  if (Number.isNaN(score) || score < 0 || score > 1) {
    throw new InvalidJudgeScoreException("Invalid judge score. The verifier must answer with a score between 0 and 1.");
  }
}
