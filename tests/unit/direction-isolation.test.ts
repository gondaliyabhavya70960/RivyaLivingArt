import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { findDirectionProductCouplings } from '../../scripts/research/direction-isolation.mjs'

/**
 * THE IMPORT BARRIER. No module may import both the direction repository and the products
 * repository — the "create product from brief" button that seems obvious would have to, and this
 * fails the build when it does. Run over the real tree and over a fixture that must fail, so the
 * test is not vacuous (phase document, verification 2).
 */

const scratch = mkdtempSync(join(tmpdir(), 'direction-isolation-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

describe('direction ↔ products import barrier', () => {
  it('holds across the repository', () => {
    expect(findDirectionProductCouplings(process.cwd())).toEqual([])
  })

  it('fails on a module that imports both repositories', () => {
    const root = join(scratch, 'coupled')
    mkdirSync(join(root, 'app', 'x'), { recursive: true })
    writeFileSync(
      join(root, 'app', 'x', 'actions.ts'),
      "import { getDirectionBrief } from '@/lib/supabase/repositories/research/direction'\n" +
        "import { insertProduct } from '@/lib/supabase/repositories/products'\n" +
        'export const a = [getDirectionBrief, insertProduct]\n',
    )
    const found = findDirectionProductCouplings(root)
    expect(found).toEqual(['app/x/actions.ts'])
  })

  it('ignores a comment that names both', () => {
    const root = join(scratch, 'commented')
    mkdirSync(join(root, 'lib', 'y'), { recursive: true })
    writeFileSync(
      join(root, 'lib', 'y', 'doc.ts'),
      "// never import '@/lib/supabase/repositories/research/direction' and '@/lib/supabase/repositories/products' together\nexport const b = 1\n",
    )
    expect(findDirectionProductCouplings(root)).toEqual([])
  })
})
