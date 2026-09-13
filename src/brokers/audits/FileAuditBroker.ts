import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { AuditRecord } from "../../models/brokers/audits/AuditRecord.js";
import type { AuditBroker } from "./AuditBroker.js";

// The decision log as one JSON line per record. Appended rather than rewritten, so several runs
// in one process and several processes over one workspace can all write without any of them
// holding the file or reading what the others put there.
//
// Writes are serialized in this process, because two appends racing can interleave inside one
// line and a half-written line is a record nobody can read.
export class FileAuditBroker implements AuditBroker {
  private readonly path: string;
  private appending: Promise<unknown> = Promise.resolve();

  public constructor(path: string) {
    this.path = path;
  }

  public async insertRecord(record: AuditRecord): Promise<void> {
    this.appending = this.appending.then(
      async () => await this.append(record),
      async () => await this.append(record),
    );

    await this.appending;
  }

  private async append(record: AuditRecord): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(record)}\n`, "utf8");
  }
}
