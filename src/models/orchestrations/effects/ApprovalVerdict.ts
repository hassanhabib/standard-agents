// What an authority answered about an act (SPEC.md 4.9). Pending means no authority answered in
// time; the act is not performed and the run is held.
export type ApprovalVerdict = "Approved" | "Denied" | "Pending";
