import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requirePermission } from '@/lib/auth/require'
import type { Database } from '@/lib/supabase/database.types'
import {
  listRevisions as listRevisionRows,
  restoreRevisionRow,
} from '@/lib/supabase/repositories/cms'
import type { ContentRevision } from '@/lib/supabase/schemas'

import type { PublishDeps } from './publishing'

type Client = SupabaseClient<Database>

/**
 * Revision history.
 *
 * `snapshot()` IS NOT HERE, AND ITS ABSENCE IS THE DESIGN. Snapshots are written by the
 * `write_revision` trigger and by nothing else, so there is no TypeScript function that creates
 * one. That is what makes the history trustworthy: an audit trail with a public `snapshot()` in
 * front of it is one refactor away from a caller that forgets to call it, and a gap in an audit
 * trail is invisible by definition. The trigger cannot be forgotten.
 */

export async function listRevisions(
  client: Client,
  entityType: string,
  entityId: string,
  limit?: number,
): Promise<ContentRevision[]> {
  await requirePermission('content.read')
  return listRevisionRows(client, entityType, entityId, limit)
}

/**
 * Restore a section to an earlier revision.
 *
 * REQUIRES `content.publish` WHEN THE SECTION IS CURRENTLY PUBLISHED, and `content.write`
 * otherwise. The spec is silent on this and the difference matters: restoring onto a live page
 * changes what the public sees WITHOUT passing through the status workflow, which is the one thing
 * the twelve edges exist to prevent. An editor may roll back a draft freely; rolling back a live
 * page is a publishing decision wearing different clothes.
 *
 * The restore itself appends a revision — labelled RESTORE by the GUC the function sets — so the
 * history records the rollback rather than quietly rewinding to look as though nothing happened.
 */
export async function restoreRevision(
  input: {
    readonly entityType: 'page_section'
    readonly entityId: string
    readonly revisionNo: number
    readonly currentStatus: string
    readonly path: string | null
  },
  deps: PublishDeps,
): Promise<void> {
  await requirePermission(input.currentStatus === 'PUBLISHED' ? 'content.publish' : 'content.write')

  await restoreRevisionRow(
    deps.client,
    input.entityType,
    input.entityId,
    input.revisionNo,
    deps.actorId,
  )

  // Same rule as publishing: the cache is only touched after the database has committed, and only
  // for a page that actually has an address.
  if (input.path !== null) await deps.revalidate([input.path])
}
