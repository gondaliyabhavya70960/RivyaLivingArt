/**
 * `pg_trgm.similarity`, in TypeScript, to its actual definition.
 *
 * WHY NOT ASK POSTGRESQL. The obvious implementation is `select similarity(a, b)`, and it would be
 * a network round trip per pair on an O(n²) comparison within a source — thousands of queries to
 * answer a question that is arithmetic on two strings. Worse, it would make the rule untestable
 * without a database, and this is the rule most likely to be argued about: in Phase 28 when it
 * merges the wrong two rows, and in Phase 29 when it calls a rewritten product title a minor
 * change. The trigram index on `title_normalized` still exists and is what a Phase 31 query will
 * use; this is the in-process version for the matcher's and the detector's own loops.
 *
 * THE PADDING IS pg_trgm's, NOT A SIMPLIFICATION. It splits on non-alphanumerics, prefixes each
 * word with two spaces and suffixes one, and takes every 3-gram of the result — so "oak" yields
 * `"  o"`, `" oa"`, `"oak"`, `"ak "`. Getting that wrong would produce numbers that look like
 * similarities and do not match what the database would say about the same pair, which is the worst
 * kind of wrong: plausible and inconsistent.
 *
 * IT LIVES IN `core/` BECAUSE TWO SUBSYSTEMS NEED IT. Phase 28's matcher had it inline; Phase 29's
 * materiality rules need the same function for `title` and `description`, and analytics importing
 * from workflows would be the dependency arrow pointing the wrong way. `match.ts` re-exports it so
 * nothing that already imported it there has to change.
 */
export function trigramSet(value: string): ReadonlySet<string> {
  const words = value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word !== '')

  const grams = new Set<string>()
  for (const word of words) {
    const padded = `  ${word} `
    for (let index = 0; index + 3 <= padded.length; index += 1) {
      grams.add(padded.slice(index, index + 3))
    }
  }
  return grams
}

export function trigramSimilarity(a: string, b: string): number {
  const left = trigramSet(a)
  const right = trigramSet(b)
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const gram of left) if (right.has(gram)) shared += 1

  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}
