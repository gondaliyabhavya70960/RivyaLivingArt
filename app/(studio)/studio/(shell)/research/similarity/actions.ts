'use server'

import { revalidatePath } from 'next/cache'

import type { LibraryCheckState } from '@/components/studio/research/LibraryCheckPanel'
import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { libraryCheck } from '@/lib/media/library-check'
import { listMediaAssetHashes } from '@/lib/supabase/repositories/media-hashes'
import {
  closeSimilarityRun,
  openSimilarityRun,
} from '@/lib/supabase/repositories/research/similarity'
import { createClient } from '@/lib/supabase/server'

/**
 * One act: the library library check, under `research.similarity.run`.
 *
 * It runs as the person, not the system. The run row's insert policy admits the three operator
 * roles, and `media_asset_hashes` is readable under `media.read`, which every role holds — so no
 * admin client is needed and none is imported. The result is returned to the form that asked
 * and stored nowhere: the pairs table holds research hashes only, and a MEDIA_ASSET run records
 * its counts and nothing else (the table's own CHECK says so).
 *
 * THERE IS NO CORPUS RUN ACTION. Under amendment A33 nothing fetches a competitor's image, so a
 * run over the research corpus has nothing to compare; the CLI records one with every source
 * skipped, for the audit trail, and this page says why rather than offering a button that would
 * do nothing.
 */
const PATH = '/studio/research/similarity'

export async function runLibraryCheckAction(
  _state: LibraryCheckState,
  _form: FormData,
): Promise<LibraryCheckState> {
  let session
  try {
    session = await requirePermission('research.similarity.run')
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { status: 'error', message: t('studio.research.simRunRefused') }
    }
    throw error
  }

  const client = await createClient()
  let runId: string | null = null
  try {
    const run = await openSimilarityRun(client, {
      scope_type: 'MEDIA_ASSET',
      scope_id: null,
      method: 'PHASH',
      model_name: null,
      created_by: session.userId,
    })
    runId = run.id

    const rows = await listMediaAssetHashes(client)
    const result = libraryCheck(
      rows.map((row) => ({
        id: row.media_asset_id,
        label:
          row.media_assets?.rivya_asset_id ??
          row.media_assets?.filename ??
          row.media_assets?.public_id ??
          row.media_asset_id,
        kind: row.kind,
        checksum: row.checksum,
        phash: row.phash,
      })),
    )

    await closeSimilarityRun(client, run.id, {
      status: 'SUCCEEDED',
      counts: {
        images_fetched: 0,
        images_hashed: result.hashed,
        sources_skipped: {},
        pairs_considered: result.compared,
        pairs_stored: 0,
        pairs_exact: result.exact,
      },
    })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.similarity.run',
      result: 'SUCCESS',
      entityType: 'research_similarity_run',
      entityId: run.id,
      summary: `Library library check: ${String(result.hashed)} hashed, ${String(result.compared)} compared, ${String(result.pairs.length)} pairs.`,
    })
    revalidatePath(PATH)
    return {
      status: 'done',
      runId: run.id,
      hashed: result.hashed,
      compared: result.compared,
      exact: result.exact,
      pairs: result.pairs,
    }
  } catch {
    if (runId !== null) {
      try {
        await closeSimilarityRun(client, runId, {
          status: 'FAILED',
          errorCode: 'LIBRARY_CHECK_FAILED',
        })
      } catch {
        // The run row stays RUNNING; the history table shows it, which is the honest outcome.
      }
    }
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.similarity.run',
      result: 'ERROR',
      entityType: 'research_similarity_run',
      ...(runId === null ? {} : { entityId: runId }),
      summary: 'Library library check failed.',
    })
    revalidatePath(PATH)
    return { status: 'error', message: t('studio.research.simRunFailed') }
  }
}
