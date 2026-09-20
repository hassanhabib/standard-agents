// Nothing answered at all. A refused connection, a name that resolves to nothing, and a request
// that never got out of the machine all arrive the same way: fetch throws instead of answering,
// and there is no status to read because there was no response.
//
// It exists so that what fetch says to a programmer does not become what the library says to a
// person. "fetch failed" is true and tells nobody what to do next; the address and whatever is
// meant to be listening at it are the two things worth looking at, and this is where that sentence
// is written down.
//
// The last word, deliberately. Every tier above this one wraps a category written for a log, so a
// door showing somebody what happened reads the bottom of the chain, and a native fault left
// hanging off the end of it is what they would be shown instead of this. The fault itself is kept
// where it belongs for the people who need it: as the cause, and in the data beside it.
export class UnreachableBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "UnreachableBrainException";
    this.upsertDataList("cause", cause.message);
  }

  public upsertDataList(key: string, value: string): void {
    const values = this.data.get(key);

    if (values === undefined) {
      this.data.set(key, [value]);
    } else {
      values.push(value);
    }
  }
}
