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
 *
 * A SYMBOL OUTRANKS A THREE-LETTER WORD, AND THAT ORDER IS A BUG FIX RATHER THAN A PREFERENCE.
 * This function used to take the first three capital letters in the string as an ISO code, guarded
 * only by a denylist of English words. A denylist can never be complete, and the misses were
 * ordinary: `£1,299 RRP` was recorded as the currency "RRP", and `1.299,00 € IVA incluido` — a
 * Spanish page saying "VAT included" — as "IVA". Every price on such a source was then attributed
 * to a currency that does not exist, and no chart could tell.
 *
 * So the order is now: an UNAMBIGUOUS SYMBOL first, because `£` beside a number cannot be an
 * English word; then a code that is REALLY IN ISO 4217 *and* adjacent to the amount, which is what
 * lets `US$ 1,299 USD` resolve the dollar its symbol cannot; then a shared symbol, which is
 * ambiguous by rule; then the source's declared currency.
 *
 * THE ADJACENCY TEST IS WHAT MAKES THE ALLOWLIST SAFE. `TRY`, `TOP`, `ALL` and `MAD` are real ISO
 * codes and also ordinary English words, so an allowlist alone would read "TRY OUR NEW RANGE" as
 * Turkish lira. A code is only taken when it sits within a few characters of a digit — which is
 * where a currency code is written and where a marketing sentence is not.
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

  for (const [symbol, currency] of UNAMBIGUOUS_SYMBOLS) {
    if (haystack.includes(symbol)) {
      return { currency, state: 'PARSED', ambiguousSymbol: false }
    }
  }

  const code = codeBesideAnAmount(haystack)
  if (code !== null) {
    return { currency: code, state: 'PARSED', ambiguousSymbol: false }
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

/** How far from a digit a three-letter code may sit and still be read as this price's currency. */
const CODE_ADJACENCY = 4

/**
 * A real ISO 4217 code written next to the number it prices.
 *
 * Both halves are load-bearing. Without the allowlist, any capitalised three-letter word is a
 * currency; without the adjacency test, the allowlist admits `TRY` and `ALL` from a marketing line.
 */
function codeBesideAnAmount(haystack: string): string | null {
  const upper = haystack.toUpperCase()
  for (const match of upper.matchAll(/(?:^|[^A-Z])([A-Z]{3})(?:[^A-Z]|$)/gu)) {
    const candidate = match[1]
    if (candidate === undefined || !ISO_4217.has(candidate)) continue

    const at =
      match.index + (match[0].length - candidate.length - (match[0].endsWith(candidate) ? 0 : 1))
    const before = upper.slice(Math.max(0, at - CODE_ADJACENCY), at)
    const after = upper.slice(at + 3, at + 3 + CODE_ADJACENCY)
    if (/\d/u.test(before) || /\d/u.test(after)) return candidate
  }
  return null
}

/**
 * ISO 4217, the active codes.
 *
 * AN ALLOWLIST RATHER THAN A DENYLIST, AND THE CHANGE WAS FORCED BY A DEFECT. The previous version
 * listed eighteen English words that must not be read as currencies and admitted everything else —
 * so `RRP` on a British page and `IVA` on a Spanish one both became currencies. There is no finite
 * list of words a furniture page might print in capitals; there IS a finite list of currencies.
 *
 * Codes go stale slowly and in the safe direction: a currency retired from this list stops being
 * recognised and the row falls back to the source's declared currency, which is a person's answer.
 */
const ISO_4217: ReadonlySet<string> = new Set([
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BHD',
  'BIF',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BTN',
  'BWP',
  'BYN',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUP',
  'CVE',
  'CZK',
  'DJF',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ERN',
  'ETB',
  'EUR',
  'FJD',
  'FKP',
  'GBP',
  'GEL',
  'GHS',
  'GIP',
  'GMD',
  'GNF',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'IQD',
  'IRR',
  'ISK',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KGS',
  'KHR',
  'KMF',
  'KPW',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'LYD',
  'MAD',
  'MDL',
  'MGA',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MRU',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'RWF',
  'SAR',
  'SBD',
  'SCR',
  'SDG',
  'SEK',
  'SGD',
  'SHP',
  'SLE',
  'SOS',
  'SRD',
  'SSP',
  'STN',
  'SVC',
  'SYP',
  'SZL',
  'THB',
  'TJS',
  'TMT',
  'TND',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'USD',
  'UYU',
  'UZS',
  'VED',
  'VES',
  'VND',
  'VUV',
  'WST',
  'XAF',
  'XCD',
  'XCG',
  'XOF',
  'XPF',
  'YER',
  'ZAR',
  'ZMW',
  'ZWG',
])

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
 *
 * **WHEN TWO NUMBERS ARE NOT A RANGE, THE ROW IS UNPARSED RATHER THAN GUESSED AT**, and that rule
 * replaces three defects this function shipped with. It used to take every number it could see, cap
 * the list at two, and treat any pair as a range floor and ceiling — so a price cell reading
 * `£1,299 inc. 20% VAT` was stored as "from £20.00", and `Save 20% — £1,299` as the same. The
 * numbers on a catalogue page beside a price are usually NOT prices: a VAT rate, a discount badge,
 * a seat count, an APR.
 *
 * So a number now has to earn its place. Percentages are removed before the scan; what survives is
 * preferred if it sits beside a currency marker; two survivors are a range only when a range token
 * joins them; and anything else is `UNPARSED` with no amount stored. Refusing costs a row on a
 * comparison chart. Guessing puts a figure on that chart that no page ever printed.
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
  const scan = scanAmounts(priceText, config, currency)

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
      quoteCarriedAmount: scan.amounts.length > 0,
    }
  }

  if (scan.amounts.length === 0) {
    return {
      state: 'UNKNOWN',
      minMinor: null,
      maxMinor: null,
      parseState: 'UNPARSED',
      quoteCarriedAmount: false,
      zeroOrNegative: false,
    }
  }

  /*
   * EVERY CHOSEN AMOUNT IS TESTED, NOT JUST THE FIRST. The previous version checked `amounts[0]`
   * and then stored `Math.min(...)` — two different values — so `£1,299 – £0` passed the guard and
   * stored a zero, which `normalizedProductSchema` then threw on rather than raising
   * `price_zero_or_negative`. A row that fails a rule must be KEPT AND FLAGGED, never thrown on.
   */
  if (scan.amounts.some((amount) => amount <= 0)) {
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

  const saysFrom = /\b(?:from|starting(?:\s+at|\s+from)?|onwards?|ab|à partir)\b/iu.test(priceText)

  if (scan.amounts.length === 1) {
    const only = scan.amounts[0]
    if (only === undefined) {
      return {
        state: 'UNKNOWN',
        minMinor: null,
        maxMinor: null,
        parseState: 'UNPARSED',
        quoteCarriedAmount: false,
        zeroOrNegative: false,
      }
    }
    return {
      state: saysFrom ? 'STARTING_FROM' : 'FIXED',
      minMinor: only,
      maxMinor: null,
      parseState: 'PARSED',
      quoteCarriedAmount: false,
      zeroOrNegative: false,
    }
  }

  if (!scan.joinedByRangeToken) {
    // Two numbers that nothing joins. See the header: this is the case that used to invent a price.
    return {
      state: 'UNKNOWN',
      minMinor: null,
      maxMinor: null,
      parseState: 'UNPARSED',
      quoteCarriedAmount: false,
      zeroOrNegative: false,
    }
  }

  const min = Math.min(...scan.amounts)
  const max = Math.max(...scan.amounts)
  return {
    state: 'STARTING_FROM',
    minMinor: min,
    maxMinor: max > min ? max : null,
    parseState: 'PARSED',
    quoteCarriedAmount: false,
    zeroOrNegative: false,
  }
}

/**
 * A percentage, and the number attached to it.
 *
 * REMOVED BEFORE ANYTHING ELSE IS READ. A discount badge and a VAT line live in the same cell as
 * the price on a great many catalogue pages, and their numbers are the ones most likely to be
 * small — which is exactly what made them win a `Math.min` and become the price.
 */
const PERCENTAGE = /\d+(?:[.,]\d+)?\s*%/gu

/** What separates the two ends of a real range. Anything else between two numbers is not one. */
const RANGE_TOKEN = /^[\s]*(?:[-–—~]|to|bis|à|a)[\s]*$/iu

interface AmountScan {
  readonly amounts: readonly number[]
  /** True when exactly a range token sits between the two amounts. */
  readonly joinedByRangeToken: boolean
}

/** At most two, because a third number in a price string is a saving, a tax line or a per-unit rate. */
const MAX_AMOUNTS = 2

/**
 * The numbers in a price string that are plausibly PRICES, with their positions.
 *
 * A NUMBER MAY NOT SWALLOW THE SPACE AFTER IT, WHICH IS THE OTHER DEFECT THIS FUNCTION SHIPPED
 * WITH. The scanner's character class contained a plain space and `toMinorUnits` then stripped all
 * whitespace, so `£1,299 3 seater` was read as the single number `1,2993` and stored as
 * **£12,993.00** for a £1,299 sofa. A space is admitted as a thousands separator only between
 * groups of exactly three digits — the same rule `dimensions.ts` already applies for the same
 * reason.
 *
 * PREFERENCE FOR CURRENCY-ANCHORED NUMBERS. Where any number sits beside a currency marker, only
 * those are considered: on `3 seater £1,299` that is the difference between £1,299 and £0.03.
 */
function scanAmounts(text: string, config: PriceExtraction, currency: string | null): AmountScan {
  const exponent = minorUnitExponent(currency ?? 'XXX')
  const cleaned = text.replace(PERCENTAGE, (match) => ' '.repeat(match.length))

  const thousands = ['\\u00a0', '\\u202f']
  if (config.thousandsSeparator !== '' && config.thousandsSeparator !== ' ') {
    thousands.push(escapeLiteral(config.thousandsSeparator))
  }
  if (config.thousandsSeparator === ' ') thousands.push('\\u0020')
  const T = `[${thousands.join('')}]`
  const D = escapeLiteral(config.decimalSeparator)

  // Grouped form first, so `1,299` is preferred over a bare `1` followed by `,299`.
  const NUMBER = new RegExp(`\\d{1,3}(?:${T}\\d{3})+(?:${D}\\d+)?|\\d+(?:${D}\\d+)?`, 'gu')

  const found: Array<{ minor: number; start: number; end: number }> = []
  for (const match of cleaned.matchAll(NUMBER)) {
    const minor = toMinorUnits(match[0], config, exponent)
    if (minor === null) continue
    found.push({ minor, start: match.index, end: match.index + match[0].length })
  }
  if (found.length === 0) return { amounts: [], joinedByRangeToken: false }

  /*
   * ANCHORING IS BY DISTANCE, NOT BY A YES/NO TEST, and the difference decides a real case. On
   * `1 299,00 € 3 places` a plain "is there a marker within five characters" call anchors BOTH the
   * price and the seat count — the `€` is just before the `3` — and two anchored numbers with no
   * range token between them are refused, losing a price the page stated plainly. Measuring the
   * distance keeps only the numbers CLOSEST to a marker, which is the one the marker is marking.
   *
   * A genuine range is unaffected: in `£1,299 – £1,899` each number has its own `£` immediately
   * before it, so both sit at the same minimum distance and both survive to the range test.
   */
  const distances = found.map((entry) => markerDistance(cleaned, entry.start, entry.end))
  const nearest = distances.filter((d): d is number => d !== null)
  const closest = nearest.length > 0 ? Math.min(...nearest) : null
  const anchored =
    closest === null ? [] : found.filter((_entry, index) => distances[index] === closest)
  const chosen = (anchored.length > 0 ? anchored : found).slice(0, MAX_AMOUNTS)

  const joined =
    chosen.length === 2 &&
    chosen[0] !== undefined &&
    chosen[1] !== undefined &&
    RANGE_TOKEN.test(stripCurrencyMarkers(cleaned.slice(chosen[0].end, chosen[1].start)))

  return { amounts: chosen.map((entry) => entry.minor), joinedByRangeToken: joined }
}

function escapeLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\-]/gu, '\\$&')
}

/** How far from a number a currency marker may sit and still be read as marking it. */
const MARKER_ADJACENCY = 5

const MARKER = /[€£₹₩₪₺₫₽฿₴₦$¥]|\b(?:kr|rm)\b|[A-Z]{3}/u

/** How many characters lie between this number and the nearest currency marker, or null if none. */
function markerDistance(text: string, start: number, end: number): number | null {
  for (let gap = 0; gap <= MARKER_ADJACENCY; gap += 1) {
    const before = text.slice(Math.max(0, start - gap - 1), start)
    const after = text.slice(end, end + gap + 1)
    if (MARKER.test(before) || MARKER.test(after)) return gap
  }
  return null
}

function stripCurrencyMarkers(between: string): string {
  return between.replace(/[€£₹₩₪₺₫₽฿₴₦$¥]|[A-Za-z]{3}/gu, '')
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
