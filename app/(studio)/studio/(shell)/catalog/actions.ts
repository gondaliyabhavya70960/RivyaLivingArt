'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { writeAudit, withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import {
  readinessChecklist,
  readinessSnapshot,
  unmetForPublish,
  validateProduct,
  type ProductDraft,
  type ValidationIssue,
} from '@/lib/catalog/validation'
import { createClient } from '@/lib/supabase/server'
import { productDraft } from './product-values'
import {
  getProductById,
  insertCollection,
  insertMaterial,
  insertProduct,
  listProductMaterialIds,
  listProductMediaIds,
  setProductMaterials,
  takenProductIdentifiers,
  updateCategoryRow,
  updateCollectionRow,
  updateMaterialRow,
  updateProduct,
} from '@/lib/supabase/repositories/catalog-admin'
import { listConceptMediaAssets, listMediaAssets } from '@/lib/supabase/repositories/media'

/**
 * The catalogue editor's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT. A Server Action passes through no page
 * body, no layout and no proxy matcher: it is reachable with `curl` and a session cookie, so the
 * `requirePermission` call inside each one is the only check that runs. `catalog.write` for edits,
 * `catalog.publish` for a status change — the two are separate permissions and are checked
 * separately, so a role could hold one without the other.
 *
 * WRITES USE THE REQUEST-SCOPED CLIENT, never the service role, so RLS refuses underneath the guard
 * as well as beside it. `products_insert_staff` and `products_update_staff` admit only `owner`,
 * `admin` and `merchandiser`.
 *
 * VALIDATION RUNS HERE, NOT ONLY IN THE FORM. `lib/catalog/validation.ts` is pure and shared, so
 * the form and this file cannot drift into two definitions of a valid product — and a request that
 * skipped the form entirely still meets the same rules.
 *
 * EVERY REFUSAL RETURNS A RESULT, NEVER THROWS. A thrown Server Action renders the error boundary
 * and loses whatever the editor had typed. The issues come back attached to their fields.
 */

export type CatalogActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved'; readonly id: string }
  | { readonly status: 'error'; readonly issues: readonly ValidationIssue[] }

/** A refusal that is nobody's field in particular. */
function formIssue(message: string, code = 'refused'): CatalogActionState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  return 'That change could not be saved.'
}

// --- form parsing ------------------------------------------------------------------------------

/** `''` is what an untouched text input submits, and it means "not set", not "the empty string". */
function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * A money field, entered in MAJOR units and stored in minor.
 *
 * AN EDITOR TYPES 12500, NOT 1250000. Asking someone to type an amount in paise is asking for a
 * price wrong by two orders of magnitude, and the catalogue would show it without complaint. The
 * conversion happens once, here, and `lib/catalog/price.ts` reverses it once, there.
 */
function money(form: FormData, name: string): number | null | 'invalid' {
  const raw = text(form, name)
  if (raw === null) return null
  const cleaned = raw.replace(/[\s,]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return 'invalid'
  return Math.round(Number(cleaned) * 100)
}

function integer(form: FormData, name: string): number | null | 'invalid' {
  const raw = text(form, name)
  if (raw === null) return null
  if (!/^-?\d+$/.test(raw)) return 'invalid'
  return Number(raw)
}

function checkbox(form: FormData, name: string): boolean {
  return form.get(name) !== null
}

/** `dimensions` arrive as one numeric input per key, so a malformed blob cannot be pasted in. */
function dimensions(form: FormData): { value: Record<string, number> | null; invalid: string[] } {
  const keys = [
    'length_mm',
    'width_mm',
    'height_mm',
    'depth_mm',
    'diameter_mm',
    'weight_g',
    'seats',
  ]
  const value: Record<string, number> = {}
  const invalid: string[] = []
  for (const key of keys) {
    const raw = text(form, `dimensions.${key}`)
    if (raw === null) continue
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      invalid.push(key)
      continue
    }
    value[key] = Number(raw)
  }
  return { value: Object.keys(value).length === 0 ? null : value, invalid }
}

const priceStateSchema = z.enum(['FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST'])
const availabilitySchema = z.enum(['READY_STOCK', 'MADE_TO_ORDER'])
const editionSchema = z.enum(['ONE_OF_ONE', 'LIMITED_EDITION', 'OPEN_EDITION'])

interface ParsedProductForm {
  readonly draft: ProductDraft
  readonly materialIds: readonly string[]
  readonly issues: readonly ValidationIssue[]
}

function parseProductForm(form: FormData): ParsedProductForm {
  const issues: ValidationIssue[] = []

  const priceState = priceStateSchema.safeParse(form.get('price_state'))
  const availability = availabilitySchema.safeParse(form.get('availability_state'))
  const edition = editionSchema.safeParse(form.get('edition_state'))

  if (!priceState.success) {
    issues.push({
      field: 'price_state',
      code: 'price_state_invalid',
      message: 'Choose one of the four price states.',
    })
  }

  const priceMinor = money(form, 'price_major')
  const priceFromMinor = money(form, 'price_from_major')
  for (const [field, value] of [
    ['price_major', priceMinor],
    ['price_from_major', priceFromMinor],
  ] as const) {
    if (value === 'invalid') {
      issues.push({
        field,
        code: 'amount_shape',
        message: 'An amount is a number, optionally with two decimal places.',
      })
    }
  }

  const editionSize = integer(form, 'edition_size')
  if (editionSize === 'invalid') {
    issues.push({
      field: 'edition_size',
      code: 'edition_size_shape',
      message: 'An edition size is a whole number.',
    })
  }

  const sortOrder = integer(form, 'sort_order')
  if (sortOrder === 'invalid') {
    issues.push({
      field: 'sort_order',
      code: 'sort_order_shape',
      message: 'An order position is a whole number.',
    })
  }

  const dims = dimensions(form)
  for (const key of dims.invalid) {
    issues.push({
      field: 'dimensions',
      code: 'dimensions_not_a_number',
      message: `${key} must be a positive number.`,
    })
  }

  const draft: ProductDraft = {
    slug: (text(form, 'slug') ?? '').toLowerCase(),
    sku: text(form, 'sku'),
    title: text(form, 'title'),
    subtitle: text(form, 'subtitle'),
    summary: text(form, 'summary'),
    description: text(form, 'description'),
    category_id: text(form, 'category_id'),
    price_state: priceState.success ? priceState.data : 'REQUEST_QUOTE',
    price_minor: priceMinor === 'invalid' ? null : priceMinor,
    price_from_minor: priceFromMinor === 'invalid' ? null : priceFromMinor,
    currency: text(form, 'currency')?.toUpperCase() ?? null,
    availability_state: availability.success ? availability.data : null,
    edition_state: edition.success ? edition.data : null,
    edition_size: editionSize === 'invalid' ? null : editionSize,
    is_customizable: checkbox(form, 'is_customizable'),
    is_large_format: checkbox(form, 'is_large_format'),
    sort_order: sortOrder === 'invalid' ? null : sortOrder,
    dimensions: dims.value,
    hero_media_id: text(form, 'hero_media_id'),
    seo_title: text(form, 'seo_title'),
    seo_description: text(form, 'seo_description'),
  }

  return {
    draft,
    materialIds: form.getAll('material_ids').filter((v): v is string => typeof v === 'string'),
    issues,
  }
}

/** The row shape a draft becomes. Kept beside the parser so a new column cannot be forgotten. */
function productValues(draft: ProductDraft, actorId: string) {
  return {
    slug: draft.slug,
    sku: draft.sku,
    title: draft.title,
    subtitle: draft.subtitle ?? null,
    summary: draft.summary ?? null,
    description: draft.description,
    category_id: draft.category_id,
    price_state: draft.price_state,
    price_minor: draft.price_minor,
    price_from_minor: draft.price_from_minor,
    currency: draft.currency,
    availability_state: draft.availability_state,
    edition_state: draft.edition_state,
    edition_size: draft.edition_size,
    is_customizable: draft.is_customizable,
    is_large_format: draft.is_large_format,
    sort_order: draft.sort_order ?? null,
    dimensions: (draft.dimensions ?? null) as never,
    hero_media_id: draft.hero_media_id,
    seo_title: draft.seo_title,
    seo_description: draft.seo_description,
    updated_by: actorId,
  }
}

/**
 * The world facts the FEAT §21 rules need.
 *
 * READ ON EVERY SAVE, not cached. Duplicate detection against a stale list is duplicate detection
 * that lets a duplicate through — and the unique constraints underneath would then answer with a
 * 23505 the editor cannot read.
 */
async function contextFor(
  client: Awaited<ReturnType<typeof createClient>>,
  productId: string | null,
) {
  const [identifiers, media, concept, materialIds, galleryMediaIds] = await Promise.all([
    takenProductIdentifiers(client, productId),
    listMediaAssets(client, { limit: 1000 }),
    listConceptMediaAssets(client),
    productId === null ? Promise.resolve([]) : listProductMaterialIds(client, productId),
    productId === null ? Promise.resolve([]) : listProductMediaIds(client, productId),
  ])

  return {
    takenSlugs: identifiers.slugs,
    takenSkus: identifiers.skus,
    knownMediaIds: new Set(media.map((asset) => asset.id)),
    conceptMediaIds: new Set(concept.map((asset) => asset.id)),
    materialIds,
    galleryMediaIds,
  }
}

function revalidateCatalog(path: string | null): void {
  revalidatePath('/studio/catalog/products')
  revalidatePath('/collection')
  if (path !== null) revalidatePath(path)
}

// --- products ----------------------------------------------------------------------------------

export async function saveProductAction(
  _previous: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const client = await createClient()

    const productId = text(form, 'id')
    const { draft, materialIds, issues } = parseProductForm(form)

    // The chosen materials become part of the context so the readiness snapshot written below
    // reflects what is about to be saved rather than what was there before.
    const context = { ...(await contextFor(client, productId)), materialIds }
    const all = [...issues, ...validateProduct(draft, context)]
    if (all.length > 0) return { status: 'error', issues: all }

    const values = productValues(draft, session.userId)
    const readiness = readinessSnapshot(readinessChecklist(draft, context))

    const saved = await withAudit(
      {
        action: productId === null ? 'catalog.product.create' : 'catalog.product.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'products',
        entityId: productId ?? undefined,
        summary: `${productId === null ? 'Created' : 'Updated'} product ${draft.slug}`,
        after: values as never,
      },
      async () =>
        productId === null
          ? insertProduct(client, { ...values, publication_readiness: readiness as never })
          : updateProduct(client, productId, {
              ...values,
              publication_readiness: readiness as never,
            }),
    )

    await setProductMaterials(client, saved.id, materialIds, session.userId)

    revalidateCatalog(`/studio/catalog/products/${saved.id}`)
    return { status: 'saved', id: saved.id }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

/**
 * Publishing, gated by the FEAT §22 checklist.
 *
 * THE UNMET ITEMS ARE NAMED IN THE REFUSAL. "Cannot publish" tells an editor to guess; "Hero image,
 * SEO" tells them what to do next. The checklist is recomputed from the SAVED row rather than from
 * the form, because publishing is an operation on what is stored — a form that was never submitted
 * must not be able to satisfy the gate.
 */
export async function publishProductAction(
  _previous: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  try {
    const session = await requirePermission('catalog.publish')
    const client = await createClient()

    const productId = text(form, 'id')
    if (productId === null) return formIssue('That product could not be found.', 'missing_id')

    const product = await getProductById(client, productId)
    const context = await contextFor(client, productId)
    const checklist = readinessChecklist(productDraft(product), context)
    const unmet = unmetForPublish(checklist)

    if (unmet.length > 0) {
      await writeAudit({
        action: 'catalog.product.publish',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'products',
        entityId: productId,
        summary: `Publication refused: ${unmet.join(', ')} not met`,
      })
      return {
        status: 'error',
        issues: unmet.map((item) => ({
          field: 'publish',
          code: 'readiness_unmet',
          message: item,
        })),
      }
    }

    await withAudit(
      {
        action: 'catalog.product.publish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'products',
        entityId: productId,
        summary: `Published product ${product.slug}`,
      },
      async () =>
        updateProduct(client, productId, {
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
          published_by: session.userId,
          publication_readiness: readinessSnapshot(checklist) as never,
          updated_by: session.userId,
        }),
    )

    revalidateCatalog(`/studio/catalog/products/${productId}`)
    return { status: 'saved', id: productId }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

export async function unpublishProductAction(
  _previous: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  try {
    const session = await requirePermission('catalog.publish')
    const client = await createClient()

    const productId = text(form, 'id')
    if (productId === null) return formIssue('That product could not be found.', 'missing_id')

    await withAudit(
      {
        action: 'catalog.product.unpublish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'products',
        entityId: productId,
        summary: 'Unpublished product',
      },
      async () =>
        updateProduct(client, productId, {
          status: 'DRAFT',
          published_at: null,
          published_by: null,
          updated_by: session.userId,
        }),
    )

    revalidateCatalog(`/studio/catalog/products/${productId}`)
    return { status: 'saved', id: productId }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

// --- categories, materials, collections ----------------------------------------------------------

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

function slugIssue(): CatalogActionState {
  return {
    status: 'error',
    issues: [
      {
        field: 'slug',
        code: 'slug_shape',
        message: 'A slug may contain lowercase letters, numbers and single hyphens only.',
      },
    ],
  }
}

/**
 * A category is EDITED, never created or deleted here.
 *
 * The seven are D3's taxonomy and the site's route map: `/collection/[category]` pre-renders them,
 * the mega menu lists them, and `content/seed/taxonomy.ts` owns them. An eighth typed into Studio
 * would have copy nobody wrote and a page nobody designed; removing one would break a published
 * URL. What an owner legitimately changes is what this accepts: the wording, the order, the hero
 * image and the SEO fields.
 */
export async function saveCategoryAction(
  _previous: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const client = await createClient()

    const id = text(form, 'id')
    if (id === null) return formIssue('That category could not be found.', 'missing_id')

    const sortOrder = integer(form, 'sort_order')
    if (sortOrder === 'invalid' || sortOrder === null) {
      return {
        status: 'error',
        issues: [
          {
            field: 'sort_order',
            code: 'sort_order_shape',
            message: 'An order position is a whole number.',
          },
        ],
      }
    }

    const values = {
      name: text(form, 'name') ?? '',
      subtitle: text(form, 'subtitle'),
      description: text(form, 'description'),
      sort_order: sortOrder,
      hero_media_id: text(form, 'hero_media_id'),
      seo_title: text(form, 'seo_title'),
      seo_description: text(form, 'seo_description'),
      updated_by: session.userId,
    }

    if (values.name === '') {
      return {
        status: 'error',
        issues: [{ field: 'name', code: 'name_required', message: 'A category needs a name.' }],
      }
    }

    await withAudit(
      {
        action: 'catalog.category.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'categories',
        entityId: id,
        summary: `Updated category ${values.name}`,
        after: values as never,
      },
      async () => updateCategoryRow(client, id, values),
    )

    revalidatePath('/studio/catalog/categories')
    revalidatePath('/collection')
    return { status: 'saved', id }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

export async function saveMaterialAction(
  _previous: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const client = await createClient()

    const id = text(form, 'id')
    const slug = (text(form, 'slug') ?? '').toLowerCase()
    if (!slugSchema.safeParse(slug).success) return slugIssue()

    const name = text(form, 'name')
    if (name === null) {
      return {
        status: 'error',
        issues: [{ field: 'name', code: 'name_required', message: 'A material needs a name.' }],
      }
    }

    const values = {
      slug,
      name,
      family: text(form, 'family') ?? '',
      description: text(form, 'description'),
      updated_by: session.userId,
    }

    const saved = await withAudit(
      {
        action: id === null ? 'catalog.material.create' : 'catalog.material.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'materials',
        entityId: id ?? undefined,
        summary: `${id === null ? 'Created' : 'Updated'} material ${name}`,
        after: values as never,
      },
      async () =>
        id === null ? insertMaterial(client, values) : updateMaterialRow(client, id, values),
    )

    revalidatePath('/studio/catalog/materials')
    return { status: 'saved', id: saved.id }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

/**
 * A collection stays a CONCEPT.
 *
 * FEAT §9: every collection Rivya has not confirmed is `DRAFT_COLLECTION_CONCEPT`, and this action
 * never sets `concept_state` to anything else — Phase 16 adds the owner confirmation that can. A
 * concept collection is therefore never publishable from here, which is why this form has no
 * publish control at all rather than one that always refuses.
 */
export async function saveCollectionAction(
  _previous: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const client = await createClient()

    const id = text(form, 'id')
    const slug = (text(form, 'slug') ?? '').toLowerCase()
    if (!slugSchema.safeParse(slug).success) return slugIssue()

    const name = text(form, 'name')
    if (name === null) {
      return {
        status: 'error',
        issues: [{ field: 'name', code: 'name_required', message: 'A collection needs a name.' }],
      }
    }

    const sortOrder = integer(form, 'sort_order')
    const values = {
      slug,
      name,
      statement: text(form, 'statement'),
      sort_order: sortOrder === 'invalid' || sortOrder === null ? 0 : sortOrder,
      updated_by: session.userId,
    }

    const saved = await withAudit(
      {
        action: id === null ? 'catalog.collection.create' : 'catalog.collection.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'collections',
        entityId: id ?? undefined,
        summary: `${id === null ? 'Created' : 'Updated'} collection ${name}`,
        after: values as never,
      },
      async () =>
        id === null ? insertCollection(client, values) : updateCollectionRow(client, id, values),
    )

    revalidatePath('/studio/catalog/collections')
    return { status: 'saved', id: saved.id }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}
