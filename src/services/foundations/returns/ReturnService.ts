import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import { createTryCatch, type TryCatch } from "./ReturnService.Exceptions.js";
import { validatePayload } from "./ReturnService.Validations.js";

// The Direction nature's return foundation (SPEC.md 8.1): the documented pure routine over no
// broker. Its whole job is to refuse an empty answer, so a run never ends Responded with nothing.
export class ReturnService {
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(loggingBroker: LoggingBroker) {
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public return(payload: string): Promise<string> {
    return this.tryCatch(async () => {
      validatePayload(payload);

      return payload;
    });
  }
}
