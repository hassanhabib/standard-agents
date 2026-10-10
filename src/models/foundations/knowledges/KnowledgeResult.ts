// A passage, with where it came from and how well it matched (SPEC.md 3.7, v1.18). The text is
// exactly what an unsourced broker returns and exactly what the Brain is shown; the score and the
// source travel beside it. A score compares only within one source, and an empty source means the
// passage's origin is unknown, so it is never cited.
export interface KnowledgeResult {
  readonly text: string;
  readonly score: number | null;
  readonly source: string;
}
