import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { Product } from '@/lib/supabase/schemas'

/**
 * The commerce vocabulary: the only place a price becomes words, and the only place a badge does.
 *
 * THE RISK THIS MODULE EXISTS TO REMOVE. Three of the four price states carry no number. A card
 * that formats `price_minor` without asking which state it is in renders "₹0" for a piece whose
 * price is "Request a Quote" — a number Rivya never gave, presented as one it did. The database
 * makes that impossible to STORE (`products_price_state_coherent` keeps the numeric columns null
 * for both quote states); this makes it impossible to DISPLAY, so neither layer is the only thing
 * standing between a visitor and an invented price.
 *
 * EVERY WORD COMES FROM `global_content`, group `COMMERCE_LABEL` (SEED §30, D2). Not one of them is
 * a literal in a component. If a label row is missing or disabled, the piece of the card it names
 * renders NOTHING — no key, no placeholder, no English fallback. `lib/cms/strings.ts` explains
 * why at length: a default here would put a sentence on the public site that nobody wrote.
 *
 * THE TWO SPELLINGS OF ONE STATE. SEED §30 lists both `From` and `Starting from`, which are the
 * same label for `STARTING_FROM` written two ways. Both are seeded, and the owner chooses between
 * them in Studio by DISABLING the one they do not want: this resolves `From` first and falls back
 * to `Starting from`, so disabling `From` switches the site to the longer spelling and disabling
 * neither leaves the shorter one, which is what fits on a card. Documented in CONTENT_GUIDE.md.
 */

const GROUP = 'COMMERCE_LABEL'

/** Keys as `content/seed/commerce-labels.ts` derives them from the label text. */
export const PRICE_LABEL_KEYS = {
  fixed: `${GROUP}.price`,
  from: `${GROUP}.from`,
  startingFrom: `${GROUP}.starting_from`,
  requestQuote: `${GROUP}.request_a_quote`,
  priceOnRequest: `${GROUP}.price_on_request`,
} as const

export const BADGE_LABEL_KEYS = {
  READY_STOCK: `${GROUP}.ready_stock`,
  MADE_TO_ORDER: `${GROUP}.made_to_order`,
  ONE_OF_ONE: `${GROUP}.one_of_one`,
  LIMITED_EDITION: `${GROUP}.limited_edition`,
  customizable: `${GROUP}.customizable`,
} as const

/**
 * What a card shows where the price goes.
 *
 * `amount` IS NULL FOR EVERY QUOTE STATE, and callers must render the label alone rather than
 * substituting anything for the missing number. `null` for the whole result means even the label
 * is unavailable, and the card shows no price row at all.
 */
export interface PresentedPrice {
  readonly label: string
  readonly amount: string | null
  /** For tests and for the card's `data-price-state` hook. */
  readonly state: Product['price_state']
}

/**
 * Minor units to a formatted amount.
 *
 * THE EXPONENT IS ASKED FOR, NOT ASSUMED. Dividing by 100 is right for INR and USD and wrong for
 * JPY, which has no minor unit at all — a ¥1,200 piece stored as 1200 would render as ¥12. `Intl`
 * knows the exponent for every currency it supports, so it is asked.
 *
 * Returns null rather than throwing on a currency code `Intl` does not know: a malformed row must
 * cost a visitor a price line, never the whole page.
 */
export function formatMinor(minor: number, currency: string, locale = 'en-IN'): string | null {
  try {
    const format = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // A catalogue price is a headline, not an invoice line: 12,500 reads better than 12,500.00,
      // and every price this site shows is a round number in the smallest unit anyway.
      maximumFractionDigits: 0,
    })
    // `maximumFractionDigits` is optional in the TypeScript lib types even though every runtime
    // resolves it for a currency format; 2 is the ISO 4217 default for the codes that omit it.
    const exponent =
      new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    return format.format(minor / 10 ** exponent)
  } catch {
    return null
  }
}

/** The `STARTING_FROM` label, honouring the owner's choice between the two seeded spellings. */
function startingFromLabel(strings: SiteStrings): string | null {
  return (
    siteString(strings, PRICE_LABEL_KEYS.from) ??
    siteString(strings, PRICE_LABEL_KEYS.startingFrom)
  )
}

export function presentPrice(
  product: Pick<Product, 'price_state' | 'price_minor' | 'price_from_minor' | 'currency'>,
  strings: SiteStrings,
  locale?: string,
): PresentedPrice | null {
  const state = product.price_state

  switch (state) {
    case 'FIXED': {
      const label = siteString(strings, PRICE_LABEL_KEYS.fixed)
      if (label === null) return null
      const amount =
        product.price_minor !== null && product.currency !== null
          ? formatMinor(product.price_minor, product.currency, locale)
          : null
      return { label, amount, state }
    }
    case 'STARTING_FROM': {
      const label = startingFromLabel(strings)
      if (label === null) return null
      const amount =
        product.price_from_minor !== null && product.currency !== null
          ? formatMinor(product.price_from_minor, product.currency, locale)
          : null
      return { label, amount, state }
    }
    case 'REQUEST_QUOTE': {
      const label = siteString(strings, PRICE_LABEL_KEYS.requestQuote)
      return label === null ? null : { label, amount: null, state }
    }
    case 'PRICE_ON_REQUEST': {
      const label = siteString(strings, PRICE_LABEL_KEYS.priceOnRequest)
      return label === null ? null : { label, amount: null, state }
    }
  }
}

/**
 * The state badges a card may carry.
 *
 * AT MOST TWO REACH THE CARD, and that cap is the card's, not this function's: this returns every
 * badge the row justifies, in priority order — edition, then availability, then customisation —
 * and `ProductCard` takes the first two. Edition leads because scarcity is the claim a collector
 * reads first and the only one the database forces to be specific (`LIMITED_EDITION` must state
 * its size).
 *
 * `OPEN_EDITION` HAS NO BADGE. "Open edition" is the absence of a scarcity claim, and a badge
 * saying so is noise on every card that is not limited. It is a filter value, not a label.
 */
export interface ProductBadge {
  readonly kind: 'edition' | 'availability' | 'customizable'
  readonly key: string
  readonly label: string
  /** `LIMITED_EDITION` alone carries a number, and only when the row states one. */
  readonly detail: number | null
}

export function productBadges(
  product: Pick<Product, 'edition_state' | 'edition_size' | 'availability_state' | 'is_customizable'>,
  strings: SiteStrings,
): readonly ProductBadge[] {
  const badges: ProductBadge[] = []

  if (product.edition_state === 'ONE_OF_ONE' || product.edition_state === 'LIMITED_EDITION') {
    const key = BADGE_LABEL_KEYS[product.edition_state]
    const label = siteString(strings, key)
    if (label !== null) {
      badges.push({
        kind: 'edition',
        key,
        label,
        detail: product.edition_state === 'LIMITED_EDITION' ? product.edition_size : null,
      })
    }
  }

  if (product.availability_state !== null) {
    const key = BADGE_LABEL_KEYS[product.availability_state]
    const label = siteString(strings, key)
    if (label !== null) badges.push({ kind: 'availability', key, label, detail: null })
  }

  if (product.is_customizable) {
    const label = siteString(strings, BADGE_LABEL_KEYS.customizable)
    if (label !== null) {
      badges.push({ kind: 'customizable', key: BADGE_LABEL_KEYS.customizable, label, detail: null })
    }
  }

  return badges
}
