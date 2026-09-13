import type { FileStat } from "../../models/brokers/files/FileStat.js";

// The file system, as primitives only (SPEC.md 4.1). A broker forwards; every rule about which
// paths may be touched, what a file means and when it may be replaced belongs above this line.
// The list is deliberately small and boring, because a primitive that decides something is a
// service wearing a broker's name.
export interface FileBroker {
  readFile(path: string): Promise<string>;

  writeFile(path: string, content: string, mode?: number): Promise<void>;

  // Written whole or not at all: a temporary neighbour, flushed, then renamed over the target,
  // because a reader must never see half a file and a crash must not leave one. The parent
  // directory is created when it is missing, since a temporary neighbour needs somewhere to be.
  writeFileAtomic(path: string, content: string, mode?: number): Promise<void>;

  rename(from: string, to: string): Promise<void>;

  unlink(path: string): Promise<void>;

  // Null when the path is not there. Absence is an answer, not a fault.
  stat(path: string): Promise<FileStat | null>;

  // The entry names of a directory, or nothing when it is not there.
  readdir(path: string): Promise<readonly string[]>;

  // Creates the file only if it does not exist, and says which happened. This is the claim
  // primitive: the file system's own exclusive create is the only thing here that two processes
  // can race on and exactly one can win.
  openExclusive(path: string, content: string, mode?: number): Promise<boolean>;

  // The path with every link resolved, which is what a boundary check must be made against.
  realpath(path: string): Promise<string>;

  // Flushes a path's contents to the device. A rename is only as durable as the bytes it renamed.
  fsync(path: string): Promise<void>;
}
