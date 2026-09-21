import type { EffectRecord } from "../../../models/brokers/effects/EffectRecord.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { AgentStatus } from "../../../models/orchestrations/agents/AgentStatus.js";
import type { ToolExchange } from "../../../models/orchestrations/agents/ToolExchange.js";
import type { AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";

// How an act's ending is written back onto the context (SPEC.md 4.9). Pure: nothing here
// touches a service.

const RETURN_RESPONSE_DIRECTION = "ReturnResponse";
const REFUSE_DIRECTION = "Refuse";
const AWAIT_INPUT_DIRECTION = "AwaitInput";

export function isTerminal(directionType: string): boolean {
  const lower = directionType.toLowerCase();

  return (
    lower === RETURN_RESPONSE_DIRECTION.toLowerCase() ||
    lower === REFUSE_DIRECTION.toLowerCase() ||
    lower === AWAIT_INPUT_DIRECTION.toLowerCase()
  );
}

export function toTerminalStatus(directionType: string): AgentStatus {
  const lower = directionType.toLowerCase();

  if (lower === REFUSE_DIRECTION.toLowerCase()) {
    return "Refused";
  }

  if (lower === AWAIT_INPUT_DIRECTION.toLowerCase()) {
    return "AwaitingInput";
  }

  return "Responded";
}

// A denial is non-terminal: the agent is told and may choose a permitted path on the next turn,
// exactly as it recovers from a malformed call (SPEC.md 4.6, 4.9).
export function denied(context: AgentContext, reason: string): AgentContext {
  return {
    ...context,
    result: reason,
    observations: [...context.observations, `${context.directionType}: ${reason}`],
    toolExchanges: withExchange(context, reason),
    status: "Working",
  };
}

// The same outcome, and the one thing the model did not already have.
//
// The run-once perimeter is right that the act runs once (SPEC.md 4.9). What it hands back is the
// first outcome, and a model reading its own earlier answer back reads exactly what it was looking
// at when it decided to ask, so it decides the same thing again. Watched live on a request to
// restyle one file: nine identical calls in one run, nine identical answers, and the file the
// person asked about was not read until the turns had nearly run out.
//
// The outcome comes first and whole, because that is the point of a replay and something downstream
// may be looking for a value inside it. The note is added after, saying only what is true: this ran
// before with these arguments, and this is what it said then.
export function replayed(toolName: string, outcome: string): string {
  return (
    `${outcome}\n\n[${toolName} already ran in this run with the same arguments, and this is what it ` +
    `said then. Asking again returns this same answer. Use it and do something else.]`
  );
}

// Whether this run has already been handed this replay, note and all. The note said "use it and
// do something else"; a run asking a third time is doing the same thing instead, and the observation
// it left behind the last time is the proof.
//
// Read from the observations rather than from a counter, because they are what both protocols
// carry: the native path keeps exchanges and the text path does not, and a guard that only fired on
// one of them would be a guard the other door never had.
export function alreadyReplayed(context: AgentContext, toolName: string, outcome: string): boolean {
  return context.observations.includes(`${toolName}: ${replayed(toolName, outcome)}`);
}

// The note alone, from the third identical call on.
//
// Watched live: a 990-line file read in three pages, then the first page asked for fourteen more
// times, each answered with the same sixteen kilobytes and the same note, until the turns ran out
// with nothing done. The note was right and was not enough, and every copy cost the person a turn's
// worth of context. Not the outcome again: the model has had it twice, and a third copy is the bytes
// it was looking at when it decided to ask again.
//
// The run goes on. Whether a run that keeps asking should end is the loop's contract to decide, and
// the contract says the turn cap decides it (SPEC.md 4.9, conformance 06 and 17).
export function replayedAgain(toolName: string): string {
  return (
    `[${toolName} was asked for a third time with the same arguments. Its answer is above, from the ` +
    `first time, and is not repeated. Use it, ask for something different, or answer.]`
  );
}

// The result is kept beside the call that asked for it too, so the next turn can hand it back as
// a tool message rather than as narration on the native path (SPEC.md 6). Observations still
// carry it: they are what the text path reads, and what the trace and the Judge read on both.
export function observed(context: AgentContext, output: string, replayed = false): AgentContext {
  return {
    ...context,
    result: output,
    observations: [...context.observations, `${context.directionType}: ${output}`],
    toolExchanges: withExchange(context, output, replayed),
    status: "Working",
  };
}

// An earlier attempt whose fate is unknown ends the turn waiting on the caller (SPEC.md 4.9,
// 4.11): the act travels as the pending effect, key included, so whoever holds the ledger can
// check the world, record the real outcome or release the claim, and resume. Performing it
// blind could do it twice; presuming it done could leave it never done.
export function unreconciled(context: AgentContext, effect: AgentEffect, record: EffectRecord | null): AgentContext {
  const attempt = record === null
    ? "an earlier attempt in the ledger with no record left to read"
    : `an earlier attempt in the ledger with no usable outcome (state: ${record.state}, claimed ${record.claimedOn.toISOString()})`;

  return {
    ...context,
    result:
      `'${effect.toolName}' has ${attempt}; reconcile the ledger against the world, record the real ` +
      "outcome, or release the claim, before this act can run again.",
    pendingEffect: effect,
    status: "AwaitingInput",
  };
}

// A call the model made gets an answer, whatever the answer is. A denial and a withheld result
// are answers; leaving the call unanswered would strand it, and some providers reject a
// conversation whose tool call has no matching tool message (SPEC.md 6).
function withExchange(context: AgentContext, result: string, replayed = false): readonly ToolExchange[] {
  if (context.toolCallId.length === 0) {
    return context.toolExchanges;
  }

  // What the model said in the same breath as calling is recorded beside the act, so a later
  // conversation replays the turn whole. Absent when it said nothing, rather than present and
  // empty, because an empty string is a thing said.
  const said = context.assistantContent.length > 0 ? { assistantContent: context.assistantContent } : {};

  // And whether the ledger answered it rather than the tool, said only when it did: a loop that
  // counts a run's asks has to tell a replay from a call that ran, and a read after an edit is the
  // same ask and is not a repeat.
  const answeredFromTheLedger = replayed ? { replayed: true } : {};

  return [
    ...context.toolExchanges,
    { callId: context.toolCallId, toolName: context.directionType, argumentsJson: context.payload, result, ...said, ...answeredFromTheLedger },
  ];
}
