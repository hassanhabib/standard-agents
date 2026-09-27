// The time utility broker (SPEC.md 4.1): the clock, so a service never reads it directly and a
// test can hand a service any moment it likes. And waiting, for the same reason: a service that
// waits on a real timer is a test that waits on one too.
export interface TimeBroker {
  getCurrentDateTime(): Date;
  delay(milliseconds: number, signal?: AbortSignal): Promise<void>;
}
