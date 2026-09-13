import { InvalidReturnException } from "../../../models/foundations/returns/exceptions/InvalidReturnException.js";

// The validation partial (SPEC-cli 3.1): an answer with nothing in it is not an answer.
export function validatePayload(payload: string): void {
  if (payload.trim().length === 0) {
    throw new InvalidReturnException("Invalid return payload. Please correct the error and try again.");
  }
}
