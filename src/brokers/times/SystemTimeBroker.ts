import type { TimeBroker } from "./TimeBroker.js";

export class SystemTimeBroker implements TimeBroker {
  public getCurrentDateTime(): Date {
    return new Date();
  }
}
