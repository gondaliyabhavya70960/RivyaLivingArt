import { z } from 'zod'

/**
 * The material vocabulary, as a value the normalizer is handed rather than a list it imports.
 *
 * DATA, NOT CODE, AND THE DIFFERENCE IS WHO CAN FIX IT. A hard-coded list means the first time a
 * competitor lists "microcement" the fix is a pull request, a review and a deploy — so it does not
 * happen, and the field quietly reads as unmatched for a year. `research_material_lexicon` is a
 * table with a Studio editor, and `scripts/research/renormalize.ts` rolls a change out over stored
 * versions with **no network traffic at all**: nothing is re-fetched, because the evidence is
 * already held.
 *
 * NOTHING HERE IS A CLAIM ABOUT WHAT RIVYA MAKES. These are words to recognise on somebody else's
 * page. A token appearing in this file is not a material Rivya works in and is never rendered on a
 * public surface.
 *
 * THE MODULE IS PURE. It takes the rows; it does not read them. `lib/supabase/repositories/research/
 * lexicon.ts` does the reading, and keeping the two apart is what makes every rule in `materials.ts`
 * testable against a fixture table with no database at all.
 */

export const lexiconEntrySchema = z
  .object({
    token: z
      .string()
      .regex(
        /^[a-z][a-z0-9_]*$/u,
        'A token is lower case, starts with a letter, and joins words with _.',
      ),
    /** Whole-word phrases, lower case. Matching is on word boundaries — see `materials.ts`. */
    patterns: z.array(z.string().trim().min(1).max(80)).min(1).max(20).readonly(),
    family: z.string().trim().min(1).max(40).nullable(),
    isEnabled: z.boolean(),
  })
  .strict()

export type LexiconEntry = z.infer<typeof lexiconEntrySchema>

export const lexiconSchema = z.array(lexiconEntrySchema).max(500).readonly()
export type Lexicon = z.infer<typeof lexiconSchema>

/**
 * Longest pattern first, and disabled rows dropped.
 *
 * ORDER IS THE SEMANTICS. `stainless steel` and `steel` both match "brushed stainless steel", and
 * the answer is the first, not both — a comparison listing a piece as steel AND stainless steel
 * double-counts it in every material breakdown. Sorting once here means `matchMaterials` can take
 * the first hit and stop, rather than every caller remembering to.
 */
export function prepareLexicon(
  entries: Lexicon,
): ReadonlyArray<{ token: string; pattern: string }> {
  const pairs: Array<{ token: string; pattern: string }> = []
  for (const entry of entries) {
    if (!entry.isEnabled) continue
    for (const pattern of entry.patterns) {
      const trimmed = pattern.trim().toLowerCase()
      if (trimmed !== '') pairs.push({ token: entry.token, pattern: trimmed })
    }
  }
  return pairs.sort((a, b) => b.pattern.length - a.pattern.length)
}
