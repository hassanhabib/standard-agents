import { InvalidExternalToolException } from "../../../models/foundations/externalTools/exceptions/InvalidExternalToolException.js";

// The validation partial (SPEC-cli 3.1): a remote tool is named before it is called, and no name
// reaches no server.
export function validateName(name: string): void {
  if (name.trim().length === 0) {
    throw new InvalidExternalToolException("Invalid external tool name. Please correct the error and try again.");
  }
}
