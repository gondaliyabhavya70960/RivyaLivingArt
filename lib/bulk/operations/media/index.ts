import { z } from 'zod'

import {
  listBulkMediaContext,
  setMediaColumns,
  setMediaTags,
} from '@/lib/supabase/repositories/bulk-media'

import { registerBulkOperation } from '../../registry'
import type { PreviewItem } from '../../types'

/**
 * FEAT §20's media operations: bulk tag, bulk move, bulk archive.
 *
 * FOUR COLUMNS ARE IMMUTABLE IN BULK AND REJECTED AT THE ENGINE, not at the form:
 * `rivya_asset_id`, `higgsfield_generation_id`, `is_ai_generated` and `is_concept`. The 250
 * manifest rows are operands on this surface, and the failure this closes is precise — selecting a
 * page of rows and clearing `is_concept` would LAUNDER A CONCEPT RENDER INTO A REAL ASSET, after
 * which nothing downstream could tell it from a photograph of something that exists. D6 and D10.
 * The list lives on `IMMUTABLE_MEDIA_COLUMNS` in the repository — where the write is, not where
 * the operation is — and is asserted by
 * `tests/unit/bulk-media-immutable.test.ts`, so the list cannot be quietly shortened.
 *
 * NO OPERATION HERE CREATES, GENERATES OR DELETES AN ASSET. Archive is the only removal, it is a
 * status change, and it is undoable for 24 hours like every other destructive operation.
 */

const tagParams = z
  .object({
    tags: z.array(z.string().trim().min(1).max(48)).min(1).max(24),
    mode: z.enum(['ADD', 'REPLACE']),
  })
  .strict()

const moveParams = z.object({ folder: z.string().trim().min(1).max(200) }).strict()

const archiveParams = z.object({}).strict()

function missingAsset(entityId: string): PreviewItem {
  return {
    entityId,
    outcome: 'INVALID',
    rule: 'row_missing',
    reason: 'That asset no longer exists.',
  }
}

/**
 * Register this module's operations.
 *
 * EXPORTED AS WELL AS CALLED, so the register can be rebuilt after `resetBulkOperations()`. A
 * module's side effect runs once per process; a test that clears the register and re-imports gets
 * an empty one, which is how this was found.
 */
export function registerMediaOperations(): void {
  registerBulkOperation({
    kind: 'media.tag',
    targetEntity: 'media_asset',
    paramsSchema: tagParams,
    isDestructive: false,
    preview: async (context, selection, params) => {
      const rows = await listBulkMediaContext(context.admin, selection)
      const byId = new Map(rows.map((row) => [row.id, row]))
      return selection.map((entityId) => {
        const row = byId.get(entityId)
        if (row === undefined) return missingAsset(entityId)
        if (params.mode === 'ADD' && params.tags.every((tag) => row.tags.includes(tag))) {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already carries those tags.',
            label: row.label,
          }
        }
        return { entityId, outcome: 'APPLY', label: row.label }
      })
    },
    applyItem: async (context, entityId, params) =>
      setMediaTags(context.admin, entityId, params.tags, params.mode),
  })

  /**
   * `media.move` — change an asset's folder.
   *
   * NOT DESTRUCTIVE, WHICH THE PHASE DOCUMENT LEAVES OPEN ("bulk media folder move that breaks a
   * live reference" is listed as destructive). The reading here is narrower and, I think, truer: a
   * folder in this schema is a Cloudinary path recorded on the row, and moving it breaks nothing —
   * `media_usages` binds by id, and every renderer resolves through `public_id`. What WOULD be
   * destructive is a move that changed `public_id`, and no operation does that. The preview reports
   * how many live usages each asset has so the operator can see what they are touching, and a
   * genuine reference-breaking move would need a different operation than this one.
   */
  registerBulkOperation({
    kind: 'media.move',
    targetEntity: 'media_asset',
    paramsSchema: moveParams,
    isDestructive: false,
    preview: async (context, selection, params) => {
      const rows = await listBulkMediaContext(context.admin, selection)
      const byId = new Map(rows.map((row) => [row.id, row]))
      return selection.map((entityId) => {
        const row = byId.get(entityId)
        if (row === undefined) return missingAsset(entityId)
        if (row.folder === params.folder) {
          return { entityId, outcome: 'SKIP', reason: 'Already in that folder.', label: row.label }
        }
        return {
          entityId,
          outcome: 'APPLY',
          label: row.label,
          ...(row.usageCount > 0
            ? {
                reason: `Used in ${row.usageCount} place(s); the binding is by id and is unaffected.`,
              }
            : {}),
        }
      })
    },
    applyItem: async (context, entityId, params) =>
      setMediaColumns(context.admin, entityId, { folder: params.folder }),
  })

  registerBulkOperation({
    kind: 'media.archive',
    targetEntity: 'media_asset',
    paramsSchema: archiveParams,
    isDestructive: true,
    preview: async (context, selection) => {
      const rows = await listBulkMediaContext(context.admin, selection)
      const byId = new Map(rows.map((row) => [row.id, row]))
      return selection.map((entityId) => {
        const row = byId.get(entityId)
        if (row === undefined) return missingAsset(entityId)
        if (row.status === 'ARCHIVED') {
          return { entityId, outcome: 'SKIP', reason: 'Already archived.', label: row.label }
        }
        /*
         * AN ASSET IN USE IS NOT REFUSED — IT IS REPORTED WITH ITS COUNT. Archiving a bound asset is
         * sometimes exactly what somebody means, and refusing it would mean unbinding forty pages by
         * hand first. What must never happen is archiving one WITHOUT KNOWING, so the count is in
         * the preview and the typed confirmation is already required by the destructive flag.
         */
        return {
          entityId,
          outcome: 'APPLY',
          label: row.label,
          ...(row.usageCount > 0 ? { reason: `Still used in ${row.usageCount} place(s).` } : {}),
        }
      })
    },
    applyItem: async (context, entityId) =>
      setMediaColumns(context.admin, entityId, { status: 'ARCHIVED' }),
  })
}

registerMediaOperations()
