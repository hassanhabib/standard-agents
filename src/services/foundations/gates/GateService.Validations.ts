import { InvalidGateException } from "../../../models/foundations/gates/exceptions/InvalidGateException.js";

// The validation partial (SPEC-cli 3.1): a guardian asked about nothing has nothing to screen.
export function validateInput(input: string): void {
  if (input.trim().length === 0) {
    throw new InvalidGateException("Invalid gate input. Please correct the error and try again.");
  }
}
