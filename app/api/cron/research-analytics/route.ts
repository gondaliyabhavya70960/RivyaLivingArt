import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { resolveSetScope, snapshotScope } from '@/lib/scraper/workflows/analytics'
import { createAdminClient } from '@/lib/supabase/admin'
import { listComparisonSets } from '@/lib/supabase/repositories/research/analytics'
import { listRunnableSources } from '@/lib/supabase/repositories/research/sources'

/**
 * The nightly analytics snapshot. `vercel.json` registers it at 02:30 UTC — before the 03:00
 * content-schedule tick and long after the last five-minute research tick of the evening.
 *
 * WHAT IT WRITES: one snapshot per (family, currency) for the corpus, for every enabled source and
 * for every comparison set — the rows `/studio/research/dashboard`, the compare workbench and
 * Phase 37 read INSTEAD of scanning the corpus on page load. Nothing recomputes on read.
 *
 * `CRON_SECRET`, LIKE THE OTHER TWO CRON ROUTES. The phase document names `REVALIDATE_SECRET`;
 * amendment A25 settled the repository on Vercel's own header for every scheduled route, and two
 * cron endpoints answering differently to the same mistake is worse than either answer.
 *
 * A REFUSED REQUEST GETS 401, an unconfigured deployment 503 — the same shape as `research/route.ts`
 * and for the same reasons.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<NextResponse> {
  const auth = checkCronAuth(request, process.env.CRON_SECRET)
  if (auth === 'NOT_CONFIGURED') {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (auth !== 'OK') {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const admin = createAdminClient()
  const asOf = new Date()
  const written: { scope: string; snapshots: number; rows: number }[] = []

  const corpus = await snapshotScope(
    admin,
    admin,
    {
      scopeType: 'CORPUS',
      scopeId: null,
      scope: { type: 'CORPUS' },
      bandRule: 'QUANTILE',
      bandEdges: null,
    },
    { asOf },
  )
  written.push({ scope: 'corpus', snapshots: corpus.snapshotIds.length, rows: corpus.rows })

  for (const source of await listRunnableSources(admin)) {
    const outcome = await snapshotScope(
      admin,
      admin,
      {
        scopeType: 'SOURCE',
        scopeId: source.id,
        scope: { type: 'SOURCE', sourceId: source.id },
        bandRule: 'QUANTILE',
        bandEdges: null,
      },
      { asOf },
    )
    written.push({
      scope: `source:${source.slug}`,
      snapshots: outcome.snapshotIds.length,
      rows: outcome.rows,
    })
  }

  for (const set of await listComparisonSets(admin)) {
    const outcome = await snapshotScope(
      admin,
      admin,
      {
        scopeType: 'SET',
        scopeId: set.id,
        scope: await resolveSetScope(admin, set.id),
        bandRule: set.band_rule,
        bandEdges: set.band_edges,
      },
      { asOf },
    )
    written.push({
      scope: `set:${set.slug}`,
      snapshots: outcome.snapshotIds.length,
      rows: outcome.rows,
    })
  }

  return NextResponse.json({
    ran_at: asOf.toISOString(),
    scopes: written.length,
    snapshots: written.reduce((total, entry) => total + entry.snapshots, 0),
    written,
  })
}
