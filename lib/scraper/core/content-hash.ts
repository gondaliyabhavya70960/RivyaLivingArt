import { createHash } from 'node:crypto'

import { DRAFT_FIELDS, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'

/**
 * The hash `research_product_versions_unique_content` deduplicates on, and the exact thing it is
 * taken over.
 *
 * THE HASH IS OVER THE DRAFT, NOT OVER THE PAGE BODY, AND THAT IS THE WHOLE DECISION. Two fetches
 * of one product page a fortnight apart differ in a session id, a CSRF token, a rotating banner, a
 * "17 people are viewing this" counter and a build fingerprint in an asset URL — and in nothing a
 * merchandiser would call a change. `core/fetch.ts` hashes the BODY, which is the right hash for
 * its job (a snapshot key: two identical responses should cost one stored object) and exactly the
 * wrong one for this one. A version table keyed on the body hash would write four hundred versions
 * on a nightly run over four hundred unchanged pages, and Phase 29's "what changed" would become a
 * question about noise. Keyed on the draft, an unchanged product produces no row at all — the
 * `unique` constraint in `0250` enforces that at the row, so the rule holds against a bug in the
 * caller as well as against the caller doing it right.
 *
 * `confidence` AND `provenance` ARE EXCLUDED, AND THIS IS THE SUBTLE ONE. They describe how a value
 * was found, not what the source published. An adapter fix that starts reading a price from JSON-LD
 * where it used to fall back to a selector changes `provenance.priceText` from `'selector'` to
 * `'jsonld'` for every product on that source — while every price stays exactly what it was. If the
 * bookkeeping were hashed, the first run after that fix would write a new version for every product
 * in the source, and Phase 29 would report an entire catalogue as having changed on the day nothing
 * did. That is a false alarm of the worst kind: it is large, it is simultaneous, and it looks
 * enough like a real repricing to be believed. The provenance is still STORED on the version — it
 * is part of `raw` in the column — it simply is not part of the identity of an observation.
 *
 * WHICH MEANS THE HASH IS DEFINED AS "OVER `DRAFT_FIELDS`" rather than "over the draft minus two
 * keys", and `draftContentHash` builds it that way round on purpose. A third bookkeeping map added
 * to the draft later is then excluded by construction, rather than by whoever adds it remembering
 * to extend a list of exclusions in another file.
 *
 * THIS MODULE IS IN `core/`, NOT IN `adapters/`, AND THE PLACEMENT IS THE POINT. Hashing is the
 * core's judgement about when two observations are the same observation. An adapter that computed
 * its own content hash could decide that two different pages were one product — or that one page
 * was two — and the deduplication constraint would then be faithfully enforcing an adapter's
 * opinion about identity. `AdapterContext` offers no way to do it, and this is where the answer
 * lives instead.
 */

/**
 * JSON with every object's keys in a fixed order, at every depth.
 *
 * `JSON.stringify` PRESERVES INSERTION ORDER, WHICH IS THE BUG THIS FUNCTION EXISTS FOR. Two drafts
 * with identical values hash differently if one adapter set `title` before `priceText` and another
 * set them the other way round — and `withField` builds a draft by spreading, so insertion order is
 * literally the order the strategies happened to fire in. A source whose JSON-LD is intermittent
 * would then alternate between two hashes and write a new version on every other run, for a page
 * that never moved.
 *
 * IT MUST NOT SORT ARRAYS, AND THIS IS NOT AN OVERSIGHT. Image order is information: the first
 * image is the one a listing shows, and a gallery that has been re-ordered IS a change worth a
 * version. So is a specification list whose lines have moved, because the line order is how a
 * dimension is read back. Sorting them would make a redesigned page indistinguishable from an
 * unchanged one — the very failure the draft hash is here to avoid, arriving from the other side.
 *
 * THE COMPARATOR IS CODE-UNIT ORDER, NOT `localeCompare`, and the two must not be confused.
 * `listAdapterDescriptors` in `adapters/registry.ts` sorts with `localeCompare` because it is
 * building a list for a person to read. This sort feeds a hash that is stored in a database and
 * compared against for years: `localeCompare` depends on the runtime's locale and on its ICU data,
 * so a Node upgrade that shipped a new collation table would change the key order, change every
 * hash, and make every product in the system look like it had changed at once. `<` on strings is
 * fixed by the language.
 *
 * `undefined` VALUES ARE DROPPED, matching `JSON.stringify`, so an explicitly-absent provenance key
 * and a missing one hash identically. They mean the same thing and must not be two observations.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (typeof value === 'object') {
    const parts = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    return `{${parts.join(',')}}`
  }

  // A string, a number or a boolean. `JSON.stringify` returns `undefined` for a function or a
  // symbol, neither of which can appear in a parsed draft; `'null'` is the honest stand-in if one
  // ever reaches here through an unparsed object.
  return JSON.stringify(value) ?? 'null'
}

/**
 * SHA-256 over the fields the source published. Hex, lower case, sixty-four characters.
 *
 * SHA-256 RATHER THAN SOMETHING CHEAPER, matching `core/fetch.ts`. This value is a uniqueness key in
 * a table that grows for the life of the project, and a collision would silently merge two
 * different observations of one product into one — the second would simply not be written, and
 * nothing would say so. A non-cryptographic hash chosen for speed would be saving microseconds per
 * page against an HTML parse that costs milliseconds.
 */
export function draftContentHash(draft: RawProductDraft): string {
  const observed: Record<string, unknown> = {}
  for (const field of DRAFT_FIELDS) observed[field] = draft[field]

  return createHash('sha256').update(stableStringify(observed), 'utf8').digest('hex')
}
