#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * `npx tsx scripts/ops/preflight.ts` — every release gate in one command — Phase 44.
 *
 * WHY A SCRIPT RATHER THAN A CHECKLIST. "Run all the guard scripts" is how one of them stops being
 * run: a person under time pressure runs the four they remember. Thirteen gates are NAMED here, each
 * one prints its own line in a summary table whether it passed or failed, and the exit code is
 * non-zero if any failed. A gate that is skipped says SKIPPED with a reason rather than being
 * silently absent — a preflight that reports success because it could not find a checker is worse
 * than no preflight.
 *
 * IT KEEPS GOING AFTER A FAILURE, deliberately. Stopping at the first red tells you one thing and
 * costs another full run to learn the second; a release is exactly the moment somebody wants the
 * whole list. The summary orders failures first.
 *
 * GATE 3 IS SPAWNED AS `python3`, NOT THROUGH npm, and it is named rather than folded into a media
 * group. D6 amendment A1 requires `check-asset-ids.py` in CI and before any media migration, and
 * Phase 43 is the only phase that mints an asset id — so a missing interpreter must read as a
 * FAILED gate naming the interpreter, never as a media check that quietly did not happen.
 */

export interface Gate {
  readonly n: number
  readonly name: string
  readonly command: readonly string[]
  readonly owningPhase: string
  /** When present and false, the gate reports SKIPPED with this reason rather than running. */
  readonly skipUnless?: () => string | null
}

export const GATES: readonly Gate[] = [
  {
    n: 1,
    name: 'check (types, lint, format, guards)',
    command: ['npm', 'run', 'check'],
    owningPhase: '00',
  },
  {
    n: 2,
    name: 'manifest is deterministic',
    command: ['npm', 'run', 'manifest:verify'],
    owningPhase: '00 · 07',
  },
  {
    n: 3,
    name: 'asset ids do not collide (D6 · A1)',
    command: ['python3', 'scripts/media/check-asset-ids.py'],
    owningPhase: '05–09 · 43',
  },
  {
    n: 4,
    name: 'nothing regenerates an existing asset',
    command: ['npm', 'run', 'media:assert-no-regen'],
    owningPhase: '07',
  },
  {
    n: 5,
    name: 'documentation contract',
    command: ['node', 'scripts/docs/check-doc-contract.mjs'],
    owningPhase: '01 · 46',
  },
  {
    n: 6,
    name: 'one structured-data emitter',
    command: ['npm', 'run', 'seo:check-jsonld-scope'],
    owningPhase: '39',
  },
  {
    n: 7,
    name: 'performance budgets and the island census',
    command: ['npm', 'run', 'perf:count-islands'],
    owningPhase: '40',
  },
  {
    n: 8,
    name: 'accessibility and security guards',
    command: ['npm', 'run', 'a11y:check-contrast'],
    owningPhase: '41',
  },
  {
    n: 9,
    name: 'test fixture isolation',
    command: ['node', 'scripts/test/check-fixture-isolation.mjs'],
    owningPhase: '42',
    // Phase 42 is deferred; the file does not exist yet, and a preflight that silently omitted
    // gate 9 would report twelve green gates as thirteen.
    skipUnless: () =>
      existsSync('scripts/test/check-fixture-isolation.mjs')
        ? null
        : 'Phase 42 has not run yet — scripts/test/check-fixture-isolation.mjs does not exist',
  },
  {
    n: 10,
    name: 'alt text reads as description',
    command: ['node', 'scripts/media/check-alt-text.mjs'],
    owningPhase: '43',
  },
  {
    n: 11,
    name: 'environment is complete and well-formed',
    command: ['npx', 'tsx', 'scripts/ops/check-env.ts'],
    owningPhase: '44',
  },
  {
    n: 12,
    name: 'migrations replay from empty',
    command: ['npm', 'run', 'db:reset'],
    owningPhase: '03 · 44',
    skipUnless: () =>
      process.env['DATABASE_URL'] === undefined || process.env['DATABASE_URL'] === ''
        ? 'DATABASE_URL is not set — point it at a THROWAWAY database; this gate drops every table'
        : null,
  },
  {
    n: 13,
    name: 'owner verifications blocking a publish',
    command: ['npm', 'run', 'content:verification-report'],
    owningPhase: '08 · 46',
    skipUnless: () =>
      existsSync('scripts/content/build-verification-report.ts')
        ? null
        : 'Phase 46 has not run yet — scripts/content/build-verification-report.ts does not exist',
  },
]

export type Outcome = 'PASSED' | 'FAILED' | 'SKIPPED'

export interface Result {
  readonly gate: Gate
  readonly outcome: Outcome
  readonly detail: string
}

function run(gate: Gate): Result {
  const skip = gate.skipUnless?.() ?? null
  if (skip !== null) return { gate, outcome: 'SKIPPED', detail: skip }

  const [command, ...args] = gate.command
  if (command === undefined) return { gate, outcome: 'FAILED', detail: 'no command' }

  const started = Date.now()
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })

  if (result.error !== undefined) {
    /*
     * A MISSING INTERPRETER IS A FAILED GATE, NOT A SKIPPED ONE. This is the branch gate 3's note
     * is about: `python3` absent must never read as "the media check is fine".
     */
    return {
      gate,
      outcome: 'FAILED',
      detail: `could not run \`${command}\` — ${result.error.message}`,
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  return result.status === 0
    ? { gate, outcome: 'PASSED', detail: `${seconds}s` }
    : { gate, outcome: 'FAILED', detail: `exit ${String(result.status ?? -1)} after ${seconds}s` }
}

function summarise(results: readonly Result[]): string {
  const order: Record<Outcome, number> = { FAILED: 0, SKIPPED: 1, PASSED: 2 }
  const rows = [...results].sort(
    (a, b) => order[a.outcome] - order[b.outcome] || a.gate.n - b.gate.n,
  )

  const width = Math.max(...results.map((result) => result.gate.name.length))
  const lines = rows.map(
    (result) =>
      `  ${String(result.gate.n).padStart(2)}  ${result.outcome.padEnd(7)}  ` +
      `${result.gate.name.padEnd(width)}  ${result.gate.owningPhase.padEnd(9)}  ${result.detail}`,
  )

  return [
    '',
    `  ${'#'.padStart(2)}  ${'OUTCOME'.padEnd(7)}  ${'GATE'.padEnd(width)}  ${'PHASE'.padEnd(9)}  DETAIL`,
    ...lines,
    '',
  ].join('\n')
}

function main(): void {
  const results = GATES.map(run)
  console.log(summarise(results))

  const failed = results.filter((result) => result.outcome === 'FAILED')
  const skipped = results.filter((result) => result.outcome === 'SKIPPED')

  if (failed.length > 0) {
    console.error(
      `✗ preflight: ${String(failed.length)} of ${String(GATES.length)} gate(s) failed — ` +
        failed.map((result) => `${String(result.gate.n)} ${result.gate.name}`).join(', '),
    )
    process.exit(1)
  }

  console.log(
    `✓ preflight: ${String(results.length - skipped.length)} of ${String(GATES.length)} gate(s) passed` +
      (skipped.length > 0
        ? `, ${String(skipped.length)} skipped and named above. A skipped gate is not a passed one.`
        : '.'),
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
