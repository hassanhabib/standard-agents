// The ranking partial: retrieval answers "what is relevant to this task", not "what exists"
// (SPEC.md 4.2).
//
// This is lexical scoring: terms in common, rarer terms worth more, shorter passages preferred so
// a long document cannot win by being long. It is deliberately dependency-free, because it is the
// Local mode; a broker backed by full-text search or embeddings is the External one, and the
// contract above it does not change either way. Every constant and rule here is the reference's,
// so a folder ranks the same in every implementation.

const PASSAGE_WORD_COUNT = 120;
const PASSAGE_STRIDE_WORDS = 60;

const TERM_SEPARATORS = /[ \t\n\r.,;:!?"'()[\]\-/]+/;

// Words too common to say anything about relevance. Kept short on purpose: a longer list is a
// language model of its own, and this is meant to stay readable.
const NOISE_TERMS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "did", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "in", "is", "it", "its", "me", "my",
  "of", "on", "or", "our", "so", "that", "the", "their", "them", "then", "there",
  "these", "they", "this", "to", "was", "we", "what", "when", "where", "which", "who",
  "why", "will", "with", "you", "your",
]);

export function terms(text: string): string[] {
  return text
    .split(TERM_SEPARATORS)
    .map((term) => term.toLowerCase())
    .filter((term) => term.length > 1 && !NOISE_TERMS.has(term));
}

// Overlapping windows, so an answer that straddles a boundary is still found whole by one of
// them. The cost is that two neighbouring passages may both match; the ranking then picks
// whichever carries more of the query.
export function passages(document: string): string[] {
  const words = document.split(/\s+/).filter((word) => word.length > 0);

  if (words.length <= PASSAGE_WORD_COUNT) {
    return [document.trim()];
  }

  const windows: string[] = [];

  for (let start = 0; start < words.length; start += PASSAGE_STRIDE_WORDS) {
    windows.push(words.slice(start, start + PASSAGE_WORD_COUNT).join(" "));

    if (start + PASSAGE_WORD_COUNT >= words.length) {
      break;
    }
  }

  return windows;
}

// How many documents each term appears in, so a term common to the whole corpus counts for less
// than one that singles a document out.
export function documentFrequencies(documents: readonly string[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();

  for (const document of documents) {
    for (const term of new Set(terms(document))) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  return documentFrequency;
}

// Score = how many query terms appear, each weighted by how rare it is across the corpus, divided
// by the square root of the passage length. Rarity is what makes "refund" count for more than
// "policy" when every document mentions policy; the length penalty is what stops a long passage
// winning simply by containing more words.
export function score(
  queryTerms: readonly string[],
  passage: string,
  documentFrequency: ReadonlyMap<string, number>,
  documentCount: number,
): number {
  const passageTerms = terms(passage);

  if (passageTerms.length === 0) {
    return 0;
  }

  const passageTermSet = new Set(passageTerms);
  let total = 0;

  for (const queryTerm of new Set(queryTerms)) {
    if (!passageTermSet.has(queryTerm)) {
      continue;
    }

    const seenIn = documentFrequency.get(queryTerm) ?? 1;
    total += Math.log(1 + documentCount / seenIn);
  }

  return total / Math.sqrt(passageTerms.length);
}

// Whether a file name is one the folder's pattern names: "*" is any run of characters and "?" is
// one, matched against the whole name and regardless of case, so "*.md" finds "README.MD" on
// every platform.
export function matchesPattern(name: string, pattern: string): boolean {
  const expression = pattern
    .split("")
    .map((character) => (character === "*" ? ".*" : character === "?" ? "." : character.replace(/[.+^${}()|[\]\\]/g, "\\$&")))
    .join("");

  return new RegExp(`^${expression}$`, "i").test(name);
}
