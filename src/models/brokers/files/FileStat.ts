// What the file system says about a path, reduced to what any caller here needs. Null rather than
// a thrown error is how a broker reports a path that is not there, because absence is an ordinary
// answer to asking about a file and not a failure to ask.
export interface FileStat {
  readonly size: number;
  readonly modifiedOn: Date;
  readonly isDirectory: boolean;
}
