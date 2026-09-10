import type { PriceExtraction } from '@/lib/scraper/core/source-schema'

import type { ParseState, ResearchPriceState } from './schema'

/**
 * Money, read from somebody else's page — and **never converted**.
 *
 * THERE IS NO EXCHANGE RATE IN THIS FILE OR ANYWHERE UNDER `lib/scraper/`, AND THAT IS A DECISION
 * RATHER THAN AN OMISSION. Comparing €1,299 with ₹64,000 requires a rate, and a rate has a date; a
 * figure converted at today's rate and compared with a price captured in March is a comparison of
 * two things that were never true at the same moment. Phases 31–34 compare WITHIN a currency and
 * say so on the chart. `tests/unit/normalize-currency.test.ts` asserts that no conversion helper,
 * rate literal or FX import appears anywhere in `lib/scraper/**`, so the shortcut cannot be taken
 * quietly later.
 *
 * `$` ALONE IS AMBIGUOUS. It is the sign of at least a dozen currencies, and the site that uses it
 * without qualification is usually the site whose country a reader is guessing at. Recording USD
 * because the page felt American is a fabricated business fact about somebody else's pricing. `€`
 * and `£` are unambiguous in practice and are taken; an explicit three-letter code is taken; a
 * bare `$` records `AMBIGUOUS`, keeps the source's declared currency, and raises
 * `currency_ambiguous`, which excludes the row from every price comparison.
 *
 * AMOUNTS ARE INTEGER MINOR UNITS, and the separators come from the SOURCE'S CONFIGURATION rather
 * than from inspection. `1.234` is one thousand two hundred and thirty-four in one convention and
 * one-point-two-three-four in another; nothing in the string distinguishes them, so guessing is a
 * thousand-fold error that looks entirely plausible in a table. Phase 26 asks a person to state the
 * convention per source for exactly this moment.
 */

/**
 * Symbols that mean one currency and nothing else.
 *
 * DELIBERATELY SHORT. Every entry here is a claim that no other currency uses this sign, and the
 * cost of a wrong entry is a price attributed to the wrong currency in a chart nobody re-checks.
 * `$`, `kr`, `₨` and `¥` are all shared and are all absent on purpose.
 */
const UNAMBIGUOUS_SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['₹', 'INR'],
  ['₩', 'KRW'],
  ['₪', 'ILS'],
  ['₺', 'TRY'],
  ['₫', 'VND'],
  ['₽', 'RUB'],
  ['฿', 'THB'],
  ['₴', 'UAH'],
  ['₦', 'NGN'],
])

/** Signs that are used by more than one currency. Seeing one records AMBIGUOUS, never a guess. */
const AMBIGUOUS_SYMBOLS: ReadonlySet<string> = new Set(['$', '¥', 'kr', '₨', '₡', 'R$', 'RM'])

/**
 * ISO 4217 minor-unit exponents that are not 2.
 *
 * A TABLE OF EXCEPTIONS RATHER THAN A LOOKUP SERVICE. Three currencies' worth of special cases is
 * cheaper than a dependency, and the failure of a missing entry is bounded and legible: a JPY price
 * would be stored a hundred times too large, which is visible in any chart, rather than silently
 * plausible.
 */
const MINOR_UNIT_EXPONENTS: ReadonlyMap<string, number> = new Map([
  ['JPY', 0],
  ['KRW', 0],
  ['VND', 0],
  ['CLP', 0],
  ['ISK', 0],
  ['XAF', 0],
  ['XOF', 0],
  ['XPF', 0],
  ['PYG', 0],
  ['RWF', 0],
  ['UGX', 0],
  ['BIF', 0],
  ['DJF', 0],
  ['GNF', 0],
  ['KMF', 0],
  ['MGA', 0],
  ['VUV', 0],
  ['BHD', 3],
  ['IQD', 3],
  ['JOD', 3],
  ['KWD', 3],
  ['LYD', 3],
  ['OMR', 3],
  ['TND', 3],
])

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENTS.get(currency.toUpperCase()) ?? 2
}

/**
 * Text that means "we will not print a number".
 *
 * TWO GROUPS, BECAUSE THE VOCABULARY DISTINGUISHES THEM AND SO DOES RIVYA'S OWN. `PRICE_ON_REQUEST`
 * is a posture — this is priced, ask us — and `REQUEST_QUOTE` is an invitation to a conversation
 * about a piece that does not have one price. `products` already draws that line, and drawing it
 * differently here would mean every comparison began with a translation.
 */
const PRICE_ON_REQUEST = [
  'price on request',
  'price upon request',
  'poa',
  'p.o.a',
  'price on application',
  'contact for price',
  'call for price',
  'ask for price',
  'prix sur demande',
]

const REQUEST_QUOTE = [
  'request a quote',
  'request quote',
  'get a quote',
  'request pricing',
  'enquire',
  'inquire',
  'enquiry',
  'made to order',
  'bespoke pricing',
]

export interface CurrencyReading {
  /** The code to store. The source's declared currency unless the page overrode it unambiguously. */
  readonly currency: string | null
  readonly state: ParseState
  /** True when the page showed a shared sign — `$` — and Rivya declined to guess a country. */
  readonly ambiguousSymbol: boolean
}

/**
 * What currency is this price in?
 *
 * THE SOURCE'S DECLARED CURRENCY IS THE DEFAULT AND THE PAGE MAY ONLY OVERRIDE IT UNAMBIGUOUSLY.
 * That ordering matters: a person configured the source, and a page's own markup is the less
 * reliable of the two precisely because it is the thing being read.
 */
export function readCurrency(
  priceText: string | null,
  currencyText: string | null,
  declared: string | null,
): CurrencyReading {
  const haystack = `${currencyText ?? ''} ${priceText ?? ''}`
  const fallback = declared === null ? null : declared.toUpperCase()

  if (haystack.trim() === '') {
    return {
      currency: fallback,
      state: fallback === null ? 'ABSENT' : 'PARSED',
      ambiguousSymbol: false,
    }
  }

  // An explicit three-letter code wins over everything, including a symbol beside it: a page
  // printing `US$ 1,299 USD` has said which dollar it means.
  const code = /(?:^|[^A-Za-z])([A-Z]{3})(?:[^A-Za-z]|$)/u.exec(haystack.toUpperCase())?.[1]
  if (code !== undefined && isPlausibleCode(code)) {
    return { currency: code, state: 'PARSED', ambiguousSymbol: false }
  }

  for (const [symbol, currency] of UNAMBIGUOUS_SYMBOLS) {
    if (haystack.includes(symbol)) {
      return { currency, state: 'PARSED', ambiguousSymbol: false }
    }
  }

  for (const symbol of AMBIGUOUS_SYMBOLS) {
    if (haystack.toLowerCase().includes(symbol.toLowerCase())) {
      // THE DECLARED CURRENCY IS STILL KEPT. Dropping it would lose the one piece of human
      // knowledge in play; what the AMBIGUOUS state says is "do not compare this", not "unknown".
      return { currency: fallback, state: 'AMBIGUOUS', ambiguousSymbol: true }
    }
  }

  return {
    currency: fallback,
    state: fallback === null ? 'ABSENT' : 'PARSED',
    ambiguousSymbol: false,
  }
}

/**
 * Three capital letters that are not a word a furniture page prints in capitals.
 *
 * WITHOUT THIS, `SET` IN "DINING SET — £1,299" READS AS A CURRENCY CODE and every price on that
 * source is attributed to a currency that does not exist. The denylist is the words that actually
 * appear in the neighbourhood of a price; anything else three letters long is admitted, because an
 * enumeration of all 180 ISO codes would go stale in the other direction.
 */
const NOT_A_CURRENCY: ReadonlySet<string> = new Set([
  'SET',
  'NEW',
  'OFF',
  'VAT',
  'GST',
  'TAX',
  'INC',
  'EXC',
  'FOR',
  'THE',
  'AND',
  'PER',
  'CM',
  'MM',
  'EACH',
  'FROM',
  'SALE',
  'ONLY',
])

function isPlausibleCode(code: string): boolean {
  return /^[A-Z]{3}$/u.test(code) && !NOT_A_CURRENCY.has(code)
}

export interface PriceReading {
  readonly state: ResearchPriceState
  readonly minMinor: number | null
  readonly maxMinor: number | null
  readonly parseState: ParseState
  /** Set when the page printed a number AND said it was quote-only — an ERROR the caller raises. */
  readonly quoteCarriedAmount: boolean
  /**
   * Set when the page printed a price of nought or less.
   *
   * A SIGNAL RATHER THAN A STORED VALUE, because the value is refused: a zero drags every average,
   * band and comparison towards it and is indistinguishable downstream from a real price. The
   * caller turns this into `price_zero_or_negative` at ERROR and the row is kept, flagged.
   */
  readonly zeroOrNegative: boolean
}

const QUOTE_ONLY: PriceReading = {
  state: 'REQUEST_QUOTE',
  minMinor: null,
  maxMinor: null,
  parseState: 'PARSED',
  quoteCarriedAmount: false,
  zeroOrNegative: false,
}

/**
 * Read a price string into a state and nought, one or two amounts.
 *
 * A RANGE IS `STARTING_FROM`, WHICH IS THE FIRST-PARTY VOCABULARY'S OWN WORD FOR IT. "From £1,299"
 * and "£1,299 – £1,899" are the same claim differently typeset, and both are honestly summarised by
 * a floor plus, where the page gave one, a ceiling. Storing only the floor would be a narrowing;
 * storing the mean would print a figure nobody quoted.
 */
export function readPrice(
  priceText: string | null,
  config: PriceExtraction,
  currency: string | null,
): PriceReading {
  if (priceText === null || priceText.trim() === '') {
    return {
      state: 'UNKNOWN',
      minMinor: null,
      maxMinor: null,
      parseState: 'ABSENT',
      quoteCarriedAmount: false,
      zeroOrNegative: false,
    }
  }

  const lower = priceText.toLowerCase()
  const amounts = extractAmounts(priceText, config, currency)

  const onRequest = PRICE_ON_REQUEST.some((phrase) => lower.includes(phrase))
  const quote = REQUEST_QUOTE.some((phrase) => lower.includes(phrase))

  if (onRequest || quote) {
    /*
     * A QUOTE STATE CARRYING A NUMBER IS AN ERROR, AND THE ROW IS STILL KEPT. "From £499, enquire
     * for the ten-seater" is a real sentence; what it is not is a fact this schema can hold, and
     * `research_price_state_coherent` would refuse the write outright. So the quote state is
     * recorded with both amounts null, the flag is raised, and the text survives untouched in the
     * version's `raw` and in `sourceTexts.price` — nothing is lost by refusing to store a value the
     * row is not allowed to hold.
     */
    return {
      ...QUOTE_ONLY,
      state: onRequest ? 'PRICE_ON_REQUEST' : 'REQUEST_QUOTE',
      quoteCarriedAmount: amounts.length > 0,
    }
  }

  if (amounts.length === 0) {
    return {
      state: 'UNKNOWN',
      minMinor: null,
      maxMinor: null,
      parseState: 'UNPARSED',
      quoteCarriedAmount: false,
      zeroOrNegative: false,
    }
  }

  const [first] = amounts
  if (first === undefined || first <= 0) {
    // `price_zero_or_negative`. A free dining table is not what a zero on a catalogue page means —
    // it is a placeholder, a stripped currency symbol or a variant with no price yet — and stored
    // as a number it drags every average towards it and cannot be told from a real one.
    return {
      state: 'UNKNOWN',
      minMinor: null,
      maxMinor: null,
      parseState: 'UNPARSED',
      quoteCarriedAmount: false,
      zeroOrNegative: true,
    }
  }

  const isRange =
    amounts.length > 1 ||
    /\b(?:from|starting(?:\s+at|\s+from)?|onwards?|ab|à partir)\b/iu.test(priceText)
  const max = amounts.length > 1 ? Math.max(...amounts) : null

  return {
    state: isRange ? 'STARTING_FROM' : 'FIXED',
    minMinor: Math.min(...amounts),
    maxMinor: max !== null && max > Math.min(...amounts) ? max : null,
    parseState: 'PARSED',
    quoteCarriedAmount: false,
    zeroOrNegative: false,
  }
}

/** At most two, because a third number in a price string is a saving, a tax line or a per-unit rate. */
const MAX_AMOUNTS = 2

/**
 * Every number in the string, in minor units, in the order they appear.
 *
 * THE SEPARATORS ARE THE SOURCE'S, AND THE ORDER OF OPERATIONS MATTERS. Thousands separators are
 * removed first, then the decimal separator becomes a dot; doing it the other way round turns
 * `1.234,56` into `1.234.56`, which parses as nothing.
 */
function extractAmounts(text: string, config: PriceExtraction, currency: string | null): number[] {
  const exponent = minorUnitExponent(currency ?? 'XXX')
  const digits = /[0-9](?:[0-9.,  ']*[0-9])?/gu
  const out: number[] = []

  for (const match of text.matchAll(digits)) {
    if (out.length >= MAX_AMOUNTS) break
    const minor = toMinorUnits(match[0], config, exponent)
    if (minor !== null) out.push(minor)
  }
  return out
}

export function toMinorUnits(
  raw: string,
  config: PriceExtraction,
  exponent: number,
): number | null {
  let text = raw.trim()
  if (text === '') return null

  // Non-breaking and thin spaces are a thousands separator on plenty of European sites whatever the
  // configuration says, and no convention uses one as a decimal point — so they always go.
  text = text.replace(/[   ]/gu, config.thousandsSeparator === ' ' ? '' : ' ').trim()

  if (config.thousandsSeparator !== '') {
    text = text.split(config.thousandsSeparator).join('')
  }
  if (config.decimalSeparator !== '.') {
    text = text.split(config.decimalSeparator).join('.')
  }
  text = text.replace(/\s/gu, '')

  if (!/^\d+(?:\.\d+)?$/u.test(text)) return null

  const value = Number(text)
  if (!Number.isFinite(value)) return null

  // ROUNDED, NOT TRUNCATED, and rounding is safe here because the fractional part of a price in
  // minor units only exists when a page printed more decimal places than the currency has.
  const minor = Math.round(value * 10 ** exponent)
  return Number.isSafeInteger(minor) ? minor : null
}
