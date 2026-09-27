import { setTimeout as wait } from "node:timers/promises";

import type { TimeBroker } from "./TimeBroker.js";

export class SystemTimeBroker implements TimeBroker {
  public getCurrentDateTime(): Date {
    return new Date();
  }

  // The platform's own timer, which a stop cuts short by rejecting with an AbortError.
  public async delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    await wait(milliseconds, undefined, { signal });
  }
}
