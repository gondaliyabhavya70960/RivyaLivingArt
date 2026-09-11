import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { parseArgs } from '../../scripts/research/score'

/**
 * The no-ML gate is proved to FAIL on the thing it forbids, and the score CLI names no fetcher.
 */

const ROOT = resolve(import.meta.dirname, '..', '..')
const SCRIPT = join(ROOT, 'scripts/research/check-no-ml.mjs')

let root: string | null = null
afterEach(() => {
  if (root !== null) rmSync(root, { recursive: true, force: true })
  root = null
})

describe('research:check-no-ml', () => {
  it('passes the real engine directory', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' })
    expect(result.status).toBe(0)
  })

  it('fails a fixture that names an embedding, even lower-cased inside an identifier', () => {
    root = mkdtempSync(join(tmpdir(), 'no-ml-'))
    mkdirSync(join(root, 'signals'), { recursive: true })
    writeFileSync(
      join(root, 'signals', 'bad.ts'),
      [
        '// a comment saying embedding is fine',
        'const x = 1',
        'export const score = ' + 'cosine' + 'Similarity(' + 'embedding' + 'Of(x))',
      ].join('\n'),
    )
    const result = spawnSync(process.execPath, [SCRIPT, root], { cwd: ROOT, encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/bad\.ts:3/u)
  })
})

describe('research:score — arguments and absence of a fetcher', () => {
  it('parses the four flags and refuses the rest', () => {
    expect(parseArgs(['--model=v2', '--dry-run'])).toEqual({
      ok: true,
      value: { dryRun: true, model: 'v2' },
    })
    expect(parseArgs(['--explain=00000000-0000-4000-8000-000000003103']).ok).toBe(true)
    expect(parseArgs(['--model=latest']).ok).toBe(false)
    expect(parseArgs(['--refresh']).ok).toBe(false)
  })
  it('names no fetch module', () => {
    const source = require('node:fs').readFileSync(
      join(ROOT, 'scripts/research/score.ts'),
      'utf8',
    ) as string
    expect(source).not.toMatch(/core\/fetch|workflows\/drain|workflows\/probe|node-fetch|undici/u)
  })
})
