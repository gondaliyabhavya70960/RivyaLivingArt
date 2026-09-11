#!/usr/bin/env tsx
/**
 * research:direction-export — a direction brief as Markdown.
 *
 *   npx tsx scripts/research/direction-export.ts --brief=<id> --format=md
 *   npx tsx scripts/research/direction-export.ts --brief=<id> --format=md --out=brief.md
 *
 * The same document the print view renders: the internal-document header first, the nine
 * sections verbatim, every observed figure with its coverage and the words "observed in competitor
 * research", the evidence with its rationale and any drift. Nothing is generated and no Rivya
 * price, dimension or material appears as a specification.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  parseCaptured,
  scoreDrift,
  snapshotDrift,
  type ObservedFigure,
} from '../../lib/scraper/analytics/direction/capture'
import {
  renderBriefMarkdown,
  type ExportEvidence,
} from '../../lib/scraper/analytics/direction/export'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  getDirectionBrief,
  listBriefEvidence,
  newestScoreForProduct,
  newestSnapshotLike,
} from '../../lib/supabase/repositories/research/direction'
import { BRIEF_SECTIONS } from '../../lib/supabase/schemas/research-direction'

const ENV_PATH = '.env.local'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export interface ExportOptions {
  readonly brief: string
  readonly format: 'md'
  readonly out: string | null
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: ExportOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let brief: string | null = null
  let format: 'md' = 'md'
  let out: string | null = null
  for (const arg of argv) {
    if (arg.startsWith('--brief=')) {
      brief = arg.slice('--brief='.length)
      if (!UUID.test(brief)) return { ok: false, error: '--brief must be a brief id' }
      continue
    }
    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length)
      if (value !== 'md') return { ok: false, error: `--format must be md, not ${value}` }
      format = value
      continue
    }
    if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length)
      continue
    }
    return { ok: false, error: `unknown argument ${arg}` }
  }
  if (brief === null) return { ok: false, error: '--brief=<id> is required' }
  return { ok: true, value: { brief, format, out } }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(2)
  }
  const options = parsed.value
  if (existsSync(ENV_PATH)) {
    try {
      process.loadEnvFile(ENV_PATH)
    } catch (error) {
      console.error(
        `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      process.exit(1)
    }
  }
  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })
  const brief = await getDirectionBrief(admin, options.brief)
  if (brief === null) {
    console.error('no such brief')
    process.exit(1)
  }
  const rows = await listBriefEvidence(admin, brief.id)
  const figures: ObservedFigure[] = []
  const evidence: ExportEvidence[] = []
  for (const row of rows) {
    let drift = false
    let label = row.evidence_id
    try {
      if (row.evidence_type === 'OPPORTUNITY_SCORE') {
        const captured = parseCaptured('OPPORTUNITY_SCORE', row.captured)
        const current = await newestScoreForProduct(admin, captured.researchProductId)
        drift = scoreDrift(
          captured,
          current === null
            ? null
            : {
                researchProductId: current.research_product_id,
                score: current.score,
                confidence: Number(current.confidence),
                completeness: Number(current.completeness),
                state: current.state,
                modelVersion: current.model_version,
                computedAt: current.computed_at,
              },
        ).changed
        label = `score ${String(captured.score ?? '—')} (${captured.state}) under ${captured.modelVersion}`
      } else if (row.evidence_type === 'ANALYTICS_SNAPSHOT') {
        const captured = parseCaptured('ANALYTICS_SNAPSHOT', row.captured)
        const newest = await newestSnapshotLike(admin, {
          scope_type: captured.scopeType,
          scope_id: null,
          metric_family: captured.metricFamily,
          currency: captured.currency,
        })
        drift = snapshotDrift(captured, newest?.computed_at ?? null)
        figures.push(...captured.figures)
        label = `${captured.metricFamily}${captured.currency === null ? '' : ` ${captured.currency}`} · ${String(captured.rowCount)} rows · ${captured.computedAt.slice(0, 10)}`
      } else if (row.evidence_type === 'COMPARISON_SET') {
        const captured = parseCaptured('COMPARISON_SET', row.captured)
        label = `${captured.name} (${String(captured.memberCount)} members)`
      } else if (row.evidence_type === 'RESEARCH_PRODUCT') {
        const captured = parseCaptured('RESEARCH_PRODUCT', row.captured)
        label = `${captured.title ?? row.evidence_id} · ${captured.sourceSlug}`
      } else if (row.evidence_type === 'MEDIA_ASSET') {
        const captured = parseCaptured('MEDIA_ASSET', row.captured)
        label = `${captured.rivyaAssetId ?? captured.publicId} (concept)`
      }
    } catch {
      label = row.evidence_id
    }
    evidence.push({
      type: row.evidence_type,
      label,
      rationale: row.rationale,
      capturedAt: row.created_at,
      drift,
    })
  }
  const sections = Object.fromEntries(
    BRIEF_SECTIONS.map((section) => [section, brief[section]]),
  ) as Record<(typeof BRIEF_SECTIONS)[number], string | null>
  const markdown = renderBriefMarkdown({
    brief: {
      title: brief.title,
      slug: brief.slug,
      status: brief.status,
      targetCategorySlug: brief.target_category_slug,
      approvedAt: brief.approved_at,
      updatedAt: brief.updated_at,
      sections,
    },
    figures,
    evidence,
  })
  if (options.out === null) {
    process.stdout.write(markdown)
  } else {
    writeFileSync(options.out, markdown)
    console.log(`wrote ${options.out}`)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
