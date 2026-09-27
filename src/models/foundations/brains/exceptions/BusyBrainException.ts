// The service is taking too many requests and asked this one to wait: a 429. How long it asked
// for, when it said, is the one number worth giving whoever is waiting.
//
// The last word, like UnreachableBrainException: the native fault is kept as the cause and in the
// data, and not as an inner error, so a door that reads the bottom of the chain reads this.
export class BusyBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "BusyBrainException";
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
