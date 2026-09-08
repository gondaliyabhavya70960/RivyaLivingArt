import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { secretMatches } from '@/lib/cms/cron-auth'

/**
 * The one way a cached public page is invalidated from outside the process.
 *
 * WHY AN ENDPOINT AT ALL. Phase 08's publishing service runs in a Server Action and could call
 * `revalidatePath` directly — and it does, for the path it just published. This exists for the two
 * cases that Server Action cannot cover: the scheduled sweep, which runs in a cron route and
 * publishes sections belonging to pages it was not asked about; and any future out-of-process
 * publisher. Having exactly one endpoint means there is exactly one thing to secure.
 *
 * POST ONLY, AND DELIBERATELY NO GET. A GET that invalidates a cache is a URL that a crawler, a
 * link checker or a chat client's preview fetcher will hit — repeatedly, and from addresses that
 * look nothing like an attacker's. `export async function GET` is absent rather than returning
 * 405, so Next itself answers the method.
 *
 * IT FAILS CLOSED ON A MISSING SECRET. 503, not 200 and not 401: a deploy that forgot
 * `REVALIDATE_SECRET` is an operations problem needing a different alert from a rejected caller,
 * and treating "no secret configured" as "no check required" would turn one missing variable into
 * an open endpoint that lets anyone force a full re-render of the site on demand.
 *
 * THE COMPARISON IS CONSTANT-TIME AND HASHES BOTH SIDES FIRST. `secretMatches` is the same helper
 * the cron route uses, and its header explains why the hashing is load-bearing: `timingSafeEqual`
 * throws on a length mismatch, so comparing raw values leaks the secret's length through the
 * difference between a 500 and a 401.
 *
 * NOTHING IN THE RESPONSE ECHOES THE REQUEST'S SECRET, and no error message names it. The body
 * reports which paths and tags were acted on, because a caller needs to know its request was
 * understood, and that is all.
 */

/**
 * A site-relative path. The same shape `app/api/preview/route.ts` accepts, and for a related
 * reason: `revalidatePath` with an absolute URL silently matches nothing, so an unvalidated value
 * here would produce a 200 that did nothing at all.
 */
const pathSchema = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^\/(?!\/)[\w\-./]*$/u, 'must be a site-relative path')

/** Cache tags are our own identifiers; the bound is what stops an unbounded payload. */
const tagSchema = z.string().min(1).max(256)

const bodySchema = z
  .object({
    paths: z.array(pathSchema).max(100).optional(),
    tags: z.array(tagSchema).max(100).optional(),
    /**
     * OMITTED FOR A LITERAL PATH, AND THAT IS NOT A STYLE CHOICE.
     *
     * Next's reference is explicit: `type` is for a path containing a dynamic segment
     * (`/product/[slug]`), and "if `path` is a literal path like `/product/1`, omit `type`".
     * Passing `'page'` alongside a literal path does not merely add nothing — it fails to match
     * the cache entry, so the call returns normally, the endpoint answers 200, and the page is
     * never re-rendered. That was the observed behaviour before this defaulted to undefined:
     * publish a section, revalidate, get a success response, and keep serving the old page.
     *
     * `'layout'` remains meaningful and is what publishing chrome needs — a `navigation_items`
     * row or an announcement changes every page under the layout, not one.
     */
    type: z.enum(['page', 'layout']).optional(),
  })
  .refine(
    (value) => (value.paths?.length ?? 0) + (value.tags?.length ?? 0) > 0,
    'name at least one path or tag',
  )

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env['REVALIDATE_SECRET']
  if (expected === undefined || expected === '') {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const header = request.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix) || !secretMatches(header.slice(prefix.length), expected)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) {
    // The Zod issues, not the payload: a caller needs to know which field was wrong, and echoing
    // what they sent puts their own request body back on the wire for no benefit.
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    )
  }

  const { paths = [], tags = [], type } = parsed.data
  // Two call shapes, not one with a default: see the note on `type` above.
  for (const path of paths) {
    if (type === undefined) revalidatePath(path)
    else revalidatePath(path, type)
  }
  /*
   * `{ expire: 0 }` — no stale window.
   *
   * Next 16 requires the second argument and recommends `profile="max"`, which serves stale
   * content for up to a year while a revalidation runs in the background. That is the right
   * default for a blog; it is the wrong one here. This endpoint is called because an editor just
   * published something, and verification step 7 states the contract as "the named path is
   * refetched on the NEXT request". A stale window would mean the editor reloads, sees the old
   * page, and reasonably concludes that publishing did not work.
   */
  for (const tag of tags) revalidateTag(tag, { expire: 0 })

  return NextResponse.json({
    revalidated: { paths, tags, ...(type === undefined ? {} : { type }) },
  })
}
