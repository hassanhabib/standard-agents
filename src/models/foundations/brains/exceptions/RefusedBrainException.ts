// The service answered and would not take this connection's key: a 401 or a 403. The key, and
// which service it belongs to, are what to look at, and "HTTP 401" says neither.
//
// The last word, like UnreachableBrainException: the native fault is kept as the cause and in the
// data, and not as an inner error, so a door that reads the bottom of the chain reads this.
export class RefusedBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "RefusedBrainException";
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
