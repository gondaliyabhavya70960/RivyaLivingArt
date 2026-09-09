'use server'

import { revalidatePath } from 'next/cache'

import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import type { ValidationIssue } from '@/lib/catalog/validation'
import { updateProduct } from '@/lib/supabase/repositories/catalog-admin'
import {
  PRODUCT_MEDIA_ROLES,
  RELATION_TARGET_TYPES,
  RELATION_TYPES,
  deleteProductRelation,
  insertProductRelation,
  listProductMaterialLinks,
  listProductMediaEdgesForStudio,
  setProductMaterialLinks,
  setProductMediaEdges,
  type ProductMediaRole,
  type RelationTargetType,
  type RelationType,
} from '@/lib/supabase/repositories/product-edges'
import {
  deleteProductSpec,
  insertProductSpec,
  updateProductSpec,
} from '@/lib/supabase/repositories/product-specs'
import { createClient } from '@/lib/supabase/server'

/**
 * The four product tabs' Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT — reachable with `curl` and a session
 * cookie, through no page body, no layout and no proxy matcher. So `requirePermission` inside each
 * one is the only check that runs, and every action here calls it first. Reads use the same
 * request-scoped client, so RLS refuses underneath the guard as well as beside it.
 *
 * SEPARATE FROM `catalog/actions.ts` RATHER THAN APPENDED TO IT. That file is already the product
 * form, the category form, the material form and the collection form; adding four more surfaces
 * would make one module the write path for most of the Studio. The split is by SCREEN, which is
 * also the boundary the audit entries are grouped along.
 *
 * EVERY ACTION RETURNS A RESULT AND NEVER THROWS. A thrown Server Action renders the error boundary
 * and discards whatever the editor had typed.
 *
 * NOTHING HERE RE-IMPLEMENTS A DATABASE RULE. The concept-media refusal is a trigger, the blank
 * label refusal is a check constraint, the duplicate label refusal is a unique index. What these
 * actions do is parse a form, refuse what is not parseable in words a person can act on, and let
 * the database answer for the rest — `refusalMessage` turns what comes back into a sentence rather
 * than swallowing it.
 */

export type TabActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved' }
  | { readonly status: 'error'; readonly issues: readonly ValidationIssue[] }

function formIssue(message: string, code = 'refused'): TabActionState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  // A trigger or constraint message is the most useful thing available and is not leaked verbatim:
  // it names internal identifiers. The specific refusals an editor can act on are worded above.
  return 'That change could not be saved.'
}

/** `''` is what an untouched input submits, and it means "not set", not "the empty string". */
function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * An integer position, defaulting to 0.
 *
 * NOT `Number(raw) || 0`. That reads "0" as falsy and an unparseable "first" as 0, which is the
 * defect the collection form carried: an editor typing something the field cannot store was told
 * it saved and got a value they did not choose. Here a non-integer is `null` and the caller
 * refuses it.
 */
function position(form: FormData, name: string): number | null {
  const raw = text(form, name)
  if (raw === null) return 0
  if (!/^-?\d+$/.test(raw)) return null
  return Number(raw)
}

function requireId(form: FormData, name: string): string | null {
  return text(form, name)
}

function revalidateProduct(productId: string): void {
  revalidatePath(`/studio/catalog/products/${productId}`, 'layout')
  revalidatePath('/studio/catalog/products')
  revalidatePath('/collection')
}

// --- Media --------------------------------------------------------------------------------------

/**
 * Attach one asset, or update the role and position of one already attached.
 *
 * ONE ROW AT A TIME, not a whole-form replace. The Media tab is a list of small forms rather than
 * one big one, so a concept asset refused by the Phase 14 trigger costs the editor that row's
 * submission and nothing else — a single form would have lost every other edit on the screen to one
 * refused attachment.
 */
export async function saveProductMediaAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const mediaAssetId = requireId(form, 'media_asset_id')
    if (productId === null || mediaAssetId === null) {
      return formIssue('That product or asset could not be found.', 'missing_id')
    }

    const rawRole = text(form, 'role')
    if (rawRole !== null && !(PRODUCT_MEDIA_ROLES as readonly string[]).includes(rawRole)) {
      return {
        status: 'error',
        issues: [{ field: 'role', code: 'role_unknown', message: 'That is not a media role.' }],
      }
    }
    const role = rawRole === null ? null : (rawRole as ProductMediaRole)

    const sortOrder = position(form, 'sort_order')
    if (sortOrder === null) {
      return {
        status: 'error',
        issues: [
          {
            field: 'sort_order',
            code: 'sort_order_shape',
            message: 'A position is a whole number.',
          },
        ],
      }
    }

    const client = await createClient()
    const current = await listProductMediaEdgesForStudio(client, productId)
    const next = [
      ...current.filter((edge) => edge.mediaAssetId !== mediaAssetId),
      { mediaAssetId, role, sortOrder },
    ]

    await withAudit(
      {
        action: 'catalog.product.media',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_media',
        entityId: productId,
        summary: `Attached or updated media ${mediaAssetId} on product ${productId}`,
        after: { mediaAssetId, role, sortOrder } as never,
      },
      () => setProductMediaEdges(client, productId, next, session.userId),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

export async function detachProductMediaAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const mediaAssetId = requireId(form, 'media_asset_id')
    if (productId === null || mediaAssetId === null) {
      return formIssue('That product or asset could not be found.', 'missing_id')
    }

    const client = await createClient()
    const current = await listProductMediaEdgesForStudio(client, productId)

    await withAudit(
      {
        action: 'catalog.product.media',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_media',
        entityId: productId,
        summary: `Detached media ${mediaAssetId} from product ${productId}`,
      },
      () =>
        setProductMediaEdges(
          client,
          productId,
          current.filter((edge) => edge.mediaAssetId !== mediaAssetId),
          session.userId,
        ),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    // `setProductMediaEdges` raises PermissionError when a filtered DELETE removed nothing, so a
    // merchandiser is told they cannot detach rather than being shown a row that comes back.
    return formIssue(refusalMessage(error))
  }
}

// --- Materials ----------------------------------------------------------------------------------

export async function saveProductMaterialAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const materialId = requireId(form, 'material_id')
    if (productId === null || materialId === null) {
      return formIssue('That product or material could not be found.', 'missing_id')
    }

    // A blank note is null, not '': the column is nullable and "no note" is not "an empty note".
    const note = text(form, 'note')

    const client = await createClient()
    const current = await listProductMaterialLinks(client, productId)
    const next = [...current.filter((link) => link.materialId !== materialId), { materialId, note }]

    await withAudit(
      {
        action: 'catalog.product.materials',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_materials',
        entityId: productId,
        summary: `Attached or updated material ${materialId} on product ${productId}`,
        after: { materialId, note } as never,
      },
      () => setProductMaterialLinks(client, productId, next, session.userId),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

export async function detachProductMaterialAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const materialId = requireId(form, 'material_id')
    if (productId === null || materialId === null) {
      return formIssue('That product or material could not be found.', 'missing_id')
    }

    const client = await createClient()
    const current = await listProductMaterialLinks(client, productId)

    await withAudit(
      {
        action: 'catalog.product.materials',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_materials',
        entityId: productId,
        summary: `Detached material ${materialId} from product ${productId}`,
      },
      () =>
        setProductMaterialLinks(
          client,
          productId,
          current.filter((link) => link.materialId !== materialId),
          session.userId,
        ),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

// --- Specifications -----------------------------------------------------------------------------

/**
 * Add or edit one specification row.
 *
 * THE BLANK-FIELD RULE IS THE POINT OF THIS ACTION. `label` and `value` are both required, and
 * "required" here does NOT mean "fill something in": it means a row exists only when the owner has
 * something to say. An editor who does not know a measurement leaves the row out, and the block
 * simply has one fewer line — there is no placeholder to write, no `—` to select and no "contact
 * us" option, because each of those tells a visitor a value exists.
 *
 * NOTHING IS PARSED OUT OF `value`. It is stored and rendered as typed, so "450", "45 – 50" and
 * "made to order" all survive intact. The moment this action tried to read a number out of it, the
 * site would be one refactor away from converting units.
 */
export async function saveProductSpecAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    if (productId === null) return formIssue('That product could not be found.', 'missing_id')

    const specId = requireId(form, 'spec_id')
    const label = text(form, 'label')
    const value = text(form, 'value')

    const issues: ValidationIssue[] = []
    if (label === null) {
      issues.push({
        field: 'label',
        code: 'label_required',
        message: 'A specification needs a label.',
      })
    }
    if (value === null) {
      issues.push({
        field: 'value',
        code: 'value_required',
        message: 'A specification needs a value. Leave the whole row out if you do not have one.',
      })
    }

    const sortOrder = position(form, 'sort_order')
    if (sortOrder === null) {
      issues.push({
        field: 'sort_order',
        code: 'sort_order_shape',
        message: 'A position is a whole number.',
      })
    }
    if (issues.length > 0 || label === null || value === null || sortOrder === null) {
      return { status: 'error', issues }
    }

    const client = await createClient()
    const values = {
      product_id: productId,
      label,
      value,
      unit: text(form, 'unit'),
      group_label: text(form, 'group_label'),
      sort_order: sortOrder,
      updated_by: session.userId,
    }

    await withAudit(
      {
        action: specId === null ? 'catalog.product.spec.create' : 'catalog.product.spec.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_specs',
        entityId: specId ?? undefined,
        summary: `${specId === null ? 'Added' : 'Updated'} specification "${label}" on product ${productId}`,
        after: values as never,
      },
      async () =>
        specId === null
          ? insertProductSpec(client, values)
          : updateProductSpec(client, specId, values),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

export async function deleteProductSpecAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const specId = requireId(form, 'spec_id')
    if (productId === null || specId === null) {
      return formIssue('That specification could not be found.', 'missing_id')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.product.spec.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_specs',
        entityId: specId,
        summary: `Deleted specification ${specId} from product ${productId}`,
      },
      () => deleteProductSpec(client, specId),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

/**
 * Record — or withdraw — the decision that this piece publishes no specifications.
 *
 * ITS OWN ACTION, AND ITS OWN AUDIT ENTRY. This is the one control on the Studio that can satisfy a
 * required readiness item without any content behind it, so who set it and when is worth keeping.
 * It is deliberately not a field on the product form: saving an unrelated edit must never restore
 * or clear it.
 */
export async function setSpecificationsOmittedAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    if (productId === null) return formIssue('That product could not be found.', 'missing_id')

    // An unchecked checkbox submits nothing at all, which is what makes it a two-way control: the
    // absence of the field is the decision being withdrawn, not the field being left alone.
    const omitted = form.get('specifications_omitted') !== null

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.product.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'products',
        entityId: productId,
        summary: omitted
          ? `Recorded that product ${productId} publishes no specifications`
          : `Withdrew the no-specifications decision on product ${productId}`,
        after: { specifications_omitted: omitted } as never,
      },
      () =>
        updateProduct(client, productId, {
          specifications_omitted: omitted,
          updated_by: session.userId,
        }),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

// --- Related ------------------------------------------------------------------------------------

/**
 * Create one relation edge, by hand.
 *
 * BOTH VOCABULARIES ARE CHECKED AGAINST A CLOSED LIST, which is FEAT §11's "no relation is
 * invented" at the only place an edge can be made. A `relation_type` this file does not know is
 * refused rather than stored: the column is plain `text`, so anything written here is what the
 * renderer will later have to interpret.
 */
export async function createProductRelationAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const targetId = requireId(form, 'target_id')
    if (productId === null || targetId === null) {
      return formIssue('That product or target could not be found.', 'missing_id')
    }

    const rawTargetType = text(form, 'target_type')
    const rawRelationType = text(form, 'relation_type')

    const issues: ValidationIssue[] = []
    if (
      rawTargetType === null ||
      !(RELATION_TARGET_TYPES as readonly string[]).includes(rawTargetType)
    ) {
      issues.push({
        field: 'target_type',
        code: 'target_type_unknown',
        message: 'That is not something a product can point at.',
      })
    }
    if (
      rawRelationType === null ||
      !(RELATION_TYPES as readonly string[]).includes(rawRelationType)
    ) {
      issues.push({
        field: 'relation_type',
        code: 'relation_type_unknown',
        message: 'That is not a relation this site knows how to render.',
      })
    }
    if (targetId === productId) {
      issues.push({
        field: 'target_id',
        code: 'self_relation',
        message: 'A product cannot be related to itself.',
      })
    }

    const sortOrder = position(form, 'sort_order')
    if (sortOrder === null) {
      issues.push({
        field: 'sort_order',
        code: 'sort_order_shape',
        message: 'A position is a whole number.',
      })
    }
    if (
      issues.length > 0 ||
      rawTargetType === null ||
      rawRelationType === null ||
      sortOrder === null
    ) {
      return { status: 'error', issues }
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.product.relation.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_relations',
        entityId: productId,
        summary: `Related product ${productId} to ${rawTargetType} ${targetId}`,
        after: { targetType: rawTargetType, targetId, relationType: rawRelationType } as never,
      },
      () =>
        insertProductRelation(
          client,
          {
            sourceProductId: productId,
            targetType: rawTargetType as RelationTargetType,
            targetId,
            relationType: rawRelationType as RelationType,
            sortOrder,
          },
          session.userId,
        ),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

export async function deleteProductRelationAction(
  _previous: TabActionState,
  form: FormData,
): Promise<TabActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const productId = requireId(form, 'product_id')
    const relationId = requireId(form, 'relation_id')
    if (productId === null || relationId === null) {
      return formIssue('That relation could not be found.', 'missing_id')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.product.relation.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_relations',
        entityId: relationId,
        summary: `Removed relation ${relationId} from product ${productId}`,
      },
      () => deleteProductRelation(client, relationId),
    )

    revalidateProduct(productId)
    return { status: 'saved' }
  } catch (error) {
    return formIssue(refusalMessage(error))
  }
}

/*
 * NO READ HELPERS ARE EXPORTED FROM THIS FILE, and that is a rule rather than an omission.
 *
 * A draft of it ended with `export async function currentSpecs(productId)` — a convenience for the
 * pages, and a specification-reading HTTP endpoint for anyone with a session cookie and the file's
 * action id, with no `requirePermission` in it at all. Every export of a `'use server'` module is
 * published; a read is not exempt because it does not write. The tabs are Server Components and
 * call the repositories directly, through the request-scoped client, so RLS answers for them.
 */
