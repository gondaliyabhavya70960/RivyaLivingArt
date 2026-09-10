import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PUBLIC_ENTITY_TYPES, SEARCH_ENTITY_TYPES } from '@/lib/supabase/schemas'

/**
 * The boundary between the two corpora, asserted where it can be asserted without a database.
 *
 * THE DATABASE HALF LIVES IN `tests/unit/rls/phase23.test.ts` — that an anon role reads zero rows
 * from `research_search_documents`, and that a research `entity_type` is refused by the public
 * index — because those are questions only PostgreSQL can answer. What is here is the half that a
 * type checker cannot catch and a database cannot see: that the SQL and the TypeScript agree about
 * which types exist, and that the migration still carries the constraints the whole design rests on.
 *
 * WHY ASSERT MIGRATION TEXT AT ALL. `0210` has been applied everywhere it matters, so it will not
 * change — but a later phase adding `0290_relax_search_types.sql` would leave these strings intact
 * while the live constraint went away, and the RLS suite would catch that. This suite catches the
 * other order: somebody editing `0210` before it has shipped to an environment, which is exactly
 * the window this phase is in.
 */

const MIGRATION = readFileSync('supabase/migrations/0210_phase23_search.sql', 'utf8')

describe('the public index cannot describe a research row', () => {
  it('allowlists exactly the eight indexable types', () => {
    expect([...SEARCH_ENTITY_TYPES].sort()).toEqual([
      'category',
      'collection',
      'inquiry',
      'journal_article',
      'material',
      'media_asset',
      'portfolio_project',
      'product',
    ])
  })

  it('names none of them research', () => {
    for (const type of SEARCH_ENTITY_TYPES) {
      expect(type).not.toMatch(/research/i)
    }
  })

  it('keeps the three Studio-only types out of the public group order', () => {
    expect(PUBLIC_ENTITY_TYPES).not.toContain('material')
    expect(PUBLIC_ENTITY_TYPES).not.toContain('media_asset')
    expect(PUBLIC_ENTITY_TYPES).not.toContain('inquiry')
  })

  it('carries the entity_type CHECK in the migration, listing the same eight', () => {
    const match =
      /search_documents_entity_type_allowlist\s+check \(entity_type in \(([^)]+)\)/s.exec(MIGRATION)
    expect(match).not.toBeNull()
    const listed = [...(match?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect(listed).toEqual([...SEARCH_ENTITY_TYPES].sort())
  })

  it('makes the three Studio-only types structurally incapable of being PUBLIC', () => {
    expect(MIGRATION).toContain('search_documents_staff_types_are_staff')
    expect(MIGRATION).toMatch(
      /entity_type not in \('material', 'media_asset', 'inquiry'\) or visibility = 'STAFF'/,
    )
  })

  it('gives the research index its own table with its own three-value allowlist', () => {
    expect(MIGRATION).toContain('create table research_search_documents')
    expect(MIGRATION).toMatch(
      /research_search_documents_entity_type_allowlist\s+check \(entity_type in \('research_product', 'research_source', 'research_run'\)\)/,
    )
  })

  it('forbids a research document from ever being anything but STAFF', () => {
    expect(MIGRATION).toMatch(
      /research_search_documents_always_staff\s+check \(visibility = 'STAFF'\)/,
    )
  })
})

describe('search_queries holds nothing that identifies a visitor', () => {
  const columns = /create table search_queries \(([\s\S]*?)\n\);/.exec(MIGRATION)?.[1] ?? ''

  it('has no IP, user agent, session or referrer column', () => {
    for (const forbidden of ['ip', 'user_agent', 'session', 'referrer', 'fingerprint']) {
      expect(columns).not.toMatch(new RegExp(`\\n\\s+${forbidden}\\b`))
    }
  })

  it('refuses an actor on a public search at the row rather than trusting the writer', () => {
    expect(MIGRATION).toMatch(
      /search_queries_public_has_no_actor\s+check \(scope = 'STUDIO' or staff_user_id is null\)/,
    )
  })
})

describe('the refresh function keeps personal data out of the inquiry document', () => {
  const TRIGGERS = readFileSync('supabase/migrations/0211_phase23_search_triggers.sql', 'utf8')
  // The `elsif p_entity_type = 'inquiry'` branch, up to the `end if`.
  const branch = /p_entity_type = 'inquiry' then([\s\S]*?)end if;/.exec(TRIGGERS)?.[1] ?? ''

  it('has a branch to read', () => {
    expect(branch.length).toBeGreaterThan(0)
  })

  it('never reads a name, phone number, email address, city, message or answers', () => {
    for (const column of ['i.name', 'i.phone', 'i.email', 'i.city', 'i.message', 'i.answers']) {
      expect(branch).not.toContain(column)
    }
  })

  it('reads exactly the four fields the phase document permits', () => {
    expect(branch).toContain('i.reference_code')
    expect(branch).toContain('i.kind')
    expect(branch).toContain('i.pipeline_status')
    expect(branch).toContain('pr.title')
  })
})
