import { describe, expect, it } from 'vitest'

import { currencyExponent, formatMinor, presentPrice, productBadges } from '@/lib/catalog/price'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * The price presenter, and the number it must never invent.
 *
 * THE FAILURE THIS FILE EXISTS TO CATCH: a quote-only product rendering as "₹0" or "From —". The
 * database keeps the numeric columns null for both quote states, so the only way that reaches a
 * visitor is through this module — which is why every one of the four states is asserted here, and
 * why the two quote states are asserted twice: once for the label, once for the absence of a digit.
 */

/** The `global_content` rows `content/seed/commerce-labels.ts` seeds, as the map a page holds. */
function labels(overrides: Record<string, string | null> = {}) {
  const base: Record<string, string> = {
    price: 'Price',
    from: 'From',
    starting_from: 'Starting from',
    request_a_quote: 'Request a Quote',
    price_on_request: 'Price on Request',
    ready_stock: 'Ready Stock',
    made_to_order: 'Made to Order',
    one_of_one: 'One of One',
    limited_edition: 'Limited Edition',
    customizable: 'Customizable',
  }

  const rows: GlobalContent[] = []
  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    if (value === null) continue
    rows.push({ group_key: 'COMMERCE_LABEL', key, value, is_enabled: true } as GlobalContent)
  }
  return siteStrings(rows)
}

const QUOTE = {
  price_state: 'REQUEST_QUOTE',
  price_minor: null,
  price_from_minor: null,
  currency: null,
} as const

describe('presentPrice', () => {
  it('renders a fixed price as a label and an amount', () => {
    const result = presentPrice(
      { price_state: 'FIXED', price_minor: 1_250_000, price_from_minor: null, currency: 'INR' },
      labels(),
    )
    expect(result).toEqual({ label: 'Price', amount: '₹12,500', state: 'FIXED' })
  })

  it('renders a starting-from price from price_from_minor', () => {
    const result = presentPrice(
      {
        price_state: 'STARTING_FROM',
        price_minor: null,
        price_from_minor: 450_000,
        currency: 'INR',
      },
      labels(),
    )
    expect(result?.label).toBe('From')
    expect(result?.amount).toBe('₹4,500')
  })

  it('uses "Starting from" when the owner has disabled "From"', () => {
    const result = presentPrice(
      {
        price_state: 'STARTING_FROM',
        price_minor: null,
        price_from_minor: 450_000,
        currency: 'INR',
      },
      labels({ from: null }),
    )
    expect(result?.label).toBe('Starting from')
  })

  it('gives a quote-only product a label and NO amount', () => {
    for (const state of ['REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const) {
      const result = presentPrice({ ...QUOTE, price_state: state }, labels())
      expect(result?.amount, state).toBeNull()
      expect(result?.label, state).not.toMatch(/\d/)
    }
  })

  it('renders no digit for a quote-only product even if a number somehow reached the row', () => {
    // The database refuses this combination outright. The assertion is that the presenter is a
    // second, independent refusal rather than a pass-through that trusts the row.
    const result = presentPrice(
      { price_state: 'REQUEST_QUOTE', price_minor: 999, price_from_minor: 999, currency: 'INR' },
      labels(),
    )
    expect(result?.amount).toBeNull()
  })

  it('renders the label alone when the currency is missing', () => {
    const result = presentPrice(
      { price_state: 'FIXED', price_minor: 1_250_000, price_from_minor: null, currency: null },
      labels(),
    )
    expect(result?.label).toBe('Price')
    expect(result?.amount).toBeNull()
  })

  it('renders nothing at all when the label row is missing', () => {
    expect(presentPrice(QUOTE, labels({ request_a_quote: null }))).toBeNull()
  })
})

describe('formatMinor', () => {
  it('asks Intl for the exponent instead of dividing by 100', () => {
    // JPY has no minor unit: 1200 is ¥1,200, not ¥12.
    expect(formatMinor(1200, 'JPY', 'en-US')).toContain('1,200')
    expect(formatMinor(120_000, 'USD', 'en-US')).toContain('1,200')
  })

  it('returns null for a currency code Intl does not know, rather than throwing', () => {
    expect(formatMinor(100, 'NOTACURRENCY')).toBeNull()
  })
})

describe('productBadges', () => {
  const base = {
    edition_state: null,
    edition_size: null,
    availability_state: null,
    is_customizable: false,
  } as const

  it('returns edition first, then availability, then customisation', () => {
    const badges = productBadges(
      {
        ...base,
        edition_state: 'LIMITED_EDITION',
        edition_size: 12,
        availability_state: 'MADE_TO_ORDER',
        is_customizable: true,
      },
      labels(),
    )
    expect(badges.map((badge) => badge.kind)).toEqual(['edition', 'availability', 'customizable'])
    expect(badges[0]?.detail).toBe(12)
  })

  it('gives OPEN_EDITION no badge — it is the absence of a scarcity claim', () => {
    expect(productBadges({ ...base, edition_state: 'OPEN_EDITION' }, labels())).toEqual([])
  })

  it('carries a number only for a limited edition', () => {
    const badges = productBadges({ ...base, edition_state: 'ONE_OF_ONE' }, labels())
    expect(badges[0]?.detail).toBeNull()
  })

  it('drops a badge whose label row is missing rather than showing the enum value', () => {
    const badges = productBadges(
      { ...base, availability_state: 'READY_STOCK' },
      labels({ ready_stock: null }),
    )
    expect(badges).toEqual([])
  })
})

/**
 * The exponent, which is the number the Studio and this module must agree on.
 *
 * The write side used to multiply by 100 whatever the currency said while this side divided by the
 * exponent Intl reports. They agree for INR and USD, which is why it survived review: every price
 * anyone had entered was in rupees. They disagree for every zero-decimal currency, and the
 * disagreement is a factor of a hundred in the direction that inflates a price.
 */
describe('currencyExponent', () => {
  it('is 2 for the two-decimal currencies the catalogue actually uses', () => {
    expect(currencyExponent('INR')).toBe(2)
    expect(currencyExponent('USD')).toBe(2)
    expect(currencyExponent('EUR')).toBe(2)
  })

  it('is 0 for a currency with no minor unit', () => {
    expect(currencyExponent('JPY')).toBe(0)
  })

  it('is null for a code Intl does not know, so a caller can refuse rather than guess', () => {
    expect(currencyExponent('NOTACURRENCY')).toBeNull()
  })

  it('round-trips a major amount through the exponent that formatMinor will divide by', () => {
    // What the Studio now does: scale by the currency's own exponent.
    const store = (major: number, currency: string) =>
      Math.round(major * 10 ** (currencyExponent(currency) ?? 2))

    expect(formatMinor(store(12_500, 'INR'), 'INR')).toContain('12,500')
    // The case the old ×100 got wrong: ¥1,200 stored as 120000 rendered as ¥120,000.
    expect(store(1_200, 'JPY')).toBe(1_200)
    expect(formatMinor(store(1_200, 'JPY'), 'JPY')).toContain('1,200')
  })

  it('formatMinor refuses an unknown currency rather than dividing by a guess', () => {
    expect(formatMinor(1_250_000, 'NOTACURRENCY')).toBeNull()
  })
})
