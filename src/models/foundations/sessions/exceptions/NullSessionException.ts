export class NullSessionException extends Error {
  public readonly data: Map<string, string[]> = new Map();

  public constructor(message: string) {
    super(message);
    this.name = "NullSessionException";
  }

  public upsertDataList(key: string, value: string): void {
    const values = this.data.get(key);

    if (values === undefined) {
      this.data.set(key, [value]);
    } else {
      values.push(value);
    }
  }

  public throwIfContainsErrors(): void {
    if (this.data.size > 0) {
      throw this;
    }
  }
}
