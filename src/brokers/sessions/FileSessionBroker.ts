import { createHash } from "node:crypto";
import { join } from "node:path";

import type { AgentSession } from "../../models/brokers/sessions/AgentSession.js";
import { StaleSessionWriteError } from "../../models/brokers/sessions/StaleSessionWriteError.js";
import type { FileBroker } from "../files/FileBroker.js";
import type { SessionBroker } from "./SessionBroker.js";

// Sessions on disk, one file each (SPEC.md 4.11, PLAN.md 4.7). This is what makes a paused run
// resumable by a different process, and the desktop and the terminal readable to each other: the
// session is not in either app, it is in the folder they share.
//
// Three rules, and each is here because the alternative loses a turn someone completed. The name
// is a hash, so a session id that is a path, a reserved name or four hundred characters cannot
// escape the folder or fail to be written. The write is atomic, so a reader never sees half a
// session. The version is checked against what is stored, so a writer working from a stale read
// is refused rather than allowed to erase the turn that landed in between.
export class FileSessionBroker implements SessionBroker {
  private readonly fileBroker: FileBroker;
  private readonly sessionsPath: string;
  private readonly writesInFlight = new Map<string, Promise<unknown>>();

  public constructor(fileBroker: FileBroker, sessionsPath: string) {
    this.fileBroker = fileBroker;
    this.sessionsPath = sessionsPath;
  }

  public async selectSession(sessionId: string): Promise<AgentSession | null> {
    return await this.readSession(sessionId);
  }

  public async upsertSession(session: AgentSession): Promise<void> {
    // One in-process lock per session, so two runs in this process take turns instead of
    // interleaving a read with each other's write. Between processes the version check is what
    // holds the line; within one, this keeps the check from being raced past.
    await this.serialize(session.id, async () => {
      const stored = await this.readSession(session.id);
      const storedVersion = stored?.version ?? 0;

      if (session.version !== storedVersion + 1) {
        throw new StaleSessionWriteError(session.id, storedVersion, session.version);
      }

      await this.fileBroker.writeFileAtomic(this.pathOf(session.id), `${JSON.stringify(session, null, 2)}\n`);
    });
  }

  // The name on disk is a hash, so the ids cannot be read back from it. They come from the files
  // themselves, and a file that cannot be read or parsed is passed over rather than allowed to
  // fail the whole listing: one damaged session must not hide the rest.
  public async selectSessionIds(): Promise<readonly string[]> {
    const ids: string[] = [];

    for (const entry of await this.fileBroker.readdir(this.sessionsPath)) {
      if (!entry.endsWith(".json") || entry.endsWith(".meta.json")) {
        continue;
      }

      try {
        const session = JSON.parse(await this.fileBroker.readFile(join(this.sessionsPath, entry))) as AgentSession;

        if (typeof session.id === "string" && session.id.length > 0) {
          ids.push(session.id);
        }
      } catch {
        continue;
      }
    }

    return ids;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.serialize(sessionId, async () => {
      const path = this.pathOf(sessionId);

      if ((await this.fileBroker.stat(path)) !== null) {
        await this.fileBroker.unlink(path);
      }
    });
  }

  private async readSession(sessionId: string): Promise<AgentSession | null> {
    const path = this.pathOf(sessionId);

    if ((await this.fileBroker.stat(path)) === null) {
      return null;
    }

    return JSON.parse(await this.fileBroker.readFile(path)) as AgentSession;
  }

  private async serialize<T>(sessionId: string, work: () => Promise<T>): Promise<T> {
    // The next writer waits behind this one however this one ends, which is why the same routine
    // is both the fulfilled and the rejected continuation.
    const queued = (this.writesInFlight.get(sessionId) ?? Promise.resolve()).then(work, work);
    const tracked = queued.catch(() => undefined);
    this.writesInFlight.set(sessionId, tracked);

    try {
      return await queued;
    } finally {
      // Dropped only when nobody queued behind it, so a long lived process does not hold an entry
      // for every session it ever wrote.
      if (this.writesInFlight.get(sessionId) === tracked) {
        this.writesInFlight.delete(sessionId);
      }
    }
  }

  private pathOf(sessionId: string): string {
    return join(this.sessionsPath, `${createHash("sha256").update(sessionId, "utf8").digest("hex")}.json`);
  }
}
