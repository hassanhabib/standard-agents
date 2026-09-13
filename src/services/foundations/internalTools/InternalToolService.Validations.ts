import { InvalidInternalToolException } from "../../../models/foundations/internalTools/exceptions/InvalidInternalToolException.js";

// The validation partial (SPEC-cli 3.1): a tool name must be there before the registry is asked.
// The input may be empty; a tool decides what it makes of an empty input.
export function validateName(name: string): void {
  if (name.trim().length === 0) {
    throw new InvalidInternalToolException("Invalid internal tool. Please correct the error and try again.");
  }
}
