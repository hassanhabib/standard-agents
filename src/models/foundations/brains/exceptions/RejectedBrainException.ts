// The service turned the request down for a reason of its own: a 4xx that is not a key, an address,
// or an overload. The reason it gave, when it gave one in words, is the part worth reading.
//
// The last word, like UnreachableBrainException: the native fault is kept as the cause and in the
// data, and not as an inner error, so a door that reads the bottom of the chain reads this.
export class RejectedBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "RejectedBrainException";
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
