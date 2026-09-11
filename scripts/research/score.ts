#!/usr/bin/env tsx
/**
 * research:score — score the corpus under a model, or explain one row.
 *
 *   npx tsx scripts/research/score.ts                       # active model, stored
 *   npx tsx scripts/research/score.ts --model=v2 --dry-run  # a DRAFT, on screen only
 *   npx tsx scripts/research/score.ts --source=<slug>
 *   npx tsx scripts/research/score.ts --explain=<research_product_id>
 *
 * `--explain` PRINTS THE COMPONENT TABLE, and it is the same arithmetic the Studio drawer shows,
 * because both read `lib/scraper/analytics/opportunity/score.ts`. Compare them line by line.
 *
 * A DRAFT MODEL CAN ONLY BE DRY-RUN. A stored score must point at a model that cannot change
 * under it, and a DRAFT can.
 *
 * NO FETCHER IS IMPORTED — this reads stored rows and writes stored scores; asserted by
 * `tests/unit/opportunity-cli.test.ts`.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { totalFromComponents } from '../../lib/scraper/analytics/opportunity/score'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { listResearchSources } from '../../lib/supabase/repositories/research/sources'
import { explainRow, scoreScope } from '../../lib/scraper/workflows/score'

const ENV_PATH = '.env.local'

export interface ScoreCliOptions {
  readonly model?: string
  readonly source?: string
  readonly dryRun: boolean
  readonly explain?: string
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: ScoreCliOptions }
  | { readonly ok: false; readonly error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let model: string | undefined
  let source: string | undefined
  let explain: string | undefined
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg.startsWith('--model=')) {
      model = arg.slice('--model='.length)
      if (!/^v[0-9]+(\.[0-9]+)*$/u.test(model))
        return { ok: false, error: `--model must look like v1, not ${model}` }
      continue
    }
    if (arg.startsWith('--source=')) {
      source = arg.slice('--source='.length)
      if (!/^[a-z0-9-]+$/u.test(source))
        return { ok: false, error: `--source must be a slug, not ${source}` }
      continue
    }
    if (arg.startsWith('--explain=')) {
      explain = arg.slice('--explain='.length)
      if (!UUID.test(explain))
        return { ok: false, error: '--explain must be a research product id' }
      continue
    }
    return { ok: false, error: `Unrecognised argument: ${arg}` }
  }
  return {
    ok: true,
    value: {
      dryRun,
      ...(model === undefined ? {} : { model }),
      ...(source === undefined ? {} : { source }),
      ...(explain === undefined ? {} : { explain }),
    },
  }
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

  if (options.explain !== undefined) {
    const outcome = await explainRow(admin, options.explain, options.model)
    if (outcome === null) {
      console.error('no such research product, or it is not in play (disposition ≠ NONE)')
      process.exit(1)
    }
    console.log(`product    ${outcome.row.id}`)
    console.log(`title      ${outcome.row.titleNormalized ?? '—'}`)
    console.log(
      `state      ${outcome.result.state}   confidence ${String(outcome.result.confidence)}   completeness ${String(outcome.result.completeness)}`,
    )
    console.log('signal                 weight  normalised  contribution  input / reason')
    for (const component of outcome.result.components) {
      console.log(
        `  ${component.signalKey.padEnd(22)} ${String(component.weight).padStart(4)}  ${component.included ? String(component.normalised).padStart(10) : '   excluded'}  ${component.included ? String(component.contribution).padStart(12) : '            '}  ${component.included ? (component.rawInput ?? '') : (component.exclusionReason ?? '')}`,
      )
    }
    console.log(
      `raw ${String(outcome.result.raw)}  ×  (0.6 + 0.4 × ${String(outcome.result.completeness)})  =  score ${String(outcome.result.score)}   [reproduced: ${String(totalFromComponents(outcome.result.components, outcome.result.completeness))}]`,
    )
    return
  }

  let sourceId: string | undefined
  if (options.source !== undefined) {
    const source = (await listResearchSources(admin)).find((row) => row.slug === options.source)
    if (source === undefined) {
      console.error(`no source with slug ${options.source}`)
      process.exit(1)
    }
    sourceId = source.id
  }

  const outcome = await scoreScope(admin, admin, {
    ...(options.model === undefined ? {} : { modelVersion: options.model }),
    ...(sourceId === undefined ? {} : { sourceId }),
    dryRun: options.dryRun,
  })
  console.log(`model      ${outcome.model.version} (${outcome.model.lifecycle})`)
  console.log(`rows       ${String(outcome.rows)}`)
  console.log(`scored     ${String(outcome.scored)}`)
  console.log(`insufficient_data  ${String(outcome.insufficient)}`)
  console.log(
    options.dryRun
      ? 'written    nothing (dry run)'
      : `written    ${String(outcome.written)} score rows`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
