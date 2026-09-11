import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * **CHANGES ARE NEVER AUTOMATICALLY IMPORTED INTO RIVYA PRODUCTS.**
 *
 * FEAT §25's last line, and the third and fourth of its four guarantees live here: the guard is
 * proved to REFUSE the write it exists to catch, and the review path is proved to CONTAIN no such
 * write. The other two are `check-research-isolation.mjs`'s I4 leg and the seeded confirm-dialog
 * copy.
 *
 * FOUR GUARANTEES RATHER THAN ONE BECAUSE THEY FAIL DIFFERENTLY. A guard catches the code, a test
 * catches the behaviour, the copy catches the misunderstanding, and `BUSINESS_RULES.md` catches
 * the argument — and the argument is the likeliest of the four to happen. Breaking this rule will
 * always look like an improvement: a confirmed competitor row carries a title, a price, dimensions
 * and eight image URLs, and retyping them by hand looks like waste.
 *
 * THE GUARD IS RUN AGAINST A FIXTURE TREE CONTAINING THE OFFENCE. A guard nobody has watched refuse
 * anything is a guard that has never been tested — the first version of Phase 28's offline gate
 * passed on a hole one import wide for exactly that reason.
 */

const SCRIPT = resolve(__dirname, '../../scripts/research/check-no-autoimport.mjs')
const REPO = resolve(__dirname, '../..')

let root: string | null = null

function tree(files: Readonly<Record<string, string>>): string {
  root = mkdtempSync(join(tmpdir(), 'no-autoimport-'))
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

/**
 * The offending strings, ASSEMBLED RATHER THAN WRITTEN OUT.
 *
 * This file is a test, so the guard does not scan it — but the same assembly is what keeps the
 * fixtures honest if the guard's roots ever widen, and it costs nothing. The lesson is Phase 28's:
 * exempting a path to stop a guard failing on its own test is how a guard stops being one.
 */
const WRITES_PRODUCTS = `await client.from('${'produc'}ts').insert({ title })`
const IMPORTS_WRITE = `import { ${'insert'}Product } from '@/lib/supabase/repositories/catalog-admin'`

describe('the no-auto-import guard', () => {
  it('passes the repository as it stands', () => {
    const { status, output } = run(REPO)
    expect(status, output).toBe(0)
    expect(output).toContain('no auto-import')
  })

  it('refuses a research module that writes the products table', () => {
    const cwd = tree({
      'lib/scraper/workflows/import-it.ts': `export async function go(client, title) {\n  ${WRITES_PRODUCTS}\n}\n`,
    })
    const { status, output } = run(cwd)
    expect(status).toBe(1)
    expect(output).toContain('products')
  })

  it('refuses a research module that imports a first-party write', () => {
    const cwd = tree({
      'lib/scraper/workflows/import-it.ts': `${IMPORTS_WRITE}\nexport const go = insertProduct\n`,
    })
    const { status, output } = run(cwd)
    expect(status).toBe(1)
    expect(output).toContain('insertProduct')
  })

  it('permits the taxonomy read amendment A26 admits', () => {
    // `research_source_category_map.category_id` is one of exactly two allowlisted crossings, and
    // the source screen reads the category list to populate it. A guard that refused this would be
    // refusing the design.
    const cwd = tree({
      'app/(studio)/studio/(shell)/research/sources/page.tsx':
        "import { listCategoriesForStudio } from '@/lib/supabase/repositories/catalog-admin'\nexport const go = listCategoriesForStudio\n",
    })
    expect(run(cwd).status).toBe(0)
  })

  it('permits the Sheets definition writes Phase 36 places under the research route map (A37)', () => {
    // An export definition is integration configuration, not the catalogue; its repository
    // touches no product, media or CMS table. The screen lives at /studio/research/sheets.
    const cwd = tree({
      'app/(studio)/studio/(shell)/research/sheets/actions.ts':
        "import { updateDefinition, setDefinitionPaused } from '@/lib/supabase/repositories/sheets'\nexport const go = [updateDefinition, setDefinitionPaused]\n",
    })
    expect(run(cwd).status).toBe(0)
  })

  it('still refuses a catalogue write imported beside a Sheets definition write', () => {
    const cwd = tree({
      'app/(studio)/studio/(shell)/research/sheets/actions.ts': `import { updateDefinition } from '@/lib/supabase/repositories/sheets'\n${IMPORTS_WRITE}\nexport const go = updateDefinition\n`,
    })
    expect(run(cwd).status).toBe(1)
  })

  it('refuses a research Studio server action that writes media_assets', () => {
    const cwd = tree({
      'app/(studio)/studio/(shell)/research/changes/actions.ts': `export async function go(client) {\n  await client.from('media_assets').upsert({})\n}\n`,
    })
    expect(run(cwd).status).toBe(1)
  })
})

describe('the review path contains no catalogue write', () => {
  const PATHS = [
    'lib/scraper/workflows/review-actions.ts',
    'lib/scraper/workflows/detect-changes.ts',
    'lib/bulk/operations/research/index.ts',
    'app/(studio)/studio/(shell)/research/changes/actions.ts',
  ] as const

  it.each(PATHS)('%s names no public product table in a write', (path) => {
    // READ AS TEXT RATHER THAN IMPORTED, because importing a `server-only` module from a unit test
    // fails for a reason unrelated to what is being asserted — and what is being asserted is about
    // the source, not about the runtime.
    const source = readFileSync(join(REPO, path), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')

    for (const table of ['products', 'product_media', 'product_specs', 'media_assets']) {
      expect(source, `${path} writes ${table}`).not.toMatch(
        new RegExp(
          `from\\(\\s*['"\`]${table}['"\`]\\s*\\)[\\s\\S]{0,200}\\.(insert|upsert|update|delete)\\s*\\(`,
          'u',
        ),
      )
    }
  })

  it('CONFIRM moves a stage and calls nothing else', () => {
    /*
     * THE ASSERTION IS OVER WHAT IT CALLS, NOT OVER WHAT IT MENTIONS.
     *
     * A first attempt here forbade the word "product" in the function body, and it failed
     * immediately — the research row IS called a product, the parameter is `input.productId`, and
     * the function is `confirmProduct`. A test that cannot tell a research product from a Rivya
     * one would have to be weakened until it proved nothing, which is the worse outcome. So this
     * reads the calls: confirming wraps the shared action recorder and raises a stage, and any
     * third call is the thing that would need explaining.
     */
    const source = readFileSync(join(REPO, 'lib/scraper/workflows/review-actions.ts'), 'utf8')
    const start = source.indexOf('export async function confirmProduct')
    const body = source
      .slice(start, source.indexOf('\n/**', start))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')

    const called = [...body.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gu)]
      .map((match) => match[1] ?? '')
      .filter(
        (name) =>
          ![
            'confirmProduct',
            'async',
            'function',
            'if',
            'for',
            'while',
            'switch',
            'catch',
          ].includes(name),
      )

    /*
     * PHASE 35 WIDENED THE LIST, AND EVERY ADDITION IS A RESEARCH WRITE OR A READ. The decision
     * note is recorded in research_confirmations, the shortlist entry is closed, an activity row
     * says a research reference was confirmed. Not one of them names a catalogue table, and a
     * name appearing here that is not on this list is the thing that would need explaining.
     */
    expect([...new Set(called)].sort()).toEqual([
      'ReviewActionError',
      'closeShortlistEntry',
      'getLiveConfirmation',
      'getResearchProduct',
      'logActivity',
      'moveStage',
      'recordConfirmation',
      'requireMovement',
      'trim',
      'withAction',
    ])
    expect(body).toContain("'CONFIRMED'")
    for (const name of ['insertProduct', 'createProduct', 'upsertProduct', 'createMediaAsset']) {
      expect(called).not.toContain(name)
    }
  })
})
