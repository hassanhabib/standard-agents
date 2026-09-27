// The service is there and cannot answer right now: a 502, 503 or 504 from it or the gateway in front
// of it, or a 408. Waiting is usually the whole remedy, and how long, when it said, is kept.
//
// The last word, like UnreachableBrainException: the native fault is kept as the cause and in the
// data, and not as an inner error, so a door that reads the bottom of the chain reads this.
export class UnavailableBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "UnavailableBrainException";
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
