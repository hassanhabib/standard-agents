// SPEC.md 4.14. Narration carries user-voiced progress prose; Response is the settled answer; Usage
// is what the run has spent so far, after every model call (4.14.1), and is never an answer;
// Spending is the same count while a call is being answered, always estimated, and never what the
// budget bounds.
export type AgentStreamEventType = "Status" | "Thinking" | "Tool" | "Response" | "Narration" | "Usage" | "Spending";
