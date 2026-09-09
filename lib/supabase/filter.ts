/**
 * PostgREST filter values, escaped for the two grammars they pass through.
 *
 * A SEARCH BOX IS NOT A STRING SUBSTITUTION, and treating it as one is how a comma became a query
 * operator twice in this repository. `query.or('title.ilike.%' + term + '%,slug.ilike.…')` builds a
 * sentence in PostgREST's filter language, and the term lands in the middle of it un-parsed.
 *
 * THERE ARE TWO GRAMMARS STACKED HERE AND THEY ESCAPE DIFFERENTLY.
 *
 *   1. PostgREST's `or=(…)` list. `,` separates conditions and `)` closes the group. A term
 *      containing either does not match a product with a comma in its title — it changes what the
 *      query ASKS. `blue, small)` turns into the condition `title.ilike.%blue`, a second condition
 *      `small`, which is not a valid condition, and a stray paren; PostgREST answers 400 and the
 *      Studio's product list is a server error until the editor deletes the character.
 *
 *      A BACKSLASH DOES NOT ESCAPE A COMMA HERE. `lib/supabase/repositories/media.ts` tried
 *      `replace(/[%,]/g, '\\$&')` and its comment claimed that was the fix; the value still split
 *      on the comma, because PostgREST's only quoting mechanism for a reserved character is a
 *      DOUBLE-QUOTED value, inside which `"` and `\` are backslash-escaped. So the value is
 *      wrapped rather than character-escaped.
 *
 *   2. SQL's `LIKE` pattern, which is what survives layer 1. `%` matches anything and `_` matches
 *      one character, so an un-escaped search for `50%` matches every row, and `a_b` matches `axb`.
 *      Postgres's default escape character is a backslash, so a literal `%` is sent as `\%` and a
 *      literal backslash as `\\`.
 *
 * THE ORDER IS FIXED AND CANNOT BE SWAPPED. Layer 2 runs first and introduces backslashes; layer 1
 * then escapes those backslashes for transport. Doing it the other way round would let layer 2's
 * own escapes be eaten by layer 1's unescaping, and `50%` would go back to matching everything:
 *
 *     "50%"  →  layer 2  →  50\%    →  layer 1  →  "%50\\%%"
 *                                        PostgREST unquotes  →  %50\%%
 *                                        ilike pattern       →  matches a literal "50%"
 *
 * `.ilike()` ON ITS OWN NEEDS NONE OF LAYER 1, because a top-level `title=ilike.<value>` is
 * delimited by `&` rather than by commas — which is why `searchProductsByTitle` escapes only the
 * pattern and is correct as it stands.
 */

/** Layer 2: a term as a literal inside a `LIKE`/`ILIKE` pattern. */
export function escapeLikePattern(term: string): string {
  return term.replace(/([\\%_])/g, '\\$1')
}

/**
 * Both layers: a term as a complete, quoted `ilike` value matching anywhere in the column.
 *
 * The returned string INCLUDES its surrounding double quotes and its `%` wildcards, so a caller
 * writes `` `title.ilike.${containsValue(term)}` `` and adds nothing of its own. Returning a bare
 * value and leaving the quoting to each call site is what let the two existing sites diverge.
 */
export function containsValue(term: string): string {
  const pattern = `%${escapeLikePattern(term)}%`
  return `"${pattern.replace(/(["\\])/g, '\\$1')}"`
}
