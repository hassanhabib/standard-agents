import { InvalidMemoryException } from "../../../models/foundations/memorys/exceptions/InvalidMemoryException.js";

// The validation partial (SPEC-cli 3.1): an empty memory is nothing to remember, and the store
// is not written for it.
export function validateMemory(memory: string): void {
  if (memory.trim().length === 0) {
    throw new InvalidMemoryException("Invalid memory. Please correct the error and try again.");
  }
}
