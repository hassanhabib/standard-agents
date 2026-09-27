// The service took the request and said nothing back in time: no first piece of the answer within
// the wait a streamed turn allows. Not unreachable, because something took the connection; slow
// enough that waiting longer is a guess, and the person should be told rather than left watching.
export class TimedOutBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "TimedOutBrainException";
  }
}
