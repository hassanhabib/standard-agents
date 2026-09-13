// The session store's native refusal: a write based on a read that is no longer current. The
// foundation localises it into StaleSessionException; the loop re-reads and tries again.
export class StaleSessionWriteError extends Error {
  public readonly sessionId: string;
  public readonly storedVersion: number;
  public readonly attemptedVersion: number;

  public constructor(sessionId: string, storedVersion: number, attemptedVersion: number) {
    super(`session '${sessionId}' is at version ${storedVersion}; a write at version ${attemptedVersion} is stale`);
    this.name = "StaleSessionWriteError";
    this.sessionId = sessionId;
    this.storedVersion = storedVersion;
    this.attemptedVersion = attemptedVersion;
  }
}
