// Nothing answered at all. A refused connection, a name that resolves to nothing, and a request
// that never got out of the machine all arrive the same way: fetch throws instead of answering,
// and there is no status to read because there was no response.
//
// It exists so that what fetch says to a programmer does not become what the library says to a
// person. "fetch failed" is true and tells nobody what to do next; the address and whatever is
// meant to be listening at it are the two things worth looking at, and this is where that sentence
// is written down.
export class UnreachableBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();
  public readonly innerError: Error;

  public constructor(message: string, innerError: Error) {
    super(message, { cause: innerError });
    this.name = "UnreachableBrainException";
    this.innerError = innerError;
  }
}
