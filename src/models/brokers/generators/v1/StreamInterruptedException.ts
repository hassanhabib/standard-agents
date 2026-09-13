// A streamed turn that did not finish (PLAN.md 5.1). Truncated means the socket closed before the
// terminal frame, which is never an answer however much content had arrived; failed means the
// provider sent an error frame instead of finishing. Both end the turn, and the tier above decides
// whether to retry, so the reason travels with the exception rather than inside its prose.
export type StreamInterruption = "truncated" | "failed";

export class StreamInterruptedException extends Error {
  public readonly data: Map<string, string[]> = new Map();
  public readonly reason: StreamInterruption;

  public constructor(reason: StreamInterruption, message: string) {
    super(message);
    this.name = "StreamInterruptedException";
    this.reason = reason;
  }
}
