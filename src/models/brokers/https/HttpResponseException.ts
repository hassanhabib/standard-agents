// What an HTTP broker throws when the resource answered with a failing status. It is the broker
// family's native error: a foundation localises it by status into its own dependency exceptions,
// so nothing above a foundation ever reads a status code.
export class HttpResponseException extends Error {
  public readonly status: number;
  public readonly body: string;

  public constructor(status: number, body: string) {
    super(`HTTP ${status}`);
    this.name = "HttpResponseException";
    this.status = status;
    this.body = body;
  }
}
