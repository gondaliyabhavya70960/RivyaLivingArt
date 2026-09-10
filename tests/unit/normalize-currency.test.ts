import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { priceExtractionSchema, type PriceExtraction } from '@/lib/scraper/core/source-schema'
import {
  minorUnitExponent,
  readCurrency,
  readPrice,
  toMinorUnits,
} from '@/lib/scraper/normalization'

/**
 * Money, and the two ways this subsystem is allowed to be wrong about it.
 *
 * IT MAY SAY "I DO NOT KNOW" AND IT MAY SAY "THIS COULD BE READ TWO WAYS". What it may never do is
 * produce a plausible number, and the assertions below are almost all about that: a `$` that stays
 * ambiguous, a quote-only row that carries no amount, a zero that is refused, a `1.234` that is
 * read by the source's stated convention rather than by inspection.
 *
 * THE LAST TEST IN THIS FILE IS NOT ABOUT PARSING AT ALL. It reads every file under `lib/scraper/`
 * and fails if any of them mentions an exchange rate or a conversion helper. That is the phase
 * document's own risk — "foreign-exchange conversion appears as a small convenience" — expressed as
 * a test, because the decision not to convert is one a future contributor will find inconvenient
 * long after everybody who agreed to it has forgotten why.
 */

const EU: PriceExtraction = priceExtractionSchema.parse({
  strategy: 'NONE',
  decimalSeparator: ',',
  thousandsSeparator: '.',
})

const UK: PriceExtraction = priceExtractionSchema.parse({
  strategy: 'NONE',
  decimalSeparator: '.',
  thousandsSeparator: ',',
})

describe('readCurrency', () => {
  it('takes the source’s declared currency when the page says nothing', () => {
    const reading = readCurrency(null, null, 'INR')
    expect(reading).toEqual({ currency: 'INR', state: 'PARSED', ambiguousSymbol: false })
  })

  it('lets an unambiguous symbol override the declared currency', () => {
    expect(readCurrency('€1.299,00', null, 'INR').currency).toBe('EUR')
    expect(readCurrency('£1,299.00', null, 'INR').currency).toBe('GBP')
    expect(readCurrency('₹64,000', null, 'EUR').currency).toBe('INR')
  })

  it('takes an explicit three-letter code over a symbol beside it', () => {
    // `US$ 1,299 USD` has said which dollar it means.
    expect(readCurrency('US$ 1,299 USD', null, 'INR').currency).toBe('USD')
  })

  it('REFUSES TO GUESS A COUNTRY FROM A BARE DOLLAR SIGN', () => {
    /*
     * THE ASSERTION THIS MODULE EXISTS FOR. `$` is the sign of at least a dozen currencies, and the
     * site using it without qualification is usually the one whose country a reader is guessing at.
     * Recording USD because the page felt American would be a fabricated business fact about
     * somebody else's pricing — and it would be invisible, because every figure downstream would
     * look perfectly normal.
     */
    const reading = readCurrency('$1,299.00', null, 'INR')
    expect(reading.state).toBe('AMBIGUOUS')
    expect(reading.ambiguousSymbol).toBe(true)
    // THE DECLARED CURRENCY IS STILL KEPT. AMBIGUOUS says "do not compare this", not "unknown".
    expect(reading.currency).toBe('INR')
  })

  it('treats the other shared signs the same way', () => {
    for (const text of ['¥1,299', 'kr 1 299', 'R$ 1.299,00', 'RM 1,299']) {
      expect(readCurrency(text, null, 'GBP').state, text).toBe('AMBIGUOUS')
    }
  })

  it('does not read a capitalised English word as a currency code', () => {
    // Without the denylist, `SET` in "DINING SET — £1,299" is a currency and every price on that
    // source is attributed to one that does not exist.
    expect(readCurrency('DINING SET — £1,299', null, 'GBP').currency).toBe('GBP')
    expect(readCurrency('1,299 INC VAT', null, 'GBP').currency).toBe('GBP')
  })
})

describe('toMinorUnits', () => {
  it('reads a European number by the source’s stated convention', () => {
    expect(toMinorUnits('1.234,56', EU, 2)).toBe(123456)
  })

  it('reads a British number by its own', () => {
    expect(toMinorUnits('1,234.56', UK, 2)).toBe(123456)
  })

  it('READS THE SAME STRING AS TWO DIFFERENT NUMBERS UNDER TWO CONVENTIONS', () => {
    // The whole reason the separators are per-source configuration: nothing in `1.234` says which
    // of these two answers is right, and guessing is a thousand-fold error that looks plausible.
    expect(toMinorUnits('1.234', EU, 2)).toBe(123400)
    expect(toMinorUnits('1.234', UK, 2)).toBe(123)
  })

  it('treats a non-breaking space as a thousands separator whatever the configuration says', () => {
    expect(toMinorUnits('1 234,00', EU, 2)).toBe(123400)
  })

  it('refuses text that is not a number', () => {
    expect(toMinorUnits('call us', UK, 2)).toBeNull()
    expect(toMinorUnits('', UK, 2)).toBeNull()
  })

  it('uses the currency’s own minor-unit exponent', () => {
    expect(minorUnitExponent('JPY')).toBe(0)
    expect(minorUnitExponent('KWD')).toBe(3)
    expect(minorUnitExponent('INR')).toBe(2)
    // A yen price stored with two decimal places would read a hundred times too large everywhere.
    expect(toMinorUnits('129900', UK, minorUnitExponent('JPY'))).toBe(129900)
  })
})

describe('readPrice', () => {
  it('reads a fixed price', () => {
    const price = readPrice('£1,299.00', UK, 'GBP')
    expect(price.state).toBe('FIXED')
    expect(price.minMinor).toBe(129900)
    expect(price.maxMinor).toBeNull()
  })

  it('reads "from X" as STARTING_FROM', () => {
    const price = readPrice('From £1,299', UK, 'GBP')
    expect(price.state).toBe('STARTING_FROM')
    expect(price.minMinor).toBe(129900)
  })

  it('reads a range as a floor and a ceiling', () => {
    const price = readPrice('£1,299.00 – £1,899.00', UK, 'GBP')
    expect(price.state).toBe('STARTING_FROM')
    expect(price.minMinor).toBe(129900)
    expect(price.maxMinor).toBe(189900)
  })

  it.each([
    ['Price on request', 'PRICE_ON_REQUEST'],
    ['POA', 'PRICE_ON_REQUEST'],
    ['Contact for price', 'PRICE_ON_REQUEST'],
    ['Request a quote', 'REQUEST_QUOTE'],
    ['Enquire for pricing', 'REQUEST_QUOTE'],
  ])('reads %s as %s with no amount', (text, expected) => {
    const price = readPrice(text, UK, 'GBP')
    expect(price.state).toBe(expected)
    expect(price.minMinor).toBeNull()
    expect(price.maxMinor).toBeNull()
  })

  it('KEEPS THE QUOTE POSTURE AND DROPS THE NUMBER when a page prints both', () => {
    /*
     * "From £499, enquire for the ten-seater" is a real sentence, and it is not a fact this schema
     * can hold: `research_price_state_coherent` refuses a quote state carrying an amount. So the
     * posture is recorded, the amount is not, and the flag is raised for `price_quote_with_amount`
     * to turn into an ERROR — the row is kept and flagged, never refused by the database.
     */
    const price = readPrice('From £499 — enquire for the ten-seater', UK, 'GBP')
    expect(price.state).toBe('REQUEST_QUOTE')
    expect(price.minMinor).toBeNull()
    expect(price.quoteCarriedAmount).toBe(true)
  })

  it('REFUSES A ZERO rather than storing a free dining table', () => {
    const price = readPrice('£0.00', UK, 'GBP')
    expect(price.state).toBe('UNKNOWN')
    expect(price.minMinor).toBeNull()
    expect(price.zeroOrNegative).toBe(true)
  })

  it('reports an absent price as ABSENT and an unreadable one as UNPARSED', () => {
    expect(readPrice(null, UK, 'GBP').parseState).toBe('ABSENT')
    expect(readPrice('ask in store', UK, 'GBP').parseState).toBe('UNPARSED')
  })
})

describe('NO FOREIGN-EXCHANGE CONVERSION EXISTS ANYWHERE UNDER lib/scraper', () => {
  /*
   * THE PHASE DOCUMENT'S OWN RISK, ASSERTED RATHER THAN PROMISED: "foreign-exchange conversion
   * appears as a small convenience". It would be: one helper, one rate, and every price in the
   * system suddenly comparable. What it would actually produce is a figure nobody quoted, at a rate
   * with no date, compared against a price captured in March — and it would be believed, because it
   * would look like every other number on the screen.
   *
   * A STATIC CHECK BECAUSE THE FAILURE IS A FUTURE EDIT, not a bug present today. This is the same
   * shape as `reextract.ts`'s no-fetcher assertion and for the same reason.
   */
  const ROOT = 'lib/scraper'
  const FORBIDDEN = [
    /exchangeRate/i,
    /convertCurrency/i,
    /fx_rate/i,
    /fxRate/i,
    /currencyConver/i,
    /\bexchange-rates?\b/i,
  ]

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
    })
  }

  it('names no rate, no conversion helper and no rate source', () => {
    const offenders: string[] = []
    for (const file of walk(ROOT)) {
      const source = readFileSync(file, 'utf8')
      // The module header of `currency.ts` says the words in order to refuse them, so a comment is
      // not an offence — only a line that is not one.
      const code = source
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/u.test(line))
        .join('\n')
      for (const pattern of FORBIDDEN) {
        if (pattern.test(code)) offenders.push(`${file}: ${pattern.source}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
