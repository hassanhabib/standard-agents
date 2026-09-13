import { InvalidContractException } from "../../../models/foundations/contracts/exceptions/InvalidContractException.js";

// The validation partial (SPEC-cli 3.1): an empty answer has no shape to check.
export function validateAnswer(answer: string): void {
  if (answer.trim().length === 0) {
    throw new InvalidContractException("Invalid contract answer. Please correct the error and try again.");
  }
}
