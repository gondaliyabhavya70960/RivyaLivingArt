import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requirePermission } from '@/lib/auth/require'
import type { Database } from '@/lib/supabase/database.types'
import {
  publishSection as publishSectionRow,
  reorderSections as reorderSectionRows,
  unpublishMediaAsset as unpublishMediaAssetRow,
} from '@/lib/supabase/repositories/cms'
import type { PublishResult } from '@/lib/supabase/schemas'

import { permissionForTransition, type ContentStatus } from './transitions'

type Client = SupabaseClient<Database>

/**
 * The publishing service — the only thing that moves a section between statuses.
 *
 * TWO GUARDS, ON PURPOSE, AND THEY ARE NOT REDUNDANT. This module checks the permission before
 * calling the database, and `enforce_status_transition` checks it again inside. The TypeScript
 * check exists to produce an error a person can act on and to avoid opening a transaction that
 * cannot succeed; the SQL check exists because PostgREST is reachable with an anon key and a
 * session cookie and never runs a line of this file. Removing either leaves a real hole.
 *
 * `revalidate` IS INJECTED RATHER THAN IMPORTED, and that is the design decision worth defending.
 * If this module imported `revalidatePath` from `next/cache` it could not be unit-tested outside a
 * request scope, and — more importantly — the cache call would sit in the same try block as the
 * write. A publish that is REFUSED must not evict a cache entry that is still correct: the page it
 * describes has not changed, and dropping it turns a policy refusal into a latency spike for every
 * visitor. Injection makes "revalidate only on success" structural rather than remembered.
 */

export type PublishDeps = {
  /** The SERVICE-ROLE client. `cms_publish_section` grants EXECUTE to nothing else. */
  readonly client: Client
  readonly actorId: string | null
  /**
   * Called ONLY after the database has committed, and only with paths the function returned.
   * `next/cache`'s `revalidatePath` in production; a spy in tests.
   */
  readonly revalidate: (paths: readonly string[]) => Promise<void> | void
}

export type PublishInput = {
  readonly sectionId: string
  readonly from: ContentStatus
  readonly to: ContentStatus
  readonly changeSummary?: string | null
}

/**
 * Move a section, promoting its bound media atomically, then revalidate.
 *
 * The order is the contract: permission, then the database, then the cache. Nothing is revalidated
 * if the database refused — see the note above.
 */
export async function publishSection(
  input: PublishInput,
  deps: PublishDeps,
): Promise<PublishResult> {
  const permission = permissionForTransition(input.from, input.to)

  // `null` means the edge does not exist. Refusing here rather than letting the database do it
  // keeps an impossible move from looking like a permissions problem in the Studio.
  if (permission === null) {
    throw new Error(
      `no transition from ${input.from} to ${input.to}. ` +
        'The twelve legal edges are in lib/cms/transitions.ts.',
    )
  }

  await requirePermission(permission)

  const result = await publishSectionRow(deps.client, {
    sectionId: input.sectionId,
    to: input.to,
    actorId: deps.actorId,
    changeSummary: input.changeSummary ?? null,
  })

  // Only now. A refused publish reached neither this line nor the cache.
  if (result.paths.length > 0) await deps.revalidate(result.paths)

  return result
}

/**
 * Demote an asset to APPROVED. Refused while any PUBLISHED section still shows it.
 *
 * Gated on `media.write` rather than `content.publish`: this is an act on the media library, and
 * the person doing it is looking at the Media Manager, not at a page.
 */
export async function unpublishMediaAsset(mediaId: string, deps: PublishDeps): Promise<void> {
  await requirePermission('media.write')
  await unpublishMediaAssetRow(deps.client, mediaId, deps.actorId)
}

/**
 * Reorder a page's sections in one statement.
 *
 * `content.write`, not `content.publish` — moving a block up the page is editing, not publishing,
 * even when the page happens to be live. The revalidation still has to happen, because the live
 * page's order changed.
 */
export async function reorderSections(
  pageId: string,
  sectionIds: readonly string[],
  path: string | null,
  deps: PublishDeps,
): Promise<number> {
  await requirePermission('content.write')
  const count = await reorderSectionRows(deps.client, pageId, sectionIds, deps.actorId)
  if (path !== null) await deps.revalidate([path])
  return count
}
