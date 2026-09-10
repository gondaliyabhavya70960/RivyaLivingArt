import type { ParsedFile } from './parse'

/**
 * Column mapping: which column of the operator's file is which product field.
 *
 * THE MAPPING IS THEIRS, NOT OURS. A guess is offered — a header called "SKU" almost certainly is
 * one — but nothing is applied without the operator confirming, because the failure mode of a
 * confident guess is silent: a column called "Price" mapped to `price_minor` turns ₹4,500 into
 * ₹45. So `suggestColumnMap` proposes and the form decides.
 *
 * ONLY THE FIELDS AN IMPORT MAY SET ARE MAPPABLE. `status` is not among them — every imported row
 * lands as DRAFT and import can never publish (SEED §32) — and neither is `owner_verification`,
 * because a spreadsheet cannot verify a business fact.
 */

export const IMPORTABLE_FIELDS = [
  'slug',
  'sku',
  'title',
  'subtitle',
  'summary',
  'description',
  'category_slug',
  'price_state',
  'price_minor',
  'price_from_minor',
  'currency',
  'availability_state',
  'edition_state',
  'edition_size',
  'is_customizable',
  'is_large_format',
  'seo_title',
  'seo_description',
] as const

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number]

/** `Price (minor)` → `price_minor`. Punctuation and case are noise; word order is not. */
function normalise(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const ALIASES: Record<string, ImportableField> = {
  product_name: 'title',
  name: 'title',
  product_title: 'title',
  code: 'sku',
  item_code: 'sku',
  category: 'category_slug',
  price: 'price_minor',
  starting_price: 'price_from_minor',
  short_description: 'summary',
  long_description: 'description',
  large_format: 'is_large_format',
  customisable: 'is_customizable',
  customizable: 'is_customizable',
}

/** A proposal, never an application. The operator confirms every pair. */
export function suggestColumnMap(file: ParsedFile): Record<string, ImportableField> {
  const map: Record<string, ImportableField> = {}
  const taken = new Set<ImportableField>()

  for (const header of file.headers) {
    const key = normalise(header)
    const direct = (IMPORTABLE_FIELDS as readonly string[]).includes(key)
      ? (key as ImportableField)
      : ALIASES[key]
    // A field already claimed by an earlier column is not claimed twice: two columns both called
    // "Price" would otherwise silently give the second one the field.
    if (direct !== undefined && !taken.has(direct)) {
      map[header] = direct
      taken.add(direct)
    }
  }

  return map
}

/** Apply a confirmed mapping to one row. Unmapped columns are dropped, not guessed at. */
export function applyColumnMap(
  file: ParsedFile,
  columnMap: Record<string, string>,
  cells: readonly string[],
): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [index, header] of file.headers.entries()) {
    const field = columnMap[header]
    if (field === undefined || field === '') continue
    const value = cells[index]
    if (value === undefined || value === '') continue
    mapped[field] = value
  }
  return mapped
}

/** The row exactly as it was, keyed by header. Stored so an operator can see what they uploaded. */
export function rawRow(file: ParsedFile, cells: readonly string[]): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const [index, header] of file.headers.entries()) raw[header] = cells[index] ?? ''
  return raw
}
