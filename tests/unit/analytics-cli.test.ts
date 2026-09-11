import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseArgs } from '../../scripts/research/analytics'

/**
 * The analytics CLI: argument parsing, and the absence that matters — no fetcher.
 *
 * `research:analytics` reads stored rows and writes stored results. A future edit that "refreshes
 * the prices first" would make a recompute cost a competitor a request per row; this reads the
 * file off disk and fails on any fetch module named in it.
 */

const ROOT = resolve(import.meta.dirname, '..', '..')

describe('research:analytics — arguments', () => {
  it('defaults to a corpus dry run', () => {
    expect(parseArgs([])).toEqual({
      ok: true,
      value: { scope: 'corpus', snapshot: false, dryRun: false },
    })
  })

  it('accepts the three scope forms and nothing else', () => {
    expect(parseArgs(['--scope=source:source-a']).ok).toBe(true)
    expect(parseArgs(['--scope=set:00000000-0000-4000-8000-000000003103']).ok).toBe(true)
    expect(parseArgs(['--scope=category:x']).ok).toBe(false)
    expect(parseArgs(['--fetch']).ok).toBe(false)
  })

  it('refuses --snapshot together with --dry-run', () => {
    expect(parseArgs(['--snapshot', '--dry-run']).ok).toBe(false)
  })
})

describe('research:analytics — never fetches', () => {
  it('names no fetch module and no workflow that does', () => {
    const source = readFileSync(join(ROOT, 'scripts/research/analytics.ts'), 'utf8')
    expect(source).not.toMatch(/core\/fetch|workflows\/drain|workflows\/probe|node-fetch|undici/u)
  })
})
