import { open, mkdir, readdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { FileStat } from "../../models/brokers/files/FileStat.js";
import type { FileBroker } from "./FileBroker.js";

// The file system over node:fs. Straight passes, with two exceptions that are themselves
// primitives rather than decisions: an atomic write is a temporary neighbour renamed over the
// target, and a not-there path is reported as absence instead of as a fault.
export class NodeFileBroker implements FileBroker {
  public async readFile(path: string): Promise<string> {
    return await readFile(path, "utf8");
  }

  public async writeFile(path: string, content: string, mode?: number): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, mode === undefined ? { encoding: "utf8" } : { encoding: "utf8", mode });
  }

  public async writeFileAtomic(path: string, content: string, mode?: number): Promise<void> {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });

    // The neighbour is in the same directory because a rename is only atomic within one file
    // system, and a temporary directory elsewhere may not be on the same one.
    const temporaryPath = join(directory, `.${randomUUID()}.tmp`);

    try {
      const handle = await open(temporaryPath, "w", mode);

      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      await rename(temporaryPath, path);
    } catch (error: unknown) {
      await unlink(temporaryPath).catch(() => undefined);

      throw error;
    }
  }

  public async rename(from: string, to: string): Promise<void> {
    await rename(from, to);
  }

  public async unlink(path: string): Promise<void> {
    await unlink(path);
  }

  public async stat(path: string): Promise<FileStat | null> {
    try {
      const stats = await stat(path);

      return { size: stats.size, modifiedOn: stats.mtime, isDirectory: stats.isDirectory() };
    } catch {
      return null;
    }
  }

  public async readdir(path: string): Promise<readonly string[]> {
    try {
      return await readdir(path);
    } catch {
      return [];
    }
  }

  public async openExclusive(path: string, content: string, mode?: number): Promise<boolean> {
    await mkdir(dirname(path), { recursive: true });

    try {
      const handle = await open(path, "wx", mode);

      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      return true;
    } catch (error: unknown) {
      // Only "it was already there" is an answer; anything else is a fault worth raising.
      if (isAlreadyThere(error)) {
        return false;
      }

      throw error;
    }
  }

  public async realpath(path: string): Promise<string> {
    return await realpath(path);
  }

  public async fsync(path: string): Promise<void> {
    const handle = await open(path, "r");

    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
}

function isAlreadyThere(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "EEXIST";
}
