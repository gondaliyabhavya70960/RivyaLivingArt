import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  RESEARCH_BULK_SURFACES,
  RESEARCH_FILTER_KEYS,
  researchBulkParams,
  researchBulkQuery,
  researchBulkSurface,
} from '@/lib/bulk/research-surface'

/**
 * Row selection on the research surfaces, and the rule that there is still only one bulk engine.
 *
 * PHASE 24 REGISTERED FIVE RESEARCH OPERATIONS UNAVAILABLE, Phase 29 implemented them, and Phase 30
 * gave two screens the checkboxes they act on. The failure this file exists to catch is the one
 * Phase 24's own header predicted: a screen arriving with rows to act on and writing its own
 * selection handling, its own preview, its own confirmation and its own undo — the second
 * implementation always being the one without the typed count.
 *
 * SO THE ASSERTIONS ARE MOSTLY ABOUT WHAT IS ABSENT from the two pages and the action module: no
 * second preview, no second confirmation, no direct write.
 */

const root = resolve(__dirname, '../..')

const read = (path: string): string => readFileSync(join(root, path), 'utf8')

/** Source with comments removed, so a rule is proved against code rather than against prose. */
const code = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

const WORKSPACE = 'app/(studio)/studio/(shell)/research/large-format/page.tsx'
const QUEUE = 'app/(studio)/studio/(shell)/research/changes/page.tsx'
const ACTIONS = 'app/(studio)/studio/(shell)/research/bulk-actions.ts'

describe('the surface allowlist', () => {
  it('accepts exactly the two screens that carry a selection', () => {
    expect([...RESEARCH_BULK_SURFACES]).toEqual([
      '/studio/research/large-format',
      '/studio/research/changes',
    ])
    for (const surface of RESEARCH_BULK_SURFACES) {
      expect(researchBulkSurface(surface)).toBe(surface)
    }
  })

  it('refuses anything else, because the value becomes a redirect', () => {
    /*
     * AN OPEN REDIRECT IS THE FAILURE HERE. A path read from a form and handed to `redirect` will
     * navigate anywhere it is told, including off the origin — and the operator arrives at it
     * having just pressed a button they trusted.
     */
    for (const hostile of [
      'https://example.com/studio/research/changes',
      '//example.com',
      '/studio/catalog/bulk',
      '/studio/research/large-format/../../../etc',
      '/studio/research/explorer',
      '',
      null,
      undefined,
      42,
    ]) {
      expect(researchBulkSurface(hostile), String(hostile)).toBeNull()
    }
  })
})

describe('the filters carried through a preview', () => {
  it('keeps only the keys the two screens read', () => {
    const out = researchBulkQuery('source=abc&band=DINING&nonsense=1&large=true')
    expect(out.get('source')).toBe('abc')
    expect(out.get('band')).toBe('DINING')
    expect(out.get('large')).toBe('true')
    expect(out.get('nonsense')).toBeNull()
  })

  it('drops a stale operation rather than carrying it forward', () => {
    // Otherwise a preview would redirect to itself and an operator would read the same preview
    // twice, believing the second one was of their new selection.
    expect(RESEARCH_FILTER_KEYS).not.toContain('operation')
    expect(researchBulkQuery('operation=00000000-0000-0000-0000-000000000000').toString()).toBe('')
  })

  it('cannot smuggle a path or a fragment into the redirect', () => {
    // Rebuilt from parsed keys rather than concatenated, so the worst a crafted value can do is
    // choose a filter value. The two `?` and `#` characters below survive only as encoded content.
    const out = researchBulkQuery('source=x%23/evil&band=/studio/catalog/bulk')
    expect(out.toString()).not.toContain('#')
    expect(out.toString()).toBe('source=x%23%2Fevil&band=%2Fstudio%2Fcatalog%2Fbulk')
  })

  it('ignores an empty or absent filter string', () => {
    expect(researchBulkQuery('').toString()).toBe('')
    expect(researchBulkQuery(undefined).toString()).toBe('')
    expect(researchBulkQuery('source=%20%20').toString()).toBe('')
  })
})

describe('the parameters each operation collects', () => {
  const form = (values: Record<string, string>) => (field: string) => values[field] ?? ''

  it('collects a reason for reject and nothing else', () => {
    expect(researchBulkParams('research.reject', form({ reason: 'Discontinued line' }))).toEqual({
      reason: 'Discontinued line',
    })
  })

  it('collects the surviving row for a duplicate', () => {
    expect(
      researchBulkParams('research.mark_duplicate', form({ surviving_product_id: 'row-1' })),
    ).toEqual({ survivingProductId: 'row-1' })
  })

  it('reads the tag and whether it is being removed', () => {
    expect(researchBulkParams('research.set_tags', form({ tag_id: 't1' }))).toEqual({
      tagId: 't1',
      remove: false,
    })
    expect(researchBulkParams('research.set_tags', form({ tag_id: 't1', remove: 'true' }))).toEqual(
      { tagId: 't1', remove: true },
    )
  })

  it('sends an empty object for the operations that take no parameters', () => {
    // `noParams` is `.strict()`, so a stray field would be a refusal rather than an ignored value.
    for (const kind of ['research.shortlist', 'research.confirm', 'anything.else']) {
      expect(researchBulkParams(kind, form({ reason: 'ignored' })), kind).toEqual({})
    }
  })

  it('validates nothing, leaving that to each operation’s own schema', () => {
    // A second set of rules here would be a second set to keep in step. An empty reason reaches
    // the engine and is refused there, with a message naming the field.
    expect(researchBulkParams('research.reject', form({}))).toEqual({ reason: '' })
  })
})

describe('neither screen builds a second bulk path', () => {
  it('calls the engine and nothing else', () => {
    const source = code(ACTIONS)
    expect(source).toContain('previewBulkOperation')
    expect(source).toContain('applyBulkOperation')
    // No write of its own, and no second confirmation vocabulary.
    for (const forbidden of ['.from(', '.update(', '.insert(', 'createAdminClient']) {
      expect(source, forbidden).not.toContain(forbidden)
    }
  })

  it('checks bulk.execute in every exported action', () => {
    const source = code(ACTIONS)
    const exported = source.match(/export async function \w+/g) ?? []
    expect(exported.length).toBeGreaterThan(0)
    expect(source.match(/requirePermission\('bulk\.execute'\)/g)).toHaveLength(exported.length)
  })

  it('renders the toolbar only for a role holding both permissions', () => {
    /*
     * THE ENGINE IS THE GATE AND THIS IS THE COURTESY. Every research operation declares
     * `extraPermission: 'research.confirm'` on top of the `bulk.execute` the action checks, so a
     * researcher who operates the pipeline is refused these whether or not the toolbar was drawn.
     */
    for (const page of [WORKSPACE, QUEUE]) {
      const source = code(page)
      expect(source, page).toContain("roleHasPermission(session.role, 'bulk.execute')")
      expect(source, page).toContain('canConfirm')
      expect(source, page).toMatch(/canBulk\s*\?/)
    }
  })

  it('reads the operation list from the register rather than naming kinds', () => {
    // A list written out on the page is a list that goes stale the day a phase adds the sixth
    // operation — and goes stale silently, because a missing button looks like a permission.
    for (const page of [WORKSPACE, QUEUE]) {
      const source = code(page)
      expect(source, page).toContain("operationsFor('research_product')")
      expect(source, page).not.toContain("'research.shortlist'")
      expect(source, page).not.toContain("'research.reject'")
    }
  })
})

describe('what the checkbox carries', () => {
  it('is the product id on the change queue, not the change id', () => {
    /*
     * THE FIVE OPERATIONS TARGET A RESEARCH PRODUCT — shortlist it, reject it, confirm it — and a
     * queue row is one field's movement on one of them. Selecting the change id would hand the
     * engine ids that do not exist in `research_products`, and every row would preview as
     * `row_not_found`: a failure that looks like missing data rather than a wrong column.
     */
    const source = code(QUEUE)
    const checkbox = source.slice(source.indexOf("id: 'select'"))
    expect(checkbox).toContain('name="selection"')
    expect(checkbox.slice(0, checkbox.indexOf('/>'))).toContain('value={row.research_product_id}')
  })

  it('is the row id on the workspace, whose rows are products already', () => {
    const source = code(WORKSPACE)
    const checkbox = source.slice(source.indexOf("id: 'select'"))
    expect(checkbox).toContain('name="selection"')
    expect(checkbox.slice(0, checkbox.indexOf('/>'))).toContain('value={row.id}')
  })

  it('is server-rendered inside the form rather than drawn by the island', () => {
    // The island counts what is ticked by reading the form; it holds no copy of the selection. That
    // is what makes selecting rows and previewing work with no JavaScript at all.
    const island = code('components/studio/research/BulkToolbar.tsx')
    expect(island).toContain('new FormData(form).getAll(')
    expect(island).not.toContain('useEffect')
    expect(island).toContain('{children}')
  })
})

describe('the queue no longer claims the toolbar is unavailable', () => {
  it('renders the real toolbar', () => {
    const source = read(QUEUE)
    expect(source).not.toContain('UnavailableBulkToolbar')
    expect(source).toContain('<ResearchBulkToolbar')
  })

  it('leaves the named unavailable state where it is still true', () => {
    // The explorer has no selection yet, so it keeps the state Phase 24 built for exactly this:
    // not an absence, which teaches that the feature does not exist, and not a dead control.
    const explorer = read('app/(studio)/studio/(shell)/research/explorer/page.tsx')
    expect(explorer).toContain('UnavailableBulkToolbar')
  })
})

describe('the single-row action bar', () => {
  it('calls the Phase 29 actions rather than writing a stage itself', () => {
    const bar = code('components/studio/research/RowActionBar.tsx')
    for (const forbidden of ['.from(', 'writeProductStage', 'createAdminClient', 'supabase']) {
      expect(bar, forbidden).not.toContain(forbidden)
    }
    const page = code(WORKSPACE)
    expect(page).toContain("from '../changes/actions'")
    expect(page).toContain('<RowActionBar')
  })

  it('says what confirming does not do', () => {
    /*
     * ONE OF THE FOUR NEVER-AUTO-IMPORT GUARANTEES, and the only one aimed at people: three guards
     * stop a developer adding an import, and this stops a reader concluding that a screen full of
     * confirmed competitor rows is a catalogue somebody approved.
     */
    const bar = read('components/studio/research/RowActionBar.tsx')
    expect(bar).toContain("t('studio.research.confirmMeaning')")
  })

  it('refuses the decision controls to a role without research.confirm', () => {
    const bar = code('components/studio/research/RowActionBar.tsx')
    expect(bar).toMatch(/canConfirm\s*\?/)
    expect(bar).toContain("t('studio.research.decidedElsewhere')")
  })
})
