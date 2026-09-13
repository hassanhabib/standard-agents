// What the ledger says about an act the run is about to perform (SPEC.md 4.9). Proceed: the
// claim is this run's and the act may run. Replay: already performed and recorded, so the
// recorded outcome is replayed and nothing is performed. InProgress: another run holds a live
// claim, so the Brain is told and nothing is performed. Unreconciled: an earlier attempt with no
// usable outcome (a claim past its lease, a failed tool, a compensation in flight or done);
// whether the world changed is unknown, so the run is held until a person reconciles the ledger.
export type EffectClaimVerdict = "Proceed" | "Replay" | "InProgress" | "Unreconciled";
