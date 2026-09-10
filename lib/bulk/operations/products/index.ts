import { z } from 'zod'

import { readinessChecklist, unmetForPublish } from '@/lib/catalog/validation'
import {
  listBulkProductContext,
  setProductColumns,
  setProductCollectionsBulk,
  setProductMaterialsBulk,
  type BulkProductRow,
} from '@/lib/supabase/repositories/bulk-products'
import { readImportSummary, undoImportRow } from '@/lib/supabase/repositories/bulk-import'
import { RELATION_VOCABULARY } from '@/lib/supabase/schemas'

import { applyImport } from '../../import/apply'
import { registerBulkOperation } from '../../registry'
import type { BulkOperationContext, PreviewItem } from '../../types'

/**
 * FEAT §20's product operations: publish, unpublish, archive, status, category, collections,
 * materials, media, tags.
 *
 * ONE FILE RATHER THAN THE NINE THE PHASE DOCUMENT'S DELIVERABLE TABLE NAMES, on the same
 * reasoning as the Phase 23 command providers: nine files differing in a Zod schema and one column
 * would be nine places for the destructive flag to be got wrong, and the one that mattered —
 * `product.archive` — would be the one nobody re-read. Here every operation's flag, guard and
 * params sit within a screen of each other, and a reviewer checks a list.
 *
 * `product.publish` RE-RUNS THE READINESS CHECKLIST PER ROW, IN PREVIEW AND AGAIN IN APPLY, and
 * there is no force flag. FEAT §22's checklist is what stands between a half-finished row and a
 * public page, and a bulk path that skipped it would be the fastest way to publish twelve products
 * with no hero and no price state. Rows that fail are LISTED WITH THE ITEMS THEY ARE MISSING and
 * excluded — never force-published, never silently dropped.
 *
 * NOTHING HERE HARD-DELETES, and there is no operation that could. Archive is the only removal.
 */

const noParams = z.object({}).strict()

const isUuid = z.uuid()

/** The four states a bulk status change may move a row to. ARCHIVED has its own operation. */
const statusParams = z
  .object({ status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED']) })
  .strict()

const categoryParams = z.object({ categoryId: isUuid }).strict()
const collectionsParams = z.object({ collectionIds: z.array(isUuid).max(24) }).strict()
const materialsParams = z.object({ materialIds: z.array(isUuid).max(24) }).strict()
const mediaParams = z.object({ mediaAssetId: isUuid }).strict()
const tagsParams = z
  .object({ relationType: z.enum(RELATION_VOCABULARY), termIds: z.array(isUuid).max(24) })
  .strict()

/** Every preview in this file starts by reading the same rows, so it is read once. */
async function loadRows(
  context: BulkOperationContext,
  selection: readonly string[],
): Promise<Map<string, BulkProductRow>> {
  const rows = await listBulkProductContext(context.admin, selection)
  return new Map(rows.map((row) => [row.id, row]))
}

function missingRow(entityId: string): PreviewItem {
  return {
    entityId,
    outcome: 'INVALID',
    rule: 'row_missing',
    reason: 'That piece no longer exists.',
  }
}

/**
 * Register this module's operations.
 *
 * EXPORTED AS WELL AS CALLED, so the register can be rebuilt after `resetBulkOperations()`. A
 * module's side effect runs once per process; a test that clears the register and re-imports gets
 * an empty one, which is how this was found.
 */
export function registerProductOperations(): void {
  // --- publish ---------------------------------------------------------------------------------------

  registerBulkOperation({
    kind: 'product.publish',
    targetEntity: 'product',
    paramsSchema: noParams,
    isDestructive: false,
    preview: async (context, selection) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (row.status === 'PUBLISHED') {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already published.',
            label: row.title ?? row.slug,
          }
        }

        const unmet = unmetForPublish(readinessChecklist(row.draft, row.context))
        if (unmet.length > 0) {
          // NAMED, NOT COUNTED. "3 items missing" tells an editor to go and look; "Hero image,
          // Materials, SEO" tells them what to do.
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'publication_readiness',
            reason: `Not ready: ${unmet.join(', ')}.`,
            label: row.title ?? row.slug,
          }
        }

        // D10's gate, restated where the operator can see it BEFORE they press Apply rather than as
        // a constraint violation afterwards.
        if (row.owner_verification === 'OWNER_VERIFICATION_REQUIRED') {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'owner_verification',
            reason: 'The owner has not verified this piece yet.',
            label: row.title ?? row.slug,
          }
        }

        return { entityId, outcome: 'APPLY', label: row.title ?? row.slug }
      })
    },
    applyItem: async (context, entityId) =>
      setProductColumns(context.admin, entityId, {
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
        published_by: context.actor.userId,
      }),
  })

  // --- unpublish and archive -------------------------------------------------------------------------
  //
  // BOTH DESTRUCTIVE, and the reason is the same for each: a live page stops being reachable. That
  // is not the same act as editing a draft, and it is what `destructive.execute` plus a typed row
  // count exist to slow down.

  for (const [kind, status, verb] of [
    ['product.unpublish', 'DRAFT', 'unpublished'],
    ['product.archive', 'ARCHIVED', 'archived'],
  ] as const) {
    registerBulkOperation({
      kind,
      targetEntity: 'product',
      paramsSchema: noParams,
      isDestructive: true,
      preview: async (context, selection) => {
        const rows = await loadRows(context, selection)
        return selection.map((entityId) => {
          const row = rows.get(entityId)
          if (row === undefined) return missingRow(entityId)
          if (row.status === status) {
            return {
              entityId,
              outcome: 'SKIP',
              reason: `Already ${verb}.`,
              label: row.title ?? row.slug,
            }
          }
          return { entityId, outcome: 'APPLY', label: row.title ?? row.slug }
        })
      },
      applyItem: async (context, entityId) =>
        setProductColumns(context.admin, entityId, { status }),
    })
  }

  // --- status ------------------------------------------------------------------------------------------

  registerBulkOperation({
    kind: 'product.set_status',
    targetEntity: 'product',
    paramsSchema: statusParams,
    /**
     * CONDITIONALLY DESTRUCTIVE, and this is the case the contract's function form exists for. Moving
     * DRAFT to REVIEW is an ordinary editorial step; moving a row OUT of PUBLISHED takes a live page
     * off the site. Treating them alike would either put an owner in front of every workflow nudge or
     * let an unpublish through on a merchandiser's say-so.
     *
     * The params alone cannot tell: the destructiveness depends on where the rows are NOW. So the
     * flag is true whenever the target is not PUBLISHED — the honest over-approximation — and the
     * preview reports which rows are actually leaving PUBLISHED.
     */
    isDestructive: (params) => params.status !== 'PUBLISHED',
    preview: async (context, selection, params) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (row.status === params.status) {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already in that state.',
            label: row.title ?? row.slug,
          }
        }
        if (params.status === 'PUBLISHED') {
          const unmet = unmetForPublish(readinessChecklist(row.draft, row.context))
          if (unmet.length > 0) {
            return {
              entityId,
              outcome: 'INVALID',
              rule: 'publication_readiness',
              reason: `Not ready: ${unmet.join(', ')}.`,
              label: row.title ?? row.slug,
            }
          }
        }
        const leaving = row.status === 'PUBLISHED' ? ' This takes it off the site.' : ''
        return {
          entityId,
          outcome: 'APPLY',
          ...(leaving === '' ? {} : { reason: leaving.trim() }),
          label: row.title ?? row.slug,
        }
      })
    },
    applyItem: async (context, entityId, params) =>
      setProductColumns(context.admin, entityId, { status: params.status }),
  })

  // --- category, collections, materials, media, tags -----------------------------------------------------

  registerBulkOperation({
    kind: 'product.set_category',
    targetEntity: 'product',
    paramsSchema: categoryParams,
    isDestructive: false,
    preview: async (context, selection, params) => {
      const rows = await loadRows(context, selection)
      // THE TARGET MUST EXIST AND BE PUBLISHED. Moving a page of products into a draft category takes
      // them off every listing without changing their own status, which reads as data loss.
      const target = await listBulkProductContext(context.admin, [], {
        categoryId: params.categoryId,
      })
      const categoryOk = target.categoryIsPublished === true

      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (!categoryOk) {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'target_not_published',
            reason: 'That category is not published.',
            label: row.title ?? row.slug,
          }
        }
        if (row.category_id === params.categoryId) {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already in that category.',
            label: row.title ?? row.slug,
          }
        }
        return { entityId, outcome: 'APPLY', label: row.title ?? row.slug }
      })
    },
    applyItem: async (context, entityId, params) =>
      setProductColumns(context.admin, entityId, { category_id: params.categoryId }),
  })

  registerBulkOperation({
    kind: 'product.set_collections',
    targetEntity: 'product',
    paramsSchema: collectionsParams,
    isDestructive: false,
    preview: async (context, selection) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        return row === undefined
          ? missingRow(entityId)
          : { entityId, outcome: 'APPLY' as const, label: row.title ?? row.slug }
      })
    },
    applyItem: async (context, entityId, params) =>
      setProductCollectionsBulk(
        context.admin,
        entityId,
        params.collectionIds,
        context.actor.userId,
      ),
  })

  registerBulkOperation({
    kind: 'product.set_materials',
    targetEntity: 'product',
    paramsSchema: materialsParams,
    isDestructive: false,
    preview: async (context, selection) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        return row === undefined
          ? missingRow(entityId)
          : { entityId, outcome: 'APPLY' as const, label: row.title ?? row.slug }
      })
    },
    applyItem: async (context, entityId, params) =>
      setProductMaterialsBulk(context.admin, entityId, params.materialIds, context.actor.userId),
  })

  registerBulkOperation({
    kind: 'product.assign_media',
    targetEntity: 'product',
    paramsSchema: mediaParams,
    isDestructive: false,
    preview: async (context, selection, params) => {
      const rows = await loadRows(context, selection)
      const asset = await listBulkProductContext(context.admin, [], {
        mediaAssetId: params.mediaAssetId,
      })

      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        /*
         * A CONCEPT ASSET IS REFUSED HERE, BEFORE APPLY, AND AGAIN BY THE PHASE 14 TRIGGER.
         *
         * The trigger is the real guarantee; this is so the operator SEES the refusal in the preview
         * rather than as a post-hoc failure on 40 of 47 rows. D6 and D10: a concept render is a
         * picture of something that does not exist, and a bulk assignment is exactly how one would
         * get laundered into being a product's hero.
         */
        if (asset.mediaIsConcept === true) {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'concept_asset',
            reason: 'That is a concept render and cannot become a product image.',
            label: row.title ?? row.slug,
          }
        }
        if (asset.mediaExists !== true) {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'media_missing',
            reason: 'That asset could not be found.',
            label: row.title ?? row.slug,
          }
        }
        if (row.hero_media_id === params.mediaAssetId) {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already the hero image.',
            label: row.title ?? row.slug,
          }
        }
        return { entityId, outcome: 'APPLY', label: row.title ?? row.slug }
      })
    },
    applyItem: async (context, entityId, params) =>
      setProductColumns(context.admin, entityId, { hero_media_id: params.mediaAssetId }),
  })

  /**
   * `product.set_tags` — attribute terms only, and there is no free-text path.
   *
   * `product_attribute_terms` SHIPS WITH ZERO ROWS, so this operation can apply nothing until an
   * owner creates and verifies a term. That is the shipped state rather than a gap: a free-text tag
   * field on a bulk surface is how a page of products acquires a claim nobody made.
   */
  registerBulkOperation({
    kind: 'product.set_tags',
    targetEntity: 'product',
    paramsSchema: tagsParams,
    isDestructive: false,
    preview: async (context, selection, params) => {
      const rows = await loadRows(context, selection)
      const terms = await listBulkProductContext(context.admin, [], { termIds: params.termIds })

      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (terms.unknownTermIds !== undefined && terms.unknownTermIds.length > 0) {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'term_unknown',
            reason: 'One of those terms does not exist, or is not published.',
            label: row.title ?? row.slug,
          }
        }
        return { entityId, outcome: 'APPLY', label: row.title ?? row.slug }
      })
    },
    applyItem: async (context, entityId, params) =>
      setProductColumns(
        context.admin,
        entityId,
        {},
        {
          tagRelation: params.relationType,
          termIds: params.termIds,
          actorId: context.actor.userId,
        },
      ),
  })

  // --- import ------------------------------------------------------------------------------------
  //
  // `product.import` IS THE ONE OPERATION WHOSE SELECTED "ENTITY" IS NOT A PRODUCT. Its selection is
  // a single `bulk_imports` id, because the unit of an import is the FILE: a row it will insert has
  // no product id yet, so there is nothing to select. The engine does not mind — it iterates ids and
  // calls `applyItem` — and the per-row detail lives where it belongs, in `bulk_import_rows`, which
  // is retained for thirty days and is what an operator reads when they ask why a row was skipped.
  //
  // GOING THROUGH THE ENGINE RATHER THAN AROUND IT is what makes an import audited, previewable and
  // undoable on the same terms as everything else. The alternative — an import that wrote directly
  // — would be the second bulk path `check-bulk-registry.mjs` exists to prevent, and the one with no
  // undo.
  //
  // THE PREVIEW READS THE DRY RUN'S OWN COUNTS rather than recomputing them: the dry run already
  // validated every row against `lib/catalog/validation.ts` and stored the result, and validating a
  // second time here would be a second definition of "a valid import row".

  registerBulkOperation({
    kind: 'product.import',
    targetEntity: 'product',
    paramsSchema: z.object({ importId: isUuid }).strict(),
    isDestructive: false,
    preview: async (context, selection, params) => {
      const summary = await readImportSummary(context.admin, params.importId)
      return selection.map((entityId) => {
        if (summary === null) {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'import_missing',
            reason: 'That import could not be found.',
          }
        }
        if (summary.applicable === 0) {
          return {
            entityId,
            outcome: 'SKIP',
            reason: `Nothing to apply: ${summary.invalid} row(s) failed validation.`,
            label: summary.filename,
          }
        }
        return {
          entityId,
          outcome: 'APPLY',
          label: summary.filename,
          reason: `${summary.inserts} new, ${summary.updates} updated, ${summary.invalid} excluded.`,
        }
      })
    },
    applyItem: async (context, _entityId, params) => {
      const outcome = await applyImport({
        importId: params.importId,
        actor: context.actor,
        // The engine's own row, so `bulk_imports.operation_id` points at the operation that applied
        // the file rather than at a placeholder. See BulkOperationContext on why it is optional.
        operationId: context.operationId ?? '',
      })
      return {
        // `before` IS THE UNDO INSTRUCTION, not a row snapshot: which products were created (archive
        // them) and what the updated ones looked like (write them back).
        before: { touched: outcome.touched },
        after: { applied: outcome.applied, skipped: outcome.skipped, failed: outcome.failed },
        // An import has no single row whose version could be compared, so undo's skip rule does not
        // apply to it. Null says so rather than inventing a timestamp.
        rowVersionForUndo: null,
      }
    },
    undoItem: async (context, _entityId, before) => {
      const touched =
        before !== null && typeof before === 'object' && 'touched' in before
          ? ((before as { touched?: unknown }).touched ?? [])
          : []
      if (!Array.isArray(touched)) return
      for (const entry of touched as Array<{
        productId: string
        before: Record<string, unknown> | null
      }>) {
        await undoImportRow(context.admin, entry)
      }
    },
  })
}

registerProductOperations()
