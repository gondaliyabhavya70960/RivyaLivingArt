import type { TemplateName, TokenValues } from './templates'

/**
 * Keeping a rendered message inside what a `wa.me` URL can carry.
 *
 * WHY THERE IS A CAP AT ALL. `https://wa.me/<number>?text=<message>` puts the whole message in a
 * query string, percent-encoded — and a newline costs three characters, an emoji up to twelve. A
 * long "requirements" field therefore does not fail loudly: browsers, and the WhatsApp clients
 * behind them, truncate or reject an over-long URL, so the customer arrives at a chat with half a
 * sentence in it, or none. Nothing is logged and nothing is thrown.
 *
 * 1800 CHARACTERS OF ENCODED URL, and the number is deliberately conservative. There is no
 * standard limit; the practical floors are old Internet Explorer at 2 083 and a handful of
 * proxies at 2 048. The margin below 2 048 leaves room for the origin, the number and the query
 * key without arithmetic at each call site.
 *
 * THE ORDER OF SACRIFICE IS FIXED AND IT IS NOT "SHORTEN THE WHOLE MESSAGE". Cutting the tail
 * would drop the inquiry id — the one field that ties the message to the row Phase 20 persisted,
 * and the whole reason a handoff is traceable. So:
 *
 *   1. The longest free-text value is truncated, repeatedly, down to a floor.
 *   2. Then optional blocks are dropped whole, in the declared order.
 *   3. `inquiry_id` is never touched by either step.
 *
 * If a message is still too long after all of that, the caller gets it anyway — see `shorten`'s
 * return. Refusing to produce a link would block a conversion over formatting.
 */

/** Encoded length, not character count: `wa.me` carries the message percent-encoded. */
export const MAX_ENCODED_URL_LENGTH = 1800

/** Below this a truncated field says nothing useful, so the block is dropped instead. */
const MIN_FIELD_LENGTH = 40

/** Appended to a value that was cut, so the recipient can see that it was. */
const ELLIPSIS = '…'

/**
 * Free text, longest-first, is what gets shortened. These are the fields a visitor types prose
 * into; every other token is a name, a city or an id, where truncation produces something wrong
 * rather than something shorter.
 */
const TRUNCATABLE: Record<TemplateName, readonly string[]> = {
  inquiry: ['customization_summary', 'notes', 'reference_urls'],
  commission: ['material_direction', 'notes', 'reference_urls'],
}

/**
 * Dropped whole, in this order, once truncation has run out of room.
 *
 * REFERENCES FIRST, because a URL is the least lossy thing to lose — the customer still has it and
 * can paste it into the chat. Notes last of the optional three: it is the visitor's own words.
 */
const DROPPABLE: Record<TemplateName, readonly string[]> = {
  inquiry: ['reference_urls', 'customization_summary', 'notes'],
  commission: ['reference_urls', 'material_direction', 'notes'],
}

/** The one token that is never shortened and never dropped. */
export const PROTECTED_TOKEN = 'inquiry_id'

export type ShortenResult = {
  readonly values: TokenValues
  /** True when the message still exceeds the cap after every step. The link is still built. */
  readonly overLimit: boolean
  /** Which tokens were cut short, and which were dropped entirely. For tests and for logging. */
  readonly truncated: readonly string[]
  readonly dropped: readonly string[]
}

function encodedLength(url: string, message: string): number {
  return url.length + encodeURIComponent(message).length
}

/**
 * Shrink `values` until `render(values)` fits, or until there is nothing left to give.
 *
 * `render` IS PASSED IN RATHER THAN IMPORTED so this module stays free of the template rules and
 * can be tested with a stub that makes the arithmetic obvious.
 */
export function shorten(
  template: TemplateName,
  values: TokenValues,
  render: (values: TokenValues) => string,
  urlPrefixLength: number,
  limit: number = MAX_ENCODED_URL_LENGTH,
): ShortenResult {
  const working: Record<string, string> = { ...values }
  const truncated: string[] = []
  const dropped: string[] = []

  const fits = () => encodedLength('x'.repeat(urlPrefixLength), render(working)) <= limit

  if (fits()) return { values: working, overLimit: false, truncated, dropped }

  // 1. Truncate the longest free-text field, repeatedly. Each pass halves the longest one, which
  //    converges fast without hunting for an exact cut point through the encoder.
  const truncatable = TRUNCATABLE[template].filter((token) => token !== PROTECTED_TOKEN)
  for (let pass = 0; pass < 24 && !fits(); pass += 1) {
    const longest = truncatable
      .filter((token) => (working[token] ?? '').length > MIN_FIELD_LENGTH)
      .sort((a, b) => (working[b] ?? '').length - (working[a] ?? '').length)[0]
    if (longest === undefined) break

    const current = working[longest] ?? ''
    const next = Math.max(MIN_FIELD_LENGTH, Math.floor(current.length / 2))
    working[longest] = current.slice(0, next).trimEnd() + ELLIPSIS
    if (!truncated.includes(longest)) truncated.push(longest)
  }

  // 2. Drop whole blocks, in the declared order.
  for (const token of DROPPABLE[template]) {
    if (fits()) break
    if (token === PROTECTED_TOKEN) continue
    if ((working[token] ?? '') === '') continue
    working[token] = ''
    dropped.push(token)
  }

  return { values: working, overLimit: !fits(), truncated, dropped }
}
