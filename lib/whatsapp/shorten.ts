import type { TemplateName, TokenValues } from './templates'

/**
 * Keeping a rendered message inside what a `wa.me` URL can carry — the five-level ladder.
 *
 * WHY THERE IS A CAP AT ALL. `https://wa.me/<number>?text=<message>` puts the whole message in a
 * query string, percent-encoded — a newline costs three characters, an emoji up to twelve. A long
 * brief therefore does not fail loudly: browsers, and the WhatsApp clients behind them, truncate or
 * reject an over-long URL, so the customer arrives at a chat with half a sentence in it, or none.
 * Nothing is logged and nothing is thrown.
 *
 * 1800 CHARACTERS OF ENCODED URL, deliberately conservative. There is no standard limit; the
 * practical floors are old Internet Explorer at 2 083 and a handful of proxies at 2 048. The margin
 * leaves room for the origin, the number and the query key without arithmetic at each call site.
 *
 * THE ORDER OF SACRIFICE IS FIXED, AND EACH RUNG GIVES UP MORE THAN THE LAST. Phase 10 built a
 * two-step version — truncate the longest field, then drop optional blocks — and Phase 20 replaces
 * it with the ladder the phase document specifies, because "the longest field" is not the same as
 * "the least valuable field": a 400-character requirements note is the most valuable thing in the
 * message and was the first thing the old version cut.
 *
 *   1. Drop lines whose tokens all resolved to empty. Pure hygiene: `City:` with no city.
 *   2. Keep the first eight summary items and say how many more there are.
 *   3. Truncate the visitor's notes to 300 characters, on a word boundary.
 *   4. Replace the reference URLs with a count.
 *   5. Keep the essentials only — what the piece is, who it is from, where, and the reference code.
 *
 * `inquiry_id` IS NEVER SHORTENED AND NEVER DROPPED, at any rung. It is the human-readable
 * reference code, and it is what lets the owner find the full brief in Studio — which is exactly
 * what makes the rest of the message disposable. Levels 2 and 4 name it in their replacement text
 * for the same reason: the sentence that says something was left out must say where to find it.
 *
 * LEVEL 5 INVENTS NO WORDS. It re-renders the SAME template with the non-essential tokens emptied
 * and the empty lines dropped, so every word in the message still comes from `global_content` and
 * the studio's own vocabulary. A hardcoded "short form" here would be marketing copy in JavaScript.
 */

/** Encoded length, not character count: `wa.me` carries the message percent-encoded. */
export const MAX_ENCODED_URL_LENGTH = 1800

/** The one token that is never shortened and never dropped. */
export const PROTECTED_TOKEN = 'inquiry_id'

/** Level 2's ceiling: eight lines is a brief somebody reads, not a document they scroll. */
const SUMMARY_ITEM_LIMIT = 8

/** Level 3's ceiling. Long enough to carry a real sentence, short enough to be a fifth of the cap. */
const NOTES_LIMIT = 300

const ELLIPSIS = '…'

export type ShortenLevel = 1 | 2 | 3 | 4 | 5

export type ShortenResult = {
  readonly values: TokenValues
  /** The rendered message, after any line-dropping this ladder did. */
  readonly message: string
  /** Which rung fired, or `null` when the message fitted as written. */
  readonly level: ShortenLevel | null
  /** True when the message still exceeds the cap after every rung. The link is still built. */
  readonly overLimit: boolean
}

/**
 * What each template keeps at level 5.
 *
 * The phase document's list is "greeting, product or project type, name, phone, city, enquiry id".
 * The greeting is not a token — it is the template's own opening line, which survives because it
 * has no token to empty. The rest is this.
 */
const ESSENTIAL: Record<TemplateName, readonly string[]> = {
  inquiry: ['product_or_project', 'customer_name', 'phone', 'city', PROTECTED_TOKEN],
  commission: ['project_type', 'city', PROTECTED_TOKEN],
}

function encodedLength(urlPrefixLength: number, message: string): number {
  return urlPrefixLength + encodeURIComponent(message).length
}

/**
 * Level 1: drop a line whose tokens all resolved to empty.
 *
 * IT WORKS ON THE RENDERED TEXT AND THE PRE-RENDER TEXT TOGETHER, because after substitution there
 * is no way to tell "City:" with an empty token from "City:" typed by an editor. The two are walked
 * line by line: a line of the BODY that contains at least one token, all of whose values are empty,
 * is dropped from the rendered output at the same index.
 */
export function dropEmptyTokenLines(body: string, values: TokenValues, rendered: string): string {
  const bodyLines = body.split('\n')
  const renderedLines = rendered.split('\n')
  if (bodyLines.length !== renderedLines.length) return rendered

  const kept: string[] = []
  for (const [index, bodyLine] of bodyLines.entries()) {
    const tokens = [...bodyLine.matchAll(/\{\{([a-z_]+)\}\}/g)].map((match) => match[1] ?? '')
    const allEmpty =
      tokens.length > 0 && tokens.every((token) => (values[token] ?? '').trim() === '')
    if (allEmpty) continue
    kept.push(renderedLines[index] ?? '')
  }
  return kept.join('\n')
}

/** Level 2. Items are one per line, as `summariseAnswers` produces them. */
function limitSummary(values: TokenValues, code: string): TokenValues {
  const summary = values['customization_summary'] ?? ''
  const items = summary.split('\n').filter((line) => line.trim() !== '')
  if (items.length <= SUMMARY_ITEM_LIMIT) return values

  const remaining = items.length - SUMMARY_ITEM_LIMIT
  const kept = items.slice(0, SUMMARY_ITEM_LIMIT)
  kept.push(`…and ${remaining} more (enquiry ${code})`)
  return { ...values, customization_summary: kept.join('\n') }
}

/** Level 3. On a word boundary: a sentence cut mid-word reads as corruption rather than brevity. */
function truncateNotes(values: TokenValues): TokenValues {
  const notes = values['notes'] ?? ''
  if (notes.length <= NOTES_LIMIT) return values

  const cut = notes.slice(0, NOTES_LIMIT)
  const boundary = cut.lastIndexOf(' ')
  const kept = (boundary > NOTES_LIMIT / 2 ? cut.slice(0, boundary) : cut).trimEnd()
  return { ...values, notes: `${kept}${ELLIPSIS}` }
}

/** Level 4. A count rather than the URLs — the customer still has the images. */
function referencesAsCount(values: TokenValues, code: string): TokenValues {
  const raw = values['reference_urls'] ?? ''
  const count = raw.split(/[\s,]+/).filter((part) => part.trim() !== '').length
  if (count === 0) return values
  return {
    ...values,
    reference_urls: `${count} reference image${count === 1 ? '' : 's'} attached (enquiry ${code})`,
  }
}

/** Level 5. Everything but the essentials emptied; level 1 then removes the lines they were on. */
function essentialOnly(template: TemplateName, values: TokenValues): TokenValues {
  const keep = new Set(ESSENTIAL[template])
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) out[key] = keep.has(key) ? value : ''
  return out
}

/**
 * Shrink until the message fits, and say which rung did it.
 *
 * `render` IS PASSED IN RATHER THAN IMPORTED so this module stays free of the template rules and
 * can be tested with a stub that makes the arithmetic obvious. `body` is passed alongside it
 * because level 1 needs to know which lines HAD tokens, which the rendered text no longer says.
 */
export function shorten(
  template: TemplateName,
  values: TokenValues,
  render: (values: TokenValues) => string,
  urlPrefixLength: number,
  limit: number = MAX_ENCODED_URL_LENGTH,
  body = '',
): ShortenResult {
  const code = values[PROTECTED_TOKEN] ?? ''

  const rungs: { level: ShortenLevel | null; values: TokenValues; strip: boolean }[] = [
    { level: null, values, strip: false },
    { level: 1, values, strip: true },
  ]
  rungs.push({ level: 2, values: limitSummary(rungs[1]!.values, code), strip: true })
  rungs.push({ level: 3, values: truncateNotes(rungs[2]!.values), strip: true })
  rungs.push({ level: 4, values: referencesAsCount(rungs[3]!.values, code), strip: true })
  rungs.push({ level: 5, values: essentialOnly(template, rungs[4]!.values), strip: true })

  let last: ShortenResult | null = null
  for (const rung of rungs) {
    const raw = render(rung.values)
    const message = rung.strip ? dropEmptyTokenLines(body, rung.values, raw) : raw
    const fits = encodedLength(urlPrefixLength, message) <= limit
    last = { values: rung.values, message, level: rung.level, overLimit: !fits }
    if (fits) return last
  }

  /*
   * EVERY RUNG SPENT AND STILL TOO LONG. The link is built anyway. Refusing to produce one would
   * block a conversion over formatting, and the message still carries the reference code — which is
   * the whole reason the code is protected: the owner can find the full brief in Studio whatever
   * the chat window ended up showing.
   */
  return last!
}
