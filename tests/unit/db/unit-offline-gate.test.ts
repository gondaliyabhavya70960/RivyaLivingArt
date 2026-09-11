import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * The gate that keeps the `unit` project runnable without a cluster.
 *
 * WHY THIS IS TESTED AND NOT JUST RUN: the gate's first version read `*.test.ts` and nothing else,
 * so a test could reach a database through one `import './helper'` and pass. That is a gate that
 * reports success while the invariant is broken — the same failure it exists to prevent, one level
 * up. The case below is exactly that indirection, and it must FAIL.
 *
 * Each case builds a throwaway tree and runs the real script against it, because what is being
 * checked is the script's own reading of a directory, not a function extracted from it.
 */
const SCRIPT = resolve(__dirname, '../../../scripts/db/check-unit-tests-offline.mjs')

/**
 * The two offences, ASSEMBLED RATHER THAN WRITTEN OUT, because this file lives inside the tree the
 * gate scans. Spelling them literally would make the gate fail on its own test — and the tempting
 * fix for that, exempting this path, is how a gate stops being one. The fixtures below are the only
 * place the strings exist, and only at run time.
 */
const READS_ENV = `process.env.${'DATABASE'}_URL`
const IMPORTS_PG = `import { Client } from '${'p'}g'`

let root: string | null = null

function tree(files: Readonly<Record<string, string>>): string {
  root = mkdtempSync(join(tmpdir(), 'offline-gate-'))
  for (const [path, source] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, source, 'utf8')
  }
  return root
}

function run(cwd: string): { readonly status: number; readonly output: string } {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' })
  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` }
}

afterEach(() => {
  if (root !== null) rmSync(root, { recursive: true, force: true })
  root = null
})

describe('check-unit-tests-offline', () => {
  it('passes a unit test that touches no database', () => {
    const cwd = tree({
      'tests/unit/plain.test.ts': "import { it } from 'vitest'\nit('works', () => {})\n",
    })
    expect(run(cwd).status).toBe(0)
  })

  it('fails a unit test that reads DATABASE_URL directly', () => {
    const cwd = tree({
      'tests/unit/direct.test.ts': `const url = ${READS_ENV}\nexport { url }\n`,
    })
    const { status, output } = run(cwd)
    expect(status).toBe(1)
    expect(output).toContain('tests/unit/direct.test.ts')
  })

  it('fails a unit test that reaches a database through an imported helper', () => {
    // THE HOLE THE FIRST VERSION HAD. The offence is in a module with no `.test.` in its name.
    const cwd = tree({
      'tests/unit/cases.ts': `export const URL = ${READS_ENV}\n`,
      'tests/unit/indirect.test.ts': "import { URL } from './cases'\nexport { URL }\n",
    })
    const { status, output } = run(cwd)
    expect(status).toBe(1)
    expect(output).toContain('tests/unit/indirect.test.ts')
    expect(output).toContain('tests/unit/cases.ts')
  })

  it('follows an @/-aliased import as well as a relative one', () => {
    const cwd = tree({
      'lib/db-ish.ts': `${IMPORTS_PG}\nexport { Client }\n`,
      'tests/unit/aliased.test.ts': "import { Client } from '@/lib/db-ish'\nexport { Client }\n",
    })
    const { status, output } = run(cwd)
    expect(status).toBe(1)
    expect(output).toContain('lib/db-ish.ts')
  })

  it('exempts tests/unit/rls, which is the other project', () => {
    const cwd = tree({
      'tests/unit/rls/allowed.test.ts': `${IMPORTS_PG}\nexport { Client }\n`,
    })
    expect(run(cwd).status).toBe(0)
  })

  it('does not follow a package import other than pg', () => {
    const cwd = tree({
      'tests/unit/pkg.test.ts': "import { z } from 'zod'\nexport { z }\n",
    })
    expect(run(cwd).status).toBe(0)
  })
})
