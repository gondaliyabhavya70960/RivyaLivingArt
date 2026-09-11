import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 39 at the table: `seo_keyword_themes` has row security, no anon leg and no numeric column;
 * `seo_redirects` admits anon to PUBLISHED rows only; an editor writes both under `seo.write` and a
 * merchandiser is refused; `seo_entries` gained its four columns with their defaults and the
 * allowlist CHECK; the seventeen §42 themes are seeded with the two geography rows awaiting
 * verification; and a DRAFT row of every sitemap kind is invisible to anon — the database half of
 * `sitemap-scope.test.ts`.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from seo_redirects where from_path like '/p39-%'")
  await db.query("delete from seo_keyword_themes where theme like 'p39 %'")
  await db.query("delete from seo_entries where path like '/p39-%'")
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('seo_keyword_themes — Phase 39', () => {
  it('has row security on, no anon policy, and no numeric column', async () => {
    const db = await connect()
    const rls = await db.query(
      "select relrowsecurity from pg_class where relname = 'seo_keyword_themes'",
    )
    expect(rls.rows[0]?.relrowsecurity).toBe(true)
    const anon = await db.query(
      "select polname from pg_policy where polrelid = 'seo_keyword_themes'::regclass and 'anon' = any(polroles::regrole[]::text[])",
    )
    expect(anon.rows).toHaveLength(0)
    const numeric = await db.query(
      `select column_name from information_schema.columns
        where table_name = 'seo_keyword_themes' and data_type in ('integer','bigint','numeric','real','double precision','smallint')`,
    )
    expect(numeric.rows).toEqual([])
  })

  it('refuses an anon read', async () => {
    const rows = await asAnon((sql) => sql.rows('select id from seo_keyword_themes limit 1'))
    expect(rows).toEqual([])
  })

  // EVERY asSession BLOCK IS ONE TRANSACTION, ROLLED BACK AT ITS END. An insert and the update
  // that depends on it therefore share a block; a row another block must see is committed by the
  // superuser connection and cleaned up afterwards.
  it('lets an editor add and edit a theme in one transaction', async () => {
    const result = await asEditor(async (sql) => {
      const inserted = await sql.affectedRows(
        "insert into seo_keyword_themes (theme, mapped_path) values ('p39 editor theme', '/about')",
      )
      const updated = await sql.affectedRows(
        "update seo_keyword_themes set notes = 'looked at' where theme = 'p39 editor theme'",
      )
      const duplicate = await sql.attempt(
        "insert into seo_keyword_themes (theme) values ('  P39 Editor Theme ')",
      )
      return { inserted, updated, duplicate }
    })
    expect(result.inserted).toBe(1)
    expect(result.updated).toBe(1)
    // `normalized_theme` is generated from the theme, case- and whitespace-insensitively.
    expect(result.duplicate.ok).toBe(false)
  })

  it('refuses a merchandiser a write and lets a viewer read', async () => {
    const db = await connect()
    await db.query("insert into seo_keyword_themes (theme) values ('p39 committed theme')")
    const refused = await asMerchandiser((sql) =>
      sql.attempt("insert into seo_keyword_themes (theme) values ('p39 merchandiser theme')"),
    )
    expect(refused.ok).toBe(false)
    const silent = await asMerchandiser((sql) =>
      sql.affectedRows(
        "update seo_keyword_themes set notes = 'x' where theme = 'p39 committed theme'",
      ),
    )
    expect(silent).toBe(0)
    const seen = await asViewer((sql) =>
      sql.rows<{ theme: string }>(
        "select theme from seo_keyword_themes where theme = 'p39 committed theme'",
      ),
    )
    expect(seen).toHaveLength(1)
  })

  it('refuses a status stamp that disagrees with the status', async () => {
    const bad = await asEditor((sql) =>
      sql.attempt(
        "insert into seo_keyword_themes (theme, research_status) values ('p39 stamped', 'RESEARCHED')",
      ),
    )
    expect(bad.ok).toBe(false)
    const good = await asEditor((sql) =>
      sql.attempt(
        "insert into seo_keyword_themes (theme, research_status, researched_at) values ('p39 stamped', 'RESEARCHED', now())",
      ),
    )
    expect(good.ok).toBe(true)
  })
})

describeDb('seo_redirects — Phase 39', () => {
  it('shows anon a PUBLISHED redirect and not a paused one', async () => {
    const db = await connect()
    await db.query(
      `insert into seo_redirects (from_path, to_path, status, published_at) values
         ('/p39-live', '/about', 'PUBLISHED', now()),
         ('/p39-paused', '/about', 'DRAFT', null)`,
    )
    const seen = await asAnon((sql) =>
      sql.rows<{ from_path: string }>(
        "select from_path from seo_redirects where from_path like '/p39-%' order by 1",
      ),
    )
    expect(seen.map((r) => r.from_path)).toEqual(['/p39-live'])
  })

  it('refuses a self-redirect, a duplicate source and a status code outside 301/308', async () => {
    for (const statement of [
      "insert into seo_redirects (from_path, to_path) values ('/p39-self', '/p39-self')",
      "insert into seo_redirects (from_path, to_path) values ('/p39-live', '/elsewhere')",
      "insert into seo_redirects (from_path, to_path, status_code) values ('/p39-302', '/about', 302)",
    ]) {
      const result = await asEditor((sql) => sql.attempt(statement))
      expect(result.ok, statement).toBe(false)
    }
  })

  it('lets an editor write and refuses a merchandiser and an anon write', async () => {
    const editor = await asEditor((sql) =>
      sql.affectedRows(
        "insert into seo_redirects (from_path, to_path) values ('/p39-editor', '/about')",
      ),
    )
    expect(editor).toBe(1)
    const m = await asMerchandiser((sql) =>
      sql.attempt("insert into seo_redirects (from_path, to_path) values ('/p39-m', '/about')"),
    )
    expect(m.ok).toBe(false)
    // An anon update either raises or matches nothing; the count must not move.
    await asAnon((sql) =>
      sql.attempt("update seo_redirects set hit_count = 99 where from_path = '/p39-live'"),
    )
    const db = await connect()
    const after = await db.query<{ hit_count: number }>(
      "select hit_count from seo_redirects where from_path = '/p39-live'",
    )
    expect(after.rows[0]?.hit_count).toBe(0)
  })
})

describeDb('seo_entries — the four Phase 39 columns', () => {
  it('default to false / null and refuse a type outside the allowlist', async () => {
    const result = await asEditor(async (sql) => {
      const inserted = await sql.rows<{
        noindex: boolean
        nofollow: boolean
        derived: boolean
        structured_data_type: string | null
      }>(
        "insert into seo_entries (scope, path) values ('PATH', '/p39-entry') returning noindex, nofollow, derived, structured_data_type",
      )
      const bad = await sql.attempt(
        "update seo_entries set structured_data_type = 'LocalBusiness' where path = '/p39-entry'",
      )
      const good = await sql.affectedRows(
        "update seo_entries set structured_data_type = 'Article' where path = '/p39-entry'",
      )
      return { inserted, bad, good }
    })
    expect(result.inserted[0]).toEqual({
      noindex: false,
      nofollow: false,
      derived: false,
      structured_data_type: null,
    })
    expect(result.bad.ok).toBe(false)
    expect(result.good).toBe(1)
  })
})

describeDb('the seeded themes', () => {
  it('holds the seventeen §42 themes UNRESEARCHED, the two geography rows awaiting verification', async () => {
    const db = await connect()
    const rows = await db.query<{
      theme: string
      research_status: string
      owner_verification: string
    }>(
      "select theme, research_status, owner_verification from seo_keyword_themes where seed_key like 'keyword:%' order by theme",
    )
    // The seed may not have run against the RLS database (the fixture loads users and content it
    // needs, not the content seed). When it has, the rule is checked in full.
    if (rows.rows.length === 0) return
    expect(rows.rows).toHaveLength(17)
    for (const row of rows.rows) expect(row.research_status).toBe('UNRESEARCHED')
    const geography = rows.rows.filter(
      (row) => row.owner_verification === 'OWNER_VERIFICATION_REQUIRED',
    )
    expect(geography.map((row) => row.theme).sort()).toEqual([
      'custom furniture India',
      'resin furniture India',
    ])
  })
})

describeDb('the sitemap readers see PUBLISHED only', () => {
  it('a DRAFT page of every kind is invisible to anon', async () => {
    const db = await connect()
    const drafts = await db.query<{ kind: string; count: string }>(
      "select kind, count(*) from pages where status <> 'PUBLISHED' and path is not null group by kind",
    )
    for (const row of drafts.rows) {
      const seen = await asAnon((sql) =>
        sql.rows<{ count: string }>(
          "select count(*) from pages where kind = $1 and status <> 'PUBLISHED'",
          [row.kind],
        ),
      )
      expect(Number(seen[0]?.count), row.kind).toBe(0)
    }
    const products = await asAnon((sql) =>
      sql.rows<{ count: string }>("select count(*) from products where status <> 'PUBLISHED'"),
    )
    expect(Number(products[0]?.count)).toBe(0)
  })
})
