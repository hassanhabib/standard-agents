import type { GenerationResult } from "./GenerationResult.js";

// One step of a streamed generation (SPEC.md 6.2). Content and narration carry this frame's own
// piece and nothing accumulated, so a consumer can voice them as they arrive; completed is null
// until the last delta, which carries the whole generation and no piece of its own.
export interface GenerationDelta {
  readonly content: string;
  readonly narration: string;

  // What the model wrote in this frame that nobody reads: a piece of a call's arguments, or of its
  // reasoning. Spent all the same, so it is handed up to be counted and never voiced. Absent when
  // the frame carried none, which is almost every frame of an answer in words.
  readonly written?: string;

  readonly completed: GenerationResult | null;
}
