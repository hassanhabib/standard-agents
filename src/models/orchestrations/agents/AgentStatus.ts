// SPEC.md 3.1. Working is the default; Revising is loop-internal and never leaves the loop.
export type AgentStatus =
  | "Working"
  | "Responded"
  | "AwaitingInput"
  | "Refused"
  | "Failed"
  | "Revising"
  | "AwaitingApproval";
