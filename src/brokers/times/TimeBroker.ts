// The time utility broker (SPEC.md 4.1): the clock, so a service never reads it directly and a
// test can hand a service any moment it likes.
export interface TimeBroker {
  getCurrentDateTime(): Date;
}
