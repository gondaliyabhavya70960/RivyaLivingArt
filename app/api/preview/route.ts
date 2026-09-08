import { draftMode } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { createClient } from '@/lib/supabase/server'
import { getPageByPath } from '@/lib/supabase/repositories/cms'

/**
 * Turn draft mode on for a staff session, then send them to the page they asked to preview.
 *
 * THE SESSION IS THE SECRET. Next's own guide builds this route around a shared token in the
 * query string, because it is written for a headless CMS living on someone else's domain. Ours is
 * on this domain, behind the same auth as everything else in Studio, so a token would be a second
 * credential to leak — one that travels in a URL, lands in browser history, in the Referer header
 * of every asset the previewed page loads, and in any log that records paths. `content.read` is
 * the check, and it is the same check Studio itself makes.
 *
 * `draftMode()` IS ASYNCHRONOUS IN NEXT 16 and must be awaited. Written synchronously it still
 * type-checks against a loose signature and still compiles, and `enable()` is then called on a
 * Promise — at which point nothing happens and the preview silently shows published content. It
 * is the kind of failure that looks like a caching bug for a day.
 *
 * THE PATH IS VALIDATED AGAINST THE DATABASE, not just against a pattern. `getPageByPath` is a
 * cheap lookup and it closes an open redirect: without it, `?path=https://elsewhere.example` or
 * `?path=//elsewhere.example` would enable draft mode and then forward a logged-in member of
 * staff off the site, from a URL that looks like ours. The regex below rejects those shapes and
 * the lookup rejects everything else that is not a real page.
 *
 * IT USES THE REQUEST-SCOPED CLIENT, NOT THE SERVICE ROLE. The caller has already proved
 * `content.read`, and the staff select policy on `pages` admits exactly that — so the lookup
 * needs no RLS bypass, and reaching for one to save a line would mean this route could see rows
 * its caller cannot. `eslint.config.mjs` refuses the admin import for that reason.
 *
 * DRAFT MODE IS NOT ENABLED UNTIL THE PATH IS KNOWN GOOD. Enabling first and validating second
 * would leave a member of staff browsing the whole site in draft mode after a failed preview,
 * seeing unpublished sections on pages they did not ask to preview.
 */

/** A site-relative path: one leading slash, and not `//` — which a browser reads as a host. */
const pathSchema = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^\/(?!\/)[\w\-./]*$/u, 'must be a site-relative path')

export async function GET(request: Request): Promise<NextResponse | Response> {
  let session
  try {
    session = await requirePermission('content.read')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  const parsed = pathSchema.safeParse(new URL(request.url).searchParams.get('path') ?? '')
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }
  const path = parsed.data

  const page = await getPageByPath(await createClient(), path)
  if (page === null) {
    return NextResponse.json({ error: 'unknown_path' }, { status: 404 })
  }

  const draft = await draftMode()
  draft.enable()

  await writeAudit({
    action: 'content.preview',
    result: 'SUCCESS',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'pages',
    entityId: page.id,
    summary: path,
  })

  return NextResponse.redirect(new URL(path, request.url), 307)
}

/**
 * Turn draft mode off.
 *
 * NO PERMISSION CHECK, AND THAT IS CORRECT. Disabling only ever removes the caller's own bypass
 * cookie; the worst an unauthenticated request can do is stop seeing drafts it could not see
 * anyway. Requiring a session here would strand anyone whose session expired mid-preview with a
 * cookie they could not clear.
 */
export async function DELETE(): Promise<NextResponse> {
  const draft = await draftMode()
  draft.disable()
  return NextResponse.json({ draft: false })
}
