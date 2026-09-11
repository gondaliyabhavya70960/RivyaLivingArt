import 'server-only'

import type { Route } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicClient } from '@/lib/supabase/public'
import { getPublishedRedirect, recordRedirectHit } from '@/lib/supabase/repositories/redirects'

import { normaliseRedirectPath } from './redirect-rules'

/**
 * The redirect resolver — consulted ONLY on the path that would otherwise call `notFound()`.
 *
 * THE HAPPY PATH PAYS NOTHING. `renderCmsPage` and each dynamic route reach this function at the
 * one moment they have decided the address does not exist; a page that resolves never asks. That
 * is the whole reason the table needs no proxy and no middleware: a redirect is a property of an
 * address that is gone, and only a gone address looks one up.
 *
 * ONE HOP. The row's `to_path` is where the visitor goes, and it is not looked up again — the
 * write-time rules in `redirect-rules.ts` guarantee a target is never itself a source.
 *
 * ALWAYS 308. Next's `permanentRedirect` issues a 308, which preserves the request method; a row
 * stored as 301 is served as 308 too. The distinction that matters to a crawler — permanent versus
 * temporary — is the same in both, and the table keeps the column so an owner's choice is
 * recorded rather than silently rewritten.
 *
 * THE HIT COUNT IS BEST EFFORT AND WRITTEN AS THE SERVICE ROLE. No visitor may update a row (RLS
 * says so), and a failed count must never become a failed redirect: the admin client is created
 * inside a `try`, and every failure — including "no service role configured", the CI build's
 * state — is swallowed. The count exists so the Redirects tab can show which rows are load-bearing;
 * it is not an analytics surface.
 */
export async function redirectOrNotFound(path: string): Promise<never> {
  const from = normaliseRedirectPath(path)
  const redirect = await getPublishedRedirect(createPublicClient(), from).catch(() => null)
  if (redirect === null) notFound()

  try {
    await recordRedirectHit(createAdminClient(), redirect.id, redirect.hit_count)
  } catch {
    // Counting is never allowed to fail the redirect.
  }

  // A row's target is a site-relative path by CHECK; typed routes cannot know a runtime string.
  permanentRedirect(redirect.to_path as Route)
}
