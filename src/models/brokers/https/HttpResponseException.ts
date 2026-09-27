// What an HTTP broker throws when the resource answered with a failing status. It is the broker
// family's native error: a foundation localises it by status into its own dependency exceptions,
// so nothing above a foundation ever reads a status code.
//
// The Retry-After header travels with it, exactly as the resource sent it: a service that says how
// long to wait has said the one thing a person or a retry needs, and a broker that dropped the
// header dropped it. Reading it is the foundation's business, because it is a number or a date.
export class HttpResponseException extends Error {
  public readonly status: number;
  public readonly body: string;
  public readonly retryAfter: string | null;

  public constructor(status: number, body: string, retryAfter: string | null = null) {
    super(`HTTP ${status}`);
    this.name = "HttpResponseException";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}
