// How much of a run the trace carries: the outcome only, each nature's step, or every process line.
export type TraceVerbosity = "Summary" | "Natures" | "Full";

export const TRACE_VERBOSITY_LEVEL: Readonly<Record<TraceVerbosity, number>> = {
  Summary: 0,
  Natures: 1,
  Full: 2,
};
