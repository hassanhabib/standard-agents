import { createHash } from "node:crypto";

// One line of the decision log (SPEC.md 4.7, 10.4). The trace is for a person reading what
// happened; this is the record that survives it, and the two are not the same thing: the trace is
// reset at the start of every run, and this is appended to and never reset.
//
// Content-free by default. What a record proves about a payload is its length and its hash, which
// is enough to show that a given prompt is the one that was sent without the record itself
// becoming a second copy of everything the agent was told. A deployment that needs the words can
// turn payload capture on and accept what that means.
export interface AuditRecord {
  readonly runId: string;

  // Unique and increasing within one run, so the run can be reconstructed in order even when
  // several runs are writing to the same file at once.
  readonly sequence: number;
  readonly recordedOn: string;
  readonly actor: string;
  readonly event: string;
  readonly payloadLength: number;
  readonly payloadSha256: string;

  // Empty unless the deployment opted into payload capture.
  readonly payload: string;
  readonly principal: string;
}

export function createAuditRecord(
  runId: string,
  sequence: number,
  recordedOn: Date,
  actor: string,
  event: string,
  payload: string,
  capturePayload = false,
  principal = "",
): AuditRecord {
  return {
    runId,
    sequence,
    recordedOn: recordedOn.toISOString(),
    actor,
    event,
    payloadLength: payload.length,
    payloadSha256: createHash("sha256").update(payload, "utf8").digest("hex"),
    payload: capturePayload ? payload : "",
    principal,
  };
}
