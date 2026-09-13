import type { AgentContext } from "../../../../models/orchestrations/agents/AgentContext.js";

// The reply protocol (SPEC.md 6): what the model is shown, and how its answer is read back into
// an intent. Both halves belong to Inference, because they are the shape of one model call.

const ACTION_PREFIX = "ACTION:";
const TOOL_PREFIX = "TOOL:";
const TRANSFER_PREFIX = "TRANSFER:";
const FINAL_PREFIX = "FINAL:";
const SAY_PREFIX = "SAY:";
const RETURN_RESPONSE_DIRECTION = "ReturnResponse";
const RESPOND_INTENT = "Respond";

// The task a transfer hands over when the model names only the agent. The grounded handoff
// template already carries the user's actual ask, so the task slot states the transfer's meaning
// rather than repeating the prompt into its own context.
const TRANSFER_TASK = "answer the user's request in full.";

// What was said before, oldest first, so a follow-up resolves against it rather than starting
// from nothing (SPEC.md 4.11); then the task; then what this run has observed so far. Absent a
// session and observations, the message is exactly the task.
export function buildUserMessage(context: AgentContext): string {
  const lines: string[] = [];

  if (context.history.length > 0) {
    lines.push("Conversation so far:", "");

    for (const turn of context.history) {
      lines.push(`User: ${turn.prompt}`, `You: ${turn.answer}`);
    }

    lines.push("");
  }

  let message = `${lines.map((line) => `${line}\n`).join("")}Task: ${context.prompt}`;

  if (context.observations.length > 0) {
    message += "\n\nObservations so far:\n";
    message += context.observations.map((observation) => `- ${observation}\n`).join("");
  }

  return message;
}

// A leading SAY line is narration, never the choice: at most one is peeled before the first-line
// rule applies (SPEC.md 6.0), so a SAY followed by an ACTION still acts. The prose rides the
// context for the loop to screen and voice; it never enters the answer.
export function interpret(context: AgentContext, reply: string): AgentContext {
  const { narration, choice } = peelNarration(reply);
  const firstLine = (choice.split("\n")[0] ?? "").trim();

  if (startsWithIgnoringCase(firstLine, TOOL_PREFIX)) {
    const call = tryParseToolCall(firstLine.slice(TOOL_PREFIX.length));

    if (call !== null) {
      return chosen(context, reply, narration, call.toolName, call.argumentsJson, false);
    }
  }

  // TRANSFER: the model hands the whole run to a registered agent, through the same act pipeline
  // as ACTION but with a different ending: an answer from the specialist ends the run as the
  // answer. The model may write a task after the name; absent one, the transfer's own meaning
  // is the task. The same parroting guard ACTION has: a bare TRANSFER is not a transfer.
  if (startsWithIgnoringCase(firstLine, TRANSFER_PREFIX)) {
    const [agentName, task] = splitOnce(firstLine.slice(TRANSFER_PREFIX.length), ":");

    if (agentName.length > 0) {
      return chosen(context, reply, narration, agentName, task.length > 0 ? task : TRANSFER_TASK, true);
    }
  }

  if (startsWithIgnoringCase(firstLine, ACTION_PREFIX)) {
    const [toolName, toolInput] = splitOnce(firstLine.slice(ACTION_PREFIX.length), ":");

    // A model can emit the ACTION prefix with no tool name behind it (small models parrot the
    // protocol template). That is not a tool call: fall through and treat the reply as the
    // answer rather than routing an empty tool name into Direction, where it would fault.
    if (toolName.length > 0) {
      return chosen(context, reply, narration, toolName, toolInput, false);
    }
  }

  const answer = startsWithIgnoringCase(choice, FINAL_PREFIX) ? choice.slice(FINAL_PREFIX.length).trim() : choice;

  return {
    ...context,
    intent: RESPOND_INTENT,
    directionType: RETURN_RESPONSE_DIRECTION,
    payload: answer,
    rawReply: reply,
    narration,
    transferring: false,
  };
}

function peelNarration(reply: string): { narration: string; choice: string } {
  const leading = reply.trimStart();

  if (!startsWithIgnoringCase(leading, SAY_PREFIX)) {
    return { narration: "", choice: reply };
  }

  const newlineIndex = leading.indexOf("\n");

  return {
    narration: (newlineIndex < 0 ? leading.slice(SAY_PREFIX.length) : leading.slice(SAY_PREFIX.length, newlineIndex)).trim(),
    choice: newlineIndex < 0 ? "" : leading.slice(newlineIndex + 1).trim(),
  };
}

function chosen(
  context: AgentContext,
  reply: string,
  narration: string,
  name: string,
  payload: string,
  transferring: boolean,
): AgentContext {
  return {
    ...context,
    intent: name,
    directionType: name,
    payload,
    rawReply: reply,
    narration,
    transferring,
  };
}

// The structured call (SPEC.md 6.1): a JSON object naming the tool, with its arguments carried as
// JSON. Anything that is not that shape is not a call and reads as the answer.
function tryParseToolCall(json: string): { toolName: string; argumentsJson: string } | null {
  let root: unknown;

  try {
    root = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return null;
  }

  const call = root as { tool?: unknown; arguments?: unknown };

  if (typeof call.tool !== "string" || call.tool.trim().length === 0) {
    return null;
  }

  return {
    toolName: call.tool,
    argumentsJson: "arguments" in call ? JSON.stringify(call.arguments) : "{}",
  };
}

function splitOnce(text: string, separator: string): [string, string] {
  const index = text.indexOf(separator);

  return index < 0 ? [text.trim(), ""] : [text.slice(0, index).trim(), text.slice(index + separator.length).trim()];
}

function startsWithIgnoringCase(text: string, prefix: string): boolean {
  return text.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}
