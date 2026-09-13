import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import type { NativeAsk } from "../../../models/foundations/brains/NativeAsk.js";

// The validation partial: structural checks before the broker is touched (SPEC-cli 3.1). The
// system prompt may be empty (a brain with no instructions is still a brain); the user prompt
// may not.
export function validateUserPrompt(userPrompt: string): void {
  if (userPrompt.trim().length === 0) {
    throw new InvalidBrainException("Invalid brain input. Please correct the error and try again.");
  }
}

// The shape a call id must have on the wire. Checked here rather than discovered at the provider,
// because an id that arrives back malformed breaks the binding between a call and its answer, and
// a conversation whose answers are not bound to their calls is one the model reads wrongly.
const CALL_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function validateToolCallIds(ask: NativeAsk): void {
  const everyExchange = [...ask.history.flatMap((turn) => turn.exchanges), ...ask.exchanges];

  for (const exchange of everyExchange) {
    if (!CALL_ID.test(exchange.callId)) {
      throw new InvalidBrainException("Invalid brain input. Please correct the error and try again.");
    }
  }
}
