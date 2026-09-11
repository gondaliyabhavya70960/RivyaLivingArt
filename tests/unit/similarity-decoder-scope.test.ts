import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

/**
 * Exactly one module imports an image decoder. The gate is run over the real tree and over a
 * fixture tree that must fail, so the assertion is the gate's behaviour and not its existence —
 * the same shape as the no-ML gate's test.
 */

const SCRIPT = resolve('scripts/media/check-decoder-scope.mjs')
const scratch = mkdtempSync(join(tmpdir(), 'decoder-scope-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function run(cwd: string) {
  return spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' })
}

describe('decoder scope', () => {
  it('the repository imports a decoder in lib/media/hashes.ts and nowhere else', () => {
    const result = run(process.cwd())
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('1 module(s) import an image decoder')
    expect(result.stdout).toContain('lib/media/hashes.ts')
  })

  it('a decoder under the scraper fails, naming the file and the package', () => {
    const root = join(scratch, 'violation')
    mkdirSync(join(root, 'lib', 'scraper'), { recursive: true })
    writeFileSync(
      join(root, 'lib', 'scraper', 'hash-run.ts'),
      "// a comment naming sharp does not count\nconst s = await import('sharp')\nexport default s\n",
    )
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('lib/scraper/hash-run.ts')
    expect(result.stderr).toContain('(sharp)')
  })

  it('a comment that names the rule is not a violation of it', () => {
    const root = join(scratch, 'comment-only')
    mkdirSync(join(root, 'lib', 'x'), { recursive: true })
    writeFileSync(
      join(root, 'lib', 'x', 'doc.ts'),
      "/* never `import sharp from 'sharp'` here */\n// nor require('jpeg-js')\nexport const a = 1\n",
    )
    const result = run(root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('0 module(s) import an image decoder')
  })
})
