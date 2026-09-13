import type { AuditRecord } from "../../models/brokers/audits/AuditRecord.js";

// The decision log's sink (SPEC.md 4.7). Append only: a record that has been written is never
// rewritten and never removed, because a log that can be edited proves nothing about the run it
// describes.
export interface AuditBroker {
  insertRecord(record: AuditRecord): Promise<void>;
}
