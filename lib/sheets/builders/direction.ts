import 'server-only'

import {
  listBriefEvidence,
  listDirectionBriefs,
} from '@/lib/supabase/repositories/research/direction'

import { FILTER_SCHEMAS } from '../definitions'
import type { Client, Record_ } from './shared'

/**
 * The direction-brief builder — Phase 36. Its own module because I4 holds that no file imports
 * both the direction repository and a catalogue repository; the category read the research
 * builders use lives in `research.ts`. A brief exported to a tab is a brief read, nothing more.
 */

export async function directionBriefs(
  client: Client,
  filter: Record<string, unknown>,
): Promise<Record_[]> {
  const parsed = FILTER_SCHEMAS.DIRECTION_BRIEFS.parse(filter) as { status?: string }
  const briefs = (await listDirectionBriefs(client)).filter(
    (brief) => parsed.status === undefined || brief.status === parsed.status,
  )
  const records: Record_[] = []
  for (const brief of briefs) {
    const evidence = await listBriefEvidence(client, brief.id)
    records.push({
      title: brief.title,
      status: brief.status,
      target_category_slug: brief.target_category_slug,
      evidence_count: evidence.length,
      approved_by: brief.approved_by,
      updated_at: brief.updated_at,
    })
  }
  return records
}
