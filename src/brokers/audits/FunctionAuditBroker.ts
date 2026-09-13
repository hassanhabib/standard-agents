import type { AuditRecord } from "../../models/brokers/audits/AuditRecord.js";
import type { AuditBroker } from "./AuditBroker.js";

// The Custom mode of the decision log (SPEC.md 4.8): the host's own sink, which is how a
// deployment ships records to somewhere other than a file, and how the conformance runner watches
// the log through its real seam rather than off to the side.
export class FunctionAuditBroker implements AuditBroker {
  private readonly write: (record: AuditRecord) => Promise<void>;

  public constructor(write: (record: AuditRecord) => Promise<void>) {
    this.write = write;
  }

  public async insertRecord(record: AuditRecord): Promise<void> {
    await this.write(record);
  }
}
