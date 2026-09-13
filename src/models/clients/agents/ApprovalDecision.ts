// A decision carried on a resumed request (PLAN.md 2.5): the authority's answer to the pending
// effect the session holds, matched by its idempotency key. The resumed run performs that effect
// first, through the full perimeter, and only then hands the turn to the brain.
export interface ApprovalDecision {
  readonly idempotencyKey: string;
  readonly decision: "Approved" | "Denied";
}
