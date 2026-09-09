import { z } from 'zod'

/**
 * Owner verification, applied to an ITEM inside a block's payload rather than to the section.
 *
 * WHY TWO MECHANISMS FOR ONE RULE. `page_sections.owner_verification` is a column, and the Phase 08
 * publish trigger refuses to move a flagged row to `PUBLISHED` — that is the whole section
 * withheld, and it is the right shape when the entire claim is the section. It is the wrong shape
 * when a published section contains ONE claim among several: the homepage's category grid lists
 * five families, and two of them ("3D + Resin", "Architectural Pieces") assert capabilities nobody
 * has confirmed. Withholding the section would take the other three with it; withholding nothing
 * would put an unverified claim on the front page. So the flag moves inside the payload, to the
 * entry.
 *
 * A `select` OVER `page_sections` IS STRUCTURALLY BLIND TO THIS, which is why the phase document
 * asserts the two levels with two different queries and why this module exists at all rather than
 * the check being a `filter` written out in each renderer. The rule is one rule; if it lived in
 * ten renderers, the eleventh would be written without it and nothing would say so.
 *
 * ABSENT MEANS NOT REQUIRED, and that is a deliberate reading rather than an oversight. Every
 * payload seeded before this field existed omits it, and treating an omission as "withheld" would
 * empty most of the site the moment the field shipped. The claim a flag makes is positive — "this
 * needs checking" — so its absence is the ordinary case.
 *
 * WHAT STOPS THAT DEFAULT FROM HIDING AN UNFLAGGED CLAIM is a test over the seed modules
 * (`tests/unit/entry-verification.test.ts`), not a scanner over prose. A scanner would need a list
 * of capability words, and a list of capability words is either so short it misses the next claim
 * or so long it reports the whole site — either way it becomes a gate people learn to skip. The
 * test instead asserts the things that ARE decidable: every repeating entry carries a `key`, keys
 * are unique inside their section, and the entries the specification names as withheld are still
 * flagged. Adding a card without a key or quietly unflagging one fails the build; judging whether
 * new prose is a capability claim stays with the person writing it, which is where it belongs.
 */

/** The three states, matching `owner_verification` in the database exactly. */
export const entryVerificationSchema = z
  .enum(['NOT_REQUIRED', 'OWNER_VERIFICATION_REQUIRED', 'VERIFIED'])
  .optional()

export type EntryVerification = z.infer<typeof entryVerificationSchema>

/**
 * The shape every repeating payload item shares once it can be withheld.
 *
 * `key` IS REQUIRED AND IS NOT THE ARRAY INDEX. The index shifts when an editor reorders or
 * removes an item, so an index-addressed test asserts about whatever happens to sit in that
 * position — which is exactly the assertion that keeps passing after the thing it was written for
 * has moved. `data-entry-key` in the rendered markup carries this value, and the phase's own
 * verification feeds the withheld keys straight from SQL into the Playwright spec.
 */
export const verifiableEntryFields = {
  key: z.string().min(1),
  owner_verification: entryVerificationSchema,
} as const

/**
 * What the filter reads, and ONLY what it reads.
 *
 * `key` is deliberately absent from this type even though every verifiable entry carries one. The
 * filter's question is "may this be shown", and the answer depends on one field; requiring `key`
 * here would make `visibleEntries` reject a payload whose cards predate the field — the schemas
 * keep `key` optional precisely so old rows still parse, and a narrower type is what lets the two
 * agree. The key's job is addressing a rendered entry from a test, which is the renderer's
 * business rather than this function's.
 */
export type VerifiableEntry = {
  readonly owner_verification?: EntryVerification
}

/**
 * May this entry be rendered to a visitor?
 *
 * VERIFIED AND NOT_REQUIRED BOTH PASS, and they are not the same statement: `NOT_REQUIRED` says
 * the entry makes no claim that needs checking, `VERIFIED` says it makes one and the owner has
 * confirmed it. Only `OWNER_VERIFICATION_REQUIRED` — a claim awaiting confirmation — is withheld.
 */
export function isEntryVisible(entry: VerifiableEntry): boolean {
  return entry.owner_verification !== 'OWNER_VERIFICATION_REQUIRED'
}

/**
 * The entries a renderer may draw.
 *
 * EVERY REPEATING RENDERER CALLS THIS AND NONE FILTERS INLINE. A renderer that wrote
 * `cards.filter((c) => c.owner_verification !== 'OWNER_VERIFICATION_REQUIRED')` would be correct
 * and would also be the tenth copy of a rule, with the eleventh written from memory.
 */
export function visibleEntries<T extends VerifiableEntry>(entries: readonly T[]): readonly T[] {
  return entries.filter(isEntryVisible)
}
