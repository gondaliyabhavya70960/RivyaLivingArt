import { describe, expect, it } from 'vitest'

import { selectArticles, selectProducts, selectProjects } from '@/lib/cms/selectors'
import type { SelectorClient } from '@/lib/cms/selectors'

/**
 * The three reference selectors against the catalogue as it actually is: empty, and in two
 * different ways.
 *
 * WHY THIS TEST EXISTS AT ALL. Phase 11's own risk table names the failure it prevents —
 * "`selected-works` gets 'temporarily' hardcoded to make the design look full". That change is one
 * line, it looks like an improvement in a screenshot, and nothing else in the repository would
 * object: the products it invents would be indistinguishable from real ones on the rendered page.
 * So the assertion is not "the query is correct", it is "with nothing published, nothing is
 * returned" — and it is written against the selector rather than the renderer because the renderer
 * can only draw what this hands it.
 *
 * `EMPTY` AND `NOT_YET_BUILT` ARE ASSERTED SEPARATELY. They look identical to a visitor and are
 * different facts: one says the table is there and holds nothing, the other that a later phase
 * creates it. The distinction reaches the page only as `data-empty-reason`, and it exists for
 * whoever has to decide whether the site is broken or merely young.
 *
 * THE CLIENT IS A STUB, NOT A DATABASE. What is under test is the mapping from PostgREST's answer
 * to a `SelectorResult`, including its answer to a relation that does not exist — and `42P01` is
 * exactly the case a live database with the tables present cannot produce.
 */

type Answer = { data: unknown; error: { code?: string } | null }

/** A client that answers every read with one canned response, whatever table is asked for. */
function clientAnswering(answer: Answer): SelectorClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: async () => answer,
  }
  return { from: () => chain } as unknown as SelectorClient
}

const NO_ROWS: Answer = { data: [], error: null }
const NO_TABLE: Answer = { data: null, error: { code: '42P01' } }
/** PostgREST's own code for a table absent from its cached schema — the same outcome. */
const NOT_IN_CACHE: Answer = { data: null, error: { code: 'PGRST205' } }

describe('with an empty catalogue', () => {
  it('returns no product cards', async () => {
    const result = await selectProducts(clientAnswering(NO_ROWS), { limit: 3 })

    expect(result.cards).toEqual([])
    // `products` exists — Phase 03 created it — so this is EMPTY rather than NOT_YET_BUILT, and it
    // stays EMPTY until Phase 14: `products` is not a member of the seed runner's SeedableTable
    // union, so no seed can ever put a row in it.
    expect(result.reason).toBe('EMPTY')
  })

  it('returns no project cards while the table does not exist', async () => {
    const result = await selectProjects(clientAnswering(NO_TABLE), { limit: 3 })

    expect(result.cards).toEqual([])
    expect(result.reason).toBe('NOT_YET_BUILT')
  })

  it('returns no article cards while the table is absent from the schema cache', async () => {
    const result = await selectArticles(clientAnswering(NOT_IN_CACHE), { limit: 3 })

    expect(result.cards).toEqual([])
    expect(result.reason).toBe('NOT_YET_BUILT')
  })

  it('reports EMPTY once a table exists and holds nothing', async () => {
    // The state Phases 17 and 18 leave behind on the day their migration runs and before anything
    // is published. The page looks identical; the reason changes, which is the whole point of
    // carrying one.
    const result = await selectProjects(clientAnswering(NO_ROWS), { limit: 3 })

    expect(result.reason).toBe('EMPTY')
  })
})

describe('with rows to show', () => {
  it('maps a row to a card with no commercial detail on it', async () => {
    const answer: Answer = {
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          slug: 'a-table',
          title: 'A table',
          summary: 'One line.',
          hero_media_id: null,
          // Columns a card must never carry, planted here to prove they cannot reach one.
          price: 99999,
          dimensions_cm: '200x90x75',
        },
      ],
      error: null,
    }

    const result = await selectProducts(clientAnswering(answer), { limit: 3 })

    expect(result.reason).toBe('OK')
    expect(result.cards).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        // The slug, not the id: stable, human-readable, and what the detail route uses.
        key: 'a-table',
        title: 'A table',
        summary: 'One line.',
        href: '/product/a-table',
        mediaId: null,
        // Null, not absent, and not 'Furniture': the product read does not ask for an eyebrow
        // column, so there is nothing for one to be populated from. Only a project has one.
        eyebrow: null,
      },
    ])
  })

  /**
   * THE ONE EXTRA COLUMN, AND ONLY FOR PROJECTS. RC-219 puts the project's type above its title as
   * text, so `listReferenceProjects` reads `project_type` where its two siblings read nothing extra.
   * This asserts that it arrives — and the assertion above asserts that it does NOT arrive on a
   * product card, which together are the whole of the rule.
   */
  it('carries a project type onto a project card, and nothing else extra', async () => {
    const answer: Answer = {
      data: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          slug: 'a-residence',
          title: 'A residence',
          summary: null,
          hero_media_id: null,
          project_type: 'Commission',
          // Planted, and must not reach the card: a client's name is publishable only where their
          // consent is recorded, which a card has no way to know.
          client_display_name: 'Somebody',
        },
      ],
      error: null,
    }

    const result = await selectProjects(clientAnswering(answer), { limit: 3 })

    expect(result.cards).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        key: 'a-residence',
        title: 'A residence',
        summary: null,
        href: '/portfolio/a-residence',
        mediaId: null,
        eyebrow: 'Commission',
      },
    ])
  })

  it('drops a row with no title rather than rendering an anonymous card', async () => {
    const answer: Answer = {
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          slug: 'untitled',
          title: '   ',
          summary: null,
          hero_media_id: null,
        },
      ],
      error: null,
    }

    const result = await selectProducts(clientAnswering(answer), { limit: 3 })

    // A titled card is a claim that a thing exists and is called something. A blank one is an
    // editor mid-edit, and a tile with no name that links somewhere is worse than one card fewer.
    expect(result.cards).toEqual([])
    expect(result.reason).toBe('EMPTY')
  })

  it('lets a genuine query failure through', async () => {
    // Only "no such table" is an ordinary state. A permission error or a syntax error is a defect,
    // and swallowing it here would turn every broken query into a silently empty band.
    await expect(
      selectProducts(clientAnswering({ data: null, error: { code: '42501' } }), { limit: 3 }),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('the block payloads that reach these selectors', () => {
  it('has no price or dimension field anywhere on the three reference blocks', async () => {
    const { selectedWorksBlock } = await import('@/content/blocks/selected-works')
    const { portfolioStripBlock } = await import('@/content/blocks/portfolio-strip')
    const { journalStripBlock } = await import('@/content/blocks/journal-strip')
    const { secondaryObjectsBlock } = await import('@/content/blocks/secondary-objects')
    const { categoryGridBlock } = await import('@/content/blocks/category-grid')

    // Phase 11's risk table: "Concept media reads as a real, buyable product". The mitigation is
    // that the schema has no field to put a price in, so adding one is a visible decision rather
    // than an editor filling in a box that was already there.
    const forbidden = /price|dimension|width_cm|height_cm|lead_time|stock|availability/i
    for (const block of [
      selectedWorksBlock,
      portfolioStripBlock,
      journalStripBlock,
      secondaryObjectsBlock,
      categoryGridBlock,
    ]) {
      const shape =
        JSON.stringify(block.defaults) + block.payloadFields.map((f) => f.name).join(' ')
      expect(shape, block.type).not.toMatch(forbidden)
    }
  })
})
