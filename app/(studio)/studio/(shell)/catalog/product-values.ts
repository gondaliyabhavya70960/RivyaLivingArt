import type { ProductFormValues } from '@/components/studio/catalog/ProductForm'
import { currencyExponent } from '@/lib/catalog/price'
import { DIMENSION_KEYS, type ProductDraft } from '@/lib/catalog/validation'
import type { Product } from '@/lib/supabase/schemas'

/**
 * A stored product as the form's string values, and back again as a draft.
 *
 * IT LIVES BESIDE THE ACTIONS RATHER THAN IN THE FORM, because both the edit page and the publish
 * gate need the same conversion and the form is a Client Component — putting it there would ship
 * the mapping to the browser and give the server a second copy.
 *
 * AMOUNTS COME BACK IN MAJOR UNITS, matching what the form asks for and what `actions.ts` converts
 * on the way in — AND BY THE SAME EXPONENT IT USED. An earlier version fixed the divisor at 100 and
 * argued that a currency with no minor unit would round-trip anyway. That argument was true only
 * while the write path also multiplied by 100; it stopped being true the moment `money()` started
 * asking `Intl` for the currency's exponent, and it left the two halves of one conversion
 * disagreeing:
 *
 *     JPY (exponent 0)   editor types 1200  → stored 1200     → form reads back "12"
 *     KWD (exponent 3)   editor types 1200  → stored 1200000  → form reads back "12000.00"
 *
 * Neither is a save the editor made, and the second one saves BACK on the next submit — so a
 * merchandiser who opens a Kuwaiti product and presses Save with no edits multiplies its price by
 * a thousand. The exponent has to come from the same place at both ends, so it comes from
 * `currencyExponent` here too, off the row's own `currency`.
 *
 * A NULL CURRENCY FALLS BACK TO TWO and cannot actually be reached: `products_price_state_coherent`
 * permits a number only beside FIXED or STARTING_FROM, and both of those require a currency, so a
 * row with an amount and no currency does not exist. The fallback is there because the column is
 * nullable in the type, not because the case is real.
 */

function major(minor: number | null, currency: string | null): string {
  if (minor === null) return ''
  const exponent = (currency === null ? null : currencyExponent(currency)) ?? 2
  const value = minor / 10 ** exponent
  return Number.isInteger(value) ? String(value) : value.toFixed(exponent)
}

/** The empty form: every field blank, both booleans false, and no price state chosen for them. */
export function blankProductValues(): ProductFormValues {
  return {
    id: null,
    slug: '',
    sku: '',
    title: '',
    subtitle: '',
    summary: '',
    description: '',
    categoryId: '',
    // The safest default of the four: it carries no number and asserts nothing about cost.
    priceState: 'REQUEST_QUOTE',
    priceMajor: '',
    priceFromMajor: '',
    currency: '',
    availabilityState: '',
    editionState: '',
    editionSize: '',
    isCustomizable: false,
    isLargeFormat: false,
    sortOrder: '',
    heroMediaId: '',
    seoTitle: '',
    seoDescription: '',
    dimensions: {},
    materialIds: [],
  }
}

export function productFormValues(
  product: Product,
  materialIds: readonly string[],
): ProductFormValues {
  const stored = (product.dimensions ?? {}) as Record<string, unknown>
  const dimensions: Record<string, string> = {}
  for (const key of DIMENSION_KEYS) {
    const value = stored[key]
    if (typeof value === 'number') dimensions[key] = String(value)
  }

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku ?? '',
    title: product.title ?? '',
    subtitle: product.subtitle ?? '',
    summary: product.summary ?? '',
    description: product.description ?? '',
    categoryId: product.category_id ?? '',
    priceState: product.price_state,
    priceMajor: major(product.price_minor, product.currency),
    priceFromMajor: major(product.price_from_minor, product.currency),
    currency: product.currency ?? '',
    availabilityState: product.availability_state ?? '',
    editionState: product.edition_state ?? '',
    editionSize: product.edition_size === null ? '' : String(product.edition_size),
    isCustomizable: product.is_customizable,
    isLargeFormat: product.is_large_format,
    sortOrder: product.sort_order === null ? '' : String(product.sort_order),
    heroMediaId: product.hero_media_id ?? '',
    seoTitle: product.seo_title ?? '',
    seoDescription: product.seo_description ?? '',
    dimensions,
    materialIds,
  }
}

/** A stored row as the shape the FEAT §21 and §22 rules read. */
export function productDraft(product: Product): ProductDraft {
  return {
    slug: product.slug,
    sku: product.sku,
    title: product.title,
    subtitle: product.subtitle,
    summary: product.summary,
    description: product.description,
    category_id: product.category_id,
    price_state: product.price_state,
    price_minor: product.price_minor,
    price_from_minor: product.price_from_minor,
    currency: product.currency,
    availability_state: product.availability_state,
    edition_state: product.edition_state,
    edition_size: product.edition_size,
    is_customizable: product.is_customizable,
    is_large_format: product.is_large_format,
    specifications_omitted: product.specifications_omitted,
    sort_order: product.sort_order,
    dimensions: product.dimensions,
    hero_media_id: product.hero_media_id,
    seo_title: product.seo_title,
    seo_description: product.seo_description,
  }
}
