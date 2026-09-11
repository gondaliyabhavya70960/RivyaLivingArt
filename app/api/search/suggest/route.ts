import { NextResponse } from 'next/server'
import { z } from 'zod'

import { siteString, siteStrings } from '@/lib/cms/strings'
import { groupHeadingKey } from '@/lib/search/group'
import { QUERY_MAX, QUERY_MIN } from '@/lib/search/query'
import { createPublicClient } from '@/lib/supabase/public'
import { listGlobalContent } from '@/lib/supabase/repositories/cms'
import { searchDocuments } from '@/lib/supabase/repositories/search'
import {
  SUGGEST_WINDOWS,
  bucketKey,
  callerAddress,
  consume,
  retryAfterSeconds,
} from '@/lib/security/rate-limit'
import { PUBLIC_ENTITY_TYPES, type PublicEntityType } from '@/lib/supabase/schemas'

/**
 * `/api/search/suggest?q=` — the header combobox's data source.
 *
 * GET, CACHED, AND PUBLIC-SCOPE ONLY. Unlike the Studio palette's endpoint this one is a GET,
 * because everything it can return is already on the public website: a product name, a collection
 * name, a category. There is nothing here a proxy log should not have seen, and a GET is what makes
 * `s-maxage=60` possible — the same two-character prefixes are typed by everybody.
 *
 * IT READS WITH THE ANON KEY, DELIBERATELY, EVEN FOR A SIGNED-IN MEMBER OF STAFF. `createPublicClient`
 * has no session, so RLS returns `visibility = 'PUBLIC' and status = 'PUBLISHED'` and nothing else.
 * Using the request's own client would make the response vary by who asked — and a response that
 * varies by session cannot be cached at the edge, so the first staff member to type would poison a
 * shared cache with draft titles. The Studio has its own search; this is the visitor's.
 *
 * EIGHT RESULTS ACROSS AT MOST THREE GROUPS. Not a performance limit — a usability one. A dropdown
 * long enough to scroll is a results page that has not admitted it, and the last option is always
 * the one that goes to the real results page.
 *
 * NOTHING RESEARCH-SHAPED CAN REACH IT. The scope is `PUBLIC`, the types are the five public entity
 * types written out below, and `search_documents` physically cannot hold a research row (0210).
 * `scripts/search/check-search-scope.mjs` fails the build if a research identifier appears in this
 * file's import graph.
 */

export const dynamic = 'force-dynamic'

const MAX_RESULTS = 8
const MAX_GROUPS = 3

const querySchema = z.string().trim().min(QUERY_MIN).max(QUERY_MAX)

export async function GET(request: Request): Promise<NextResponse> {
  /*
   * RATE LIMITED FIRST — Phase 41. Sixty a minute per hashed address, which is several searches with
   * room to spare for a debounced box, and far below what a script produces.
   *
   * A REFUSAL DEGRADES TO SILENCE, and that is the whole reason this limit is safe to add to a
   * visitor-facing surface. The combobox treats a non-200 as "no suggestions" and the plain
   * `<form method="get" action="/search">` beneath it still submits, so a limited visitor loses
   * autocomplete and keeps search. `Retry-After` is sent anyway, for a client that wants it.
   */
  const { allowed } = await consume(bucketKey('suggest', callerAddress(request)), SUGGEST_WINDOWS)
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate-limited', groups: [] },
      {
        status: 429,
        headers: { ...NO_STORE, 'Retry-After': String(retryAfterSeconds(SUGGEST_WINDOWS)) },
      },
    )
  }

  const raw = new URL(request.url).searchParams.get('q') ?? ''
  const parsed = querySchema.safeParse(raw)

  // 400 rather than an empty list: one character is not a search, and answering it with `[]` would
  // teach the client that the catalogue holds nothing beginning with that letter.
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
  }

  const client = createPublicClient()

  let hits
  let strings
  try {
    ;[hits, strings] = await Promise.all([
      searchDocuments(client, parsed.data, {
        scope: 'PUBLIC',
        types: PUBLIC_ENTITY_TYPES,
        // PREFIX MATCHING, WHICH THE RESULTS PAGE DELIBERATELY DOES NOT USE. A suggestion list
        // that only matches whole words suggests nothing until the visitor has finished typing
        // the word, which is the opposite of what a type-ahead is for. Found by running it.
        prefix: true,
        // Over-fetch a little so that trimming to three groups still fills the list.
        limit: MAX_RESULTS * 2,
      }),
      listGlobalContent(client).then(siteStrings),
    ])
  } catch {
    // A failed suggestion must not be an error the visitor sees. The form still submits and
    // `/search` still works, so an empty list degrades to exactly the no-JavaScript experience.
    return NextResponse.json({ results: [] }, { headers: NO_STORE })
  }

  const groupsSeen: PublicEntityType[] = []
  const results: Array<{ id: string; label: string; group: string; href: string }> = []

  for (const hit of hits) {
    if (results.length >= MAX_RESULTS) break
    const entityType = hit.entity_type
    if (!isPublicType(entityType)) continue
    if (!groupsSeen.includes(entityType)) {
      if (groupsSeen.length >= MAX_GROUPS) continue
      groupsSeen.push(entityType)
    }
    const group = siteString(strings, `UI_LABEL.${groupHeadingKey(entityType)}`)
    // A group whose heading has not been seeded is DROPPED rather than labelled with its key. A
    // visitor must never be shown an internal identifier (lib/cms/strings.ts).
    if (group === null) continue
    if (hit.url_path === null) continue
    results.push({ id: hit.id, label: hit.title, group, href: hit.url_path })
  }

  return NextResponse.json({ results }, { headers: CACHE })
}

function isPublicType(value: string): value is PublicEntityType {
  return (PUBLIC_ENTITY_TYPES as readonly string[]).includes(value)
}

/**
 * A minute at the edge, five more serving the stale copy while it refreshes.
 *
 * Short enough that a product published now is suggestible within a minute; long enough that the
 * common prefixes — two or three characters — are answered from the cache rather than from
 * PostgreSQL on every keystroke of every visitor.
 */
const CACHE = { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' }
const NO_STORE = { 'cache-control': 'no-store' }
