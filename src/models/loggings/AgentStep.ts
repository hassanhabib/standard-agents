// The nature a trace line belongs to. The reference numbers them 0, 1, 2 in the trace.
export type AgentStep = "Data" | "Decision" | "Direction";

export const AGENT_STEP_INDEX: Readonly<Record<AgentStep, number>> = {
  Data: 0,
  Decision: 1,
  Direction: 2,
};
