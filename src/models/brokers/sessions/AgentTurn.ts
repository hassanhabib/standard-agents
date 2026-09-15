import type { ToolExchange } from "../../orchestrations/agents/ToolExchange.js";

// A completed prompt and what it did (SPEC.md 3.2). A turn carries its own exchanges, oldest
// first; a past turn's calls are replayed inside that turn and never after the current prompt.
export interface AgentTurn {
  readonly prompt: string;
  readonly answer: string;
  readonly exchanges: readonly ToolExchange[];

  // When the turn was written, as an ISO instant, from the clock the run was given. Optional
  // because every turn recorded before this field existed is still in the store and still has to
  // read back: a conversation from last week is not less of a conversation for not knowing what
  // time it was, and a window that refused to draw it would be losing somebody's history to a
  // schema change.
  readonly recordedOn?: string;

  // Which run produced this turn. The session carries the run it last was, which is one run for a
  // conversation with twenty turns in it, so anything keeping what a run did to the folder could be
  // offered for the most recent turn and for no other.
  //
  // Optional for the same reason `recordedOn` is: every turn recorded before this field existed is
  // still in somebody's store and still has to read back. A turn that does not know its run is a
  // turn nothing can be offered for, which is where all of them were.
  readonly runId?: string;
}
