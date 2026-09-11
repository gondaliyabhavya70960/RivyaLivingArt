/**
 * What a research bulk form may say, decided away from the Server Action that reads it.
 *
 * **A `'use server'` MODULE CAN EXPORT NOTHING BUT ASYNC FUNCTIONS**, so a helper defined inside one
 * is private to it and cannot be tested. These three decisions are exactly the ones worth testing —
 * which screen may be redirected to, which query keys survive a round trip, and which parameter
 * each operation collects — so they live here, as ordinary functions over strings, and
 * `app/(studio)/studio/(shell)/research/bulk-actions.ts` calls them.
 *
 * NO SUPABASE CLIENT, NO `next/*` IMPORT, NO I/O. That is what lets the unit project prove them
 * with no database, and what keeps the redirect rule in a file a person can read in one sitting.
 */

/**
 * Where a selection may be made, and therefore the only paths this module will navigate to.
 *
 * AN ALLOWLIST BECAUSE THE VALUE BECOMES A REDIRECT. A path read from a form and handed to
 * `redirect` is an open redirect; nothing outside these two strings is ever returned.
 */
export const RESEARCH_BULK_SURFACES = [
  '/studio/research/large-format',
  '/studio/research/changes',
] as const

export type ResearchBulkSurface = (typeof RESEARCH_BULK_SURFACES)[number]

export function researchBulkSurface(raw: unknown): ResearchBulkSurface | null {
  return typeof raw === 'string' && (RESEARCH_BULK_SURFACES as readonly string[]).includes(raw)
    ? (raw as ResearchBulkSurface)
    : null
}

/**
 * The filter keys the two surfaces read, carried through a preview and back again.
 *
 * A CLOSED SET RATHER THAN "whatever was in the query string": the value is rebuilt into a new
 * `URLSearchParams` from these keys only, so a crafted `filters` field cannot smuggle a second
 * path, a fragment or another `operation` into the redirect that follows.
 */
export const RESEARCH_FILTER_KEYS = [
  'source',
  'band',
  'currency',
  'large',
  'field',
  'materiality',
  'decided',
  'age',
] as const

export function researchBulkQuery(raw: unknown): URLSearchParams {
  const parsed = new URLSearchParams(typeof raw === 'string' ? raw : '')
  const out = new URLSearchParams()
  for (const key of RESEARCH_FILTER_KEYS) {
    const value = parsed.get(key)
    if (value !== null && value.trim() !== '') out.set(key, value.trim())
  }
  return out
}

/**
 * One operation's parameters, from the controls that collect them.
 *
 * BUILT FROM NAMED FIELDS RATHER THAN A JSON BLOB. A reason, a surviving row and a tag are things a
 * person types into a labelled control; posting them as a JSON string would make the form unusable
 * without JavaScript and would turn a Zod message naming a field into "invalid JSON", which tells
 * an operator nothing.
 *
 * IT VALIDATES NOTHING, DELIBERATELY. Each operation's own Zod schema is the judge — a reason
 * shorter than three characters, a survivor that is not a uuid — and a second opinion here would be
 * a second set of rules to keep in step with the first.
 */
export function researchBulkParams(
  kind: string,
  read: (field: string) => string,
): Record<string, unknown> {
  switch (kind) {
    case 'research.reject':
      return { reason: read('reason') }
    case 'research.mark_duplicate':
      return { survivingProductId: read('surviving_product_id') }
    case 'research.set_tags':
      return { tagId: read('tag_id'), remove: read('remove') === 'true' }
    default:
      // An operation with no parameters of its own. `noParams` is `.strict()`, so returning
      // anything here would fail the schema rather than be ignored.
      return {}
  }
}
