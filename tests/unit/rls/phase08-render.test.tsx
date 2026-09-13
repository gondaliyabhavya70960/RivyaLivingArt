import { render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SectionList } from '@/components/sections/SectionList'
import { selectSections } from '@/lib/cms/resolve'
import { siteStrings, type SiteStrings } from '@/lib/cms/strings'
import { globalContentSchema, pageSectionSchema } from '@/lib/supabase/schemas'
import type { GlobalContent, MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { globalContentSeed } from '@/content/seed/global-content'

import { connect, disconnect } from './harness'

/**
 * The whole chain, once: real rows in PostgreSQL → the windowing rule → the block registry → the
 * rendered page.
 *
 * WHY THIS IS NOT COVERED BY THE OTHER SUITES. `cms-sections.test.tsx` renders from fixtures and
 * `cms-resolve.test.ts` selects from fixtures; both are hand-built objects that agree with the
 * schema because I wrote them to. This one takes what the DATABASE actually returns — including
 * the defaults its columns apply and the JSON shape `payload` comes back as — parses it through
 * the same Zod schemas the repository uses, and renders it. A column whose default is not what the
 * code assumes, or a jsonb that arrives as a string, fails here and nowhere else.
 *
 * `supabase-js` CANNOT BE USED FOR THIS. It speaks HTTP to PostgREST, which the local cluster does
 * not run, so the rows are read with `pg` and validated with the repository's own schemas. What is
 * proved is the chain from a real row onward; what is not proved is PostgREST's serialisation,
 * which is the same seam every other suite in this directory leaves to the hosted database.
 *
 * AND THAT SEAM IS REAL, WHICH THIS TEST FOUND. `node-postgres` parses `timestamptz` into a JS
 * `Date`; PostgREST serialises it as an ISO string, which is what `timestampSchema` expects and
 * what every repository therefore receives. Parsing a raw `pg` row with those schemas fails on
 * `created_at` and `updated_at` — not because the schema is wrong, but because this is the one
 * place in the codebase that reads rows without PostgREST in between. `asRow` below does what the
 * transport would have done. Anyone writing a script that reads with `pg` and validates with these
 * schemas needs the same conversion; it is not optional and it is not obvious.
 */

/** A raw `pg` row as PostgREST would have serialised it: timestamps as ISO strings. */
function asRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value
  }
  return out
}

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the RLS suite to run. ' +
      'Refusing to skip: a skipped suite reports success while proving nothing.',
  )
}

const describeDb = HAVE_DB ? describe : describe.skip

/**
 * Distinct from every id in `phase08.test.ts`. The suites share one database and vitest runs the
 * files in parallel, so two files reusing a uuid is a duplicate-key failure in whichever one loses
 * the race — reported against code that is fine. The first draft of this file took `…0000e1` and
 * `…0000e2`, which the trigger suite already owns.
 */
const PAGE_ID = '00000000-0000-4000-8000-000000000ca1'
const ASSET_ID = '00000000-0000-4000-8000-000000000ca2'
const NOW = new Date('2026-06-01T12:00:00Z')

describeDb('a page renders from real rows', () => {
  let sections: PageSection[] = []
  let strings: SiteStrings = new Map()
  let assets: Map<string, MediaAsset> = new Map()

  beforeAll(async () => {
    const db = await connect()
    /**
     * Cleared by BOTH keys this suite is about to claim, not only by primary key. `media_assets`
     * has a unique `rivya_asset_id` as well as its id, so a row left by an earlier run under a
     * different uuid blocks the insert on a constraint the id-only delete never touches — which is
     * exactly what happened when this suite's ids changed. `media_usages` goes first because
     * Phase 06 put `on delete restrict` between them.
     */
    await db.query('delete from page_sections where page_id = $1', [PAGE_ID])
    await db.query(
      `delete from media_usages where media_id in (
         select id from media_assets where id = $1 or rivya_asset_id = 'RENDER-001')`,
      [ASSET_ID],
    )
    await db.query(`delete from media_assets where id = $1 or rivya_asset_id = 'RENDER-001'`, [
      ASSET_ID,
    ])
    await db.query('delete from pages where id = $1', [PAGE_ID])

    await db.query(
      `insert into pages (id, slug, kind, title, path, status)
       values ($1, 'render', 'PAGE', 'Render', '/render', 'PUBLISHED')`,
      [PAGE_ID],
    )
    await db.query(
      `insert into media_assets (id, provider, resource_type, public_id, folder, kind, alt_text,
                                 is_ai_generated, is_concept, source, status, owner_verification, rivya_asset_id)
       values ($1,'cloudinary','image','rivya/render/hero','rivya/render','IMAGE','A poured resin surface',
               true, false, 'HIGGSFIELD', 'PUBLISHED', 'VERIFIED', 'RENDER-001')`,
      [ASSET_ID],
    )

    /** A hero with an image, a statement, a divider, and one section outside its window. */
    const insert = async (
      blockType: string,
      position: number,
      extra: Record<string, unknown> = {},
    ) => {
      const columns = ['page_id', 'block_type', 'position', ...Object.keys(extra)]
      const values = [PAGE_ID, blockType, position, ...Object.values(extra)]
      const { rows } = await db.query<{ id: string }>(
        `insert into page_sections (${columns.join(', ')})
         values (${columns.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
        values,
      )
      const id = rows[0]!.id
      await db.query(`update page_sections set status = 'REVIEW' where id = $1`, [id])
      await db.query(`update page_sections set status = 'APPROVED' where id = $1`, [id])
      await db.query(`update page_sections set status = 'PUBLISHED' where id = $1`, [id])
      return id
    }

    await insert('hero', 0, {
      heading: 'Resin that holds the light',
      eyebrow: 'Rivya',
      media_desktop_id: ASSET_ID,
      media_slot_key: 'home.hero',
      payload: JSON.stringify({ is_video: false, autoplay: false, scrim: 40 }),
    })
    await insert('statement', 1, { heading: 'Made one at a time' })
    await insert('divider', 2, { payload: JSON.stringify({ spacing: 'normal', rule: true }) })
    // Past its window: rendered by nothing, whatever its status says.
    await insert('statement', 3, {
      heading: 'This came down last week',
      unpublish_at: '2026-05-01T00:00:00Z',
    })
    // Hidden.
    await insert('statement', 4, { heading: 'Not visible', is_visible: false })

    const { rows } = await db.query(
      'select * from page_sections where page_id = $1 order by position',
      [PAGE_ID],
    )
    sections = rows.map((row) => pageSectionSchema.parse(asRow(row)))

    /**
     * The suite writes the strings it asserts on, from the seed module's own records, rather than
     * relying on `npm run seed:content` having been run against this database. Two reasons: a test
     * that depends on a separate command is a test that fails for a reason unrelated to the code,
     * and the seed runner deliberately SKIPS a row an editor has edited — so a database where
     * anyone has touched the portfolio message would fail this assertion while the code was fine.
     *
     * Taking the values from `globalContentSeed` rather than restating them keeps SEED §27-§29
     * quoted in exactly one place. If the module's copy drifts from the specification, that is a
     * defect in the module, and this test would then assert the drifted text — which is why the
     * §28 assertion below writes the sentence out in full as an independent check on it.
     */
    for (const record of globalContentSeed.records) {
      const f = record.fields
      await db.query(
        `insert into global_content (group_key, key, label, value, description, is_enabled, status,
                                     fact_classification, owner_verification)
         values ($1,$2,$3,$4,$5,$6,$7,$8::fact_classification,$9::owner_verification)
         on conflict (group_key, key) do update set value = excluded.value,
                                                    is_enabled = excluded.is_enabled`,
        [
          f.group_key,
          f.key,
          f.label,
          f.value,
          f.description,
          f.is_enabled,
          f.status,
          f.fact_classification,
          f.owner_verification,
        ],
      )
    }

    const { rows: globals } = await db.query('select * from global_content')
    strings = siteStrings(
      globals.map((row) => globalContentSchema.parse(asRow(row)) as GlobalContent),
    )

    const { rows: mediaRows } = await db.query('select * from media_assets where id = $1', [
      ASSET_ID,
    ])
    assets = new Map(mediaRows.map((row) => [row.id as string, row as MediaAsset]))
  })

  afterAll(disconnect)

  it('reads five sections back, parsed by the repository schema', () => {
    expect(sections).toHaveLength(5)
  })

  it('renders only the three that are live', () => {
    const live = selectSections(sections, NOW)
    expect(live.sections).toHaveLength(3)

    render(
      <SectionList
        livePaths={new Set<string>()}
        sections={live.sections}
        assets={assets}
        strings={strings}
        cloudName="rivya-test"
      />,
    )

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Resin that holds the light')
    expect(screen.getByText('Made one at a time')).toBeTruthy()
    expect(screen.queryByText('This came down last week')).toBeNull()
    expect(screen.queryByText('Not visible')).toBeNull()
  })

  it("renders the hero's image with the asset's own alt text", () => {
    render(
      <SectionList
        livePaths={new Set<string>()}
        sections={selectSections(sections, NOW).sections}
        assets={assets}
        strings={strings}
        cloudName="rivya-test"
      />,
    )
    const image = screen.getByRole('img')
    expect(image.getAttribute('alt')).toBe('A poured resin surface')
    expect(image.getAttribute('src')).toContain('rivya/render/hero')
    // The first section on the page, and only it, may load eagerly.
    expect(image.getAttribute('loading')).toBe('eager')
  })

  /**
   * AMENDMENT A52 INVERTED THIS TEST, and the inversion is the point rather than a relaxation.
   *
   * It used to assert that an unresolved asset renders the seeded `ERROR.media_unavailable.label`.
   * That string was not true on this site: nothing had failed to load and nothing had been
   * requested — the slot had never been bound — and with the asset library unbound it printed
   * roughly thirty times on `/` alone. `BlockImage` no longer passes it, so a public well is a
   * well and says nothing.
   *
   * BOTH HALVES STILL MATTER, WHICH IS WHY THE TEST SURVIVES RATHER THAN BEING DELETED. The seeded
   * row is still there and still reaches the renderer — `lib/cms/strings.ts` ships no fallback, so
   * losing the row is a real regression and Studio lists the key as an expected one. What must NOT
   * happen is that string reaching a visitor. Asserting the row exists AND is not rendered pins
   * exactly the decision A52 made; asserting only one half would let either failure through.
   */
  it('keeps the seeded ERROR string out of the public well', () => {
    expect(strings.get('ERROR.media_unavailable.label')).toBe('Image unavailable')

    render(
      <SectionList
        livePaths={new Set<string>()}
        sections={selectSections(sections, NOW).sections}
        assets={new Map()}
        strings={strings}
        cloudName="rivya-test"
      />,
    )
    // The reserved box is still drawn — that is the layout shift MediaFrame exists to prevent.
    expect(document.querySelectorAll('[data-media-fallback]').length).toBeGreaterThan(0)
    expect(screen.queryByText('Image unavailable')).toBeNull()
  })

  /** SEED §28, verbatim, through the whole chain. D10 in the one place a visitor sees it. */
  it('renders the seeded portfolio empty state from global content', async () => {
    const db = await connect()
    const { rows } = await db.query<{ id: string }>(
      `insert into page_sections (page_id, block_type, position, status, payload)
       values ($1, 'empty-state', 10, 'DRAFT', $2) returning id`,
      [PAGE_ID, JSON.stringify({ content_key: 'portfolio', show_cta: false })],
    )
    const { rows: fresh } = await db.query('select * from page_sections where id = $1', [
      rows[0]!.id,
    ])
    const section = pageSectionSchema.parse(asRow(fresh[0] as Record<string, unknown>))

    render(
      <SectionList
        livePaths={new Set<string>()}
        sections={[section]}
        assets={assets}
        strings={strings}
        cloudName="rivya-test"
      />,
    )
    expect(
      screen.getByText('Verified Rivya projects will appear here as the portfolio develops.'),
    ).toBeTruthy()
  })
})
