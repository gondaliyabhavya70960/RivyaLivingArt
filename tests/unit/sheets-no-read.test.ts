import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { findSheetsReads } from '../../scripts/sheets/no-read.mjs'

/**
 * THE ONE-WAY GUARD, proved to refuse what it exists for. The real tree passes; a fixture that
 * reads cell values fails, naming the line.
 */

const scratch = mkdtempSync(join(tmpdir(), 'sheets-no-read-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function tree(name: string, source: string): string {
  const root = join(scratch, name)
  mkdirSync(join(root, 'lib', 'sheets'), { recursive: true })
  writeFileSync(join(root, 'lib', 'sheets', 'inbound.ts'), source, 'utf8')
  return root
}

describe('the Sheets one-way guard', () => {
  it('holds across the repository', () => {
    expect(findSheetsReads(process.cwd())).toEqual([])
  })

  it('fails on a read of cell values', () => {
    const root = tree(
      'reads',
      "export async function pull(api) {\n  return api.spreadsheets.values.get({ range: 'A1:B2' })\n}\n",
    )
    const found = findSheetsReads(root)
    expect(found).toHaveLength(1)
    expect(found[0]).toContain('inbound.ts:2')
  })

  it('fails on a batchGet or grid-data request spelled as a URL', () => {
    const root = tree(
      'url',
      "const url = 'https://sheets.googleapis.com/v4/spreadsheets/x/values:batchGet'\nexport { url }\n",
    )
    expect(findSheetsReads(root)).toHaveLength(1)
  })

  it('ignores a comment that names the forbidden call', () => {
    const root = tree('commented', '// never call values.get here\nexport const a = 1\n')
    expect(findSheetsReads(root)).toEqual([])
  })
})
