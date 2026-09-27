// The service answered with a fault of its own: a 5xx that is not a gateway or an overload. Trying
// again may pass; a fault that keeps coming back is the service's to fix, and that is worth saying.
//
// The last word, like UnreachableBrainException: the native fault is kept as the cause and in the
// data, and not as an inner error, so a door that reads the bottom of the chain reads this.
export class FaultedBrainException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "FaultedBrainException";
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
