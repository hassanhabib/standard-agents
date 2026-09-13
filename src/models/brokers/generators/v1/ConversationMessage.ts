import type { MessageRole } from "./MessageRole.js";
import type { ModelToolCall } from "./ModelToolCall.js";

// One message of the conversation the native protocol sends (SPEC.md 6.2). The four roles are the
// wire's, not the agent's: what the agent thinks of a turn is its own business, and this is only
// how a turn is said to a provider.
export interface ConversationMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly toolCalls: readonly ModelToolCall[];
  readonly toolCallId: string;

  // The tool a Tool message answers for. Empty on every other role. The call id is what binds the
  // answer to its call; the name rides beside it because the wire contract carries both.
  readonly name: string;
}

// Builders rather than object literals at every site, so a message is never half written: every
// member is present and the role decides which of them carry anything.
export function systemMessage(content: string): ConversationMessage {
  return { role: "System", content, toolCalls: [], toolCallId: "", name: "" };
}

export function userMessage(content: string): ConversationMessage {
  return { role: "User", content, toolCalls: [], toolCallId: "", name: "" };
}

export function assistantMessage(content: string, toolCalls: readonly ModelToolCall[] = []): ConversationMessage {
  return { role: "Assistant", content, toolCalls, toolCallId: "", name: "" };
}

export function toolMessage(toolCallId: string, name: string, content: string): ConversationMessage {
  return { role: "Tool", content, toolCalls: [], toolCallId, name };
}
