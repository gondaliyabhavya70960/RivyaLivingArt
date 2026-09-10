import {
  validateProduct,
  type ProductContext,
  type ProductDraft,
  type ValidationIssue,
} from '@/lib/catalog/validation'

/**
 * The dry run: every FEAT §21 rule, per row, with a row number.
 *
 * IT DELEGATES TO `validateProduct` RATHER THAN RE-IMPLEMENTING ANY RULE. Duplicate SKU, duplicate
 * slug, impossible dimensions, malformed URL, invalid price state, a quote-only row carrying a
 * price — all of it is already written once, is unit-tested, and is what the single-product editor
 * enforces. An import that validated differently from the editor would be a second definition of
 * "a valid product", and the looser one would be this one.
 *
 * WHAT IS ADDED HERE IS EVERYTHING THAT IS TRUE OF A FILE RATHER THAN OF A ROW: the coercion of
 * text cells into typed values, and duplicate detection WITHIN THE UPLOAD. Two rows in the same
 * file claiming the same SKU pass a per-row check individually — neither exists in the database
 * yet — and would insert two products a moment apart. That is exactly the failure a bulk import
 * makes easy, and it is caught here.
 *
 * EVERY IMPORTED ROW LANDS AS `DRAFT` AND IMPORT CAN NEVER PUBLISH. That is not enforced by a rule
 * in this file; it is enforced by `apply.ts` not writing the column at all, which is stronger.
 */

export interface ImportIssue {
  readonly rule: string
  readonly message: string
  readonly field?: string
}

export interface ValidatedRow {
  readonly rowNumber: number
  readonly mapped: Record<string, unknown>
  readonly issues: readonly ImportIssue[]
  readonly action: 'INSERT' | 'UPDATE' | 'SKIP'
  /** The existing product this row updates, when its slug or SKU already exists. */
  readonly targetProductId: string | null
}

export interface ImportContext {
  /** slug → id, for every existing product. An import updates rather than duplicating. */
  readonly productIdBySlug: ReadonlyMap<string, string>
  readonly productIdBySku: ReadonlyMap<string, string>
  /** slug → id. A category the file names but the database lacks is an error, not a creation. */
  readonly categoryIdBySlug: ReadonlyMap<string, string>
}

const BOOLEANS: Record<string, boolean> = {
  true: true,
  yes: true,
  y: true,
  '1': true,
  false: false,
  no: false,
  n: false,
  '0': false,
}

function coerce(field: string, value: string): { value: unknown; issue?: ImportIssue } {
  switch (field) {
    case 'price_minor':
    case 'price_from_minor':
    case 'edition_size': {
      // MINOR UNITS, AND THE FILE SAYS SO OR IT DOES NOT PARSE. `4500.00` is rejected rather than
      // silently read as 4500 paise: a decimal point in a minor-unit column means the operator is
      // thinking in rupees, and guessing which would put a price on the site that nobody typed.
      if (!/^\d+$/.test(value)) {
        return {
          value: null,
          issue: {
            rule: 'number_shape',
            field,
            message: `"${value}" is not a whole number. Prices are in the smallest unit — paise, not rupees.`,
          },
        }
      }
      return { value: Number(value) }
    }
    case 'is_customizable':
    case 'is_large_format': {
      const parsed = BOOLEANS[value.toLowerCase()]
      if (parsed === undefined) {
        return {
          value: null,
          issue: { rule: 'boolean_shape', field, message: `"${value}" is not yes or no.` },
        }
      }
      return { value: parsed }
    }
    default:
      return { value }
  }
}

/**
 * A validated row set.
 *
 * DUPLICATES WITHIN THE FILE ARE FOUND BY ACCUMULATING AS WE GO, so the SECOND occurrence is the
 * one flagged. That is deliberate: the first row is what the operator meant, and reporting both
 * would make them wonder which to delete.
 */
export function validateImport(
  rows: ReadonlyArray<{ rowNumber: number; mapped: Record<string, string> }>,
  context: ImportContext,
): ValidatedRow[] {
  const seenSlugs = new Set<string>()
  const seenSkus = new Set<string>()

  return rows.map((row) => {
    const issues: ImportIssue[] = []
    const mapped: Record<string, unknown> = {}

    for (const [field, value] of Object.entries(row.mapped)) {
      const coerced = coerce(field, value)
      if (coerced.issue) issues.push(coerced.issue)
      else mapped[field] = coerced.value
    }

    const slug = typeof mapped['slug'] === 'string' ? mapped['slug'] : ''
    const sku = typeof mapped['sku'] === 'string' ? mapped['sku'] : ''

    if (slug === '') {
      issues.push({ rule: 'slug_required', field: 'slug', message: 'A slug is required.' })
    } else if (seenSlugs.has(slug)) {
      issues.push({
        rule: 'slug_duplicate_in_file',
        field: 'slug',
        message: `An earlier row in this file already uses the slug "${slug}".`,
      })
    }
    if (sku !== '' && seenSkus.has(sku)) {
      issues.push({
        rule: 'sku_duplicate_in_file',
        field: 'sku',
        message: `An earlier row in this file already uses the SKU "${sku}".`,
      })
    }
    seenSlugs.add(slug)
    if (sku !== '') seenSkus.add(sku)

    // A CATEGORY IS RESOLVED, NEVER CREATED. An import that invented taxonomy would let a typo
    // become a category page.
    let categoryId: string | null = null
    const categorySlug = typeof mapped['category_slug'] === 'string' ? mapped['category_slug'] : ''
    if (categorySlug !== '') {
      categoryId = context.categoryIdBySlug.get(categorySlug) ?? null
      if (categoryId === null) {
        issues.push({
          rule: 'category_unknown',
          field: 'category_slug',
          message: `There is no category with the slug "${categorySlug}".`,
        })
      }
    }

    const existingId =
      (slug === '' ? undefined : context.productIdBySlug.get(slug)) ??
      (sku === '' ? undefined : context.productIdBySku.get(sku)) ??
      null

    const draft: ProductDraft = {
      slug,
      sku: sku === '' ? null : sku,
      title: (mapped['title'] as string | undefined) ?? '',
      subtitle: (mapped['subtitle'] as string | undefined) ?? null,
      summary: (mapped['summary'] as string | undefined) ?? null,
      description: (mapped['description'] as string | undefined) ?? null,
      category_id: categoryId,
      price_state: (mapped['price_state'] as ProductDraft['price_state']) ?? 'REQUEST_QUOTE',
      price_minor: (mapped['price_minor'] as number | undefined) ?? null,
      price_from_minor: (mapped['price_from_minor'] as number | undefined) ?? null,
      currency: (mapped['currency'] as string | undefined) ?? null,
      availability_state:
        (mapped['availability_state'] as ProductDraft['availability_state']) ?? null,
      edition_state: (mapped['edition_state'] as ProductDraft['edition_state']) ?? null,
      edition_size: (mapped['edition_size'] as number | undefined) ?? null,
      is_customizable: (mapped['is_customizable'] as boolean | undefined) ?? false,
      is_large_format: (mapped['is_large_format'] as boolean | undefined) ?? false,
      dimensions: null,
      hero_media_id: null,
      seo_title: (mapped['seo_title'] as string | undefined) ?? null,
      seo_description: (mapped['seo_description'] as string | undefined) ?? null,
    }

    // The editor's own rules, unchanged. `takenSlugs`/`takenSkus` exclude the row being updated,
    // which is what makes re-importing the same file a no-op rather than a wall of duplicates.
    const productContext: ProductContext = {
      takenSlugs: new Set(
        [...context.productIdBySlug.keys()].filter(
          (key) => context.productIdBySlug.get(key) !== existingId,
        ),
      ),
      takenSkus: new Set(
        [...context.productIdBySku.keys()].filter(
          (key) => context.productIdBySku.get(key) !== existingId,
        ),
      ),
    }

    for (const issue of validateProduct(draft, productContext) as readonly ValidationIssue[]) {
      issues.push({ rule: issue.code, field: issue.field, message: issue.message })
    }

    const action: ValidatedRow['action'] =
      issues.length > 0 ? 'SKIP' : existingId !== null ? 'UPDATE' : 'INSERT'

    return {
      rowNumber: row.rowNumber,
      mapped: { ...mapped, category_id: categoryId },
      issues,
      action,
      targetProductId: existingId,
    }
  })
}
