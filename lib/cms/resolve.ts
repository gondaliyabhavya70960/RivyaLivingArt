import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import {
  getPageByIdOrSlug,
  getPageByPath,
  listSectionsForPage,
} from '@/lib/supabase/repositories/cms'
import type { Page, PageSection } from '@/lib/supabase/schemas'

import { isLive } from './windowing'

type Client = SupabaseClient<Database>

/**
 * The single server read path for a CMS page. Phase 10 onward calls this and nothing else.
 *
 * WHY "SINGLE" IS A RULE AND NOT A PREFERENCE. The windowing rule — status, visibility, publish
 * window, and the PAGE's window as well as the section's — is subtle enough that a second
 * implementation would get one clause wrong, and the wrong clause is invisible: the page renders,
 * just with one section too many or too few. `lib/cms/resolve.ts` is the only place that logic
 * lives, and `db:check-data-layer` keeps every route out of `page_sections` directly.
 *
 * A `kind = 'SYSTEM'` PAGE IS STRUCTURALLY UNREACHABLE HERE. `resolvePage` matches on `path`, and a
 * system page has `path = null`. Null equals nothing, including itself, so the reserved
 * `slug = 'global'` row cannot be served no matter what is asked for — the guard is the shape of
 * the data, not a filter someone can delete in a refactor.
 */

export type ResolveOptions = {
  /**
   * Draft mode. Returns sections regardless of status or window.
   *
   * THE CALLER PROVES THE SESSION, NOT THIS FUNCTION. `app/api/preview/route.ts` checks
   * `requirePermission('content.read')` before enabling draft mode, and the resolver trusts the
   * flag. Putting the permission check here would mean every public render pays for a session
   * lookup to answer a question it already knows the answer to.
   */
  readonly draft?: boolean
  /**
   * The instant to evaluate the window at. Defaults to the real clock — the ONLY place in
   * `lib/cms` that reads it — so every layer below is testable at a boundary.
   */
  readonly now?: Date
  /** Include hidden sections. Studio previews use it; the public site never does. */
  readonly includeHidden?: boolean
}

export type ResolvedPage = {
  readonly page: Page
  readonly sections: readonly PageSection[]
  /**
   * Sections dropped by the window or by visibility, in draft mode only.
   *
   * Studio needs to show an editor WHY a section is not on the live page. Empty in public mode,
   * where the distinction between "hidden" and "does not exist" is not the visitor's business.
   */
  readonly hidden: readonly PageSection[]
}

/**
 * Is this section live at `now`, given the page it sits on is?
 *
 * EXPORTED, AND PURE, BECAUSE THIS IS THE PART THAT CAN BE WRONG. The queries around it are thin;
 * the selection is four clauses (visibility, status, publish window, unpublish window) and getting
 * one wrong renders a page that still looks fine — with one section too many or too few. A pure
 * function is testable at every boundary without a database, and `supabase-js` speaks HTTP to
 * PostgREST rather than to a Postgres socket, so a database-backed test of the resolver is not
 * available here anyway.
 */
export function sectionIsLive(section: SectionWindow, now: Date, includeHidden = false): boolean {
  if (!includeHidden && !section.is_visible) return false
  return isLive(section, now)
}

/** The four fields `sectionIsLive` reads. Narrower than `PageSection` so a test can build one. */
export type SectionWindow = {
  readonly is_visible: boolean
  readonly status: string
  readonly publish_at: string | null
  readonly unpublish_at: string | null
}

/**
 * The sections a visitor sees, and the ones an editor is told about.
 *
 * Split out from `resolvePage` so the ordering-and-filtering decision can be tested with fixtures.
 * `draft` returns everything and reports what is not live; public mode returns only what is.
 */
export function selectSections<T extends SectionWindow>(
  sections: readonly T[],
  now: Date,
  options: { readonly draft?: boolean; readonly includeHidden?: boolean } = {},
): { readonly sections: readonly T[]; readonly hidden: readonly T[] } {
  const draft = options.draft ?? false
  const includeHidden = options.includeHidden ?? draft

  if (draft) {
    return { sections, hidden: sections.filter((s) => !sectionIsLive(s, now, false)) }
  }
  return { sections: sections.filter((s) => sectionIsLive(s, now, includeHidden)), hidden: [] }
}

/**
 * Resolve a public path to its ordered, visible, in-window blocks.
 *
 * Returns `null` for a path that does not exist, for a page that is not live, and for a system
 * page — all three are a 404 to a visitor, and distinguishing them in the return type would invite
 * a caller to leak which one it was.
 */
export async function resolvePage(
  client: Client,
  path: string,
  options: ResolveOptions = {},
): Promise<ResolvedPage | null> {
  const now = options.now ?? new Date()
  const draft = options.draft ?? false
  const includeHidden = options.includeHidden ?? draft

  const page = await getPageByPath(client, path)
  if (page === null) return null

  // In draft mode a page's own status and window are ignored — that is what previewing an
  // unpublished page means. Outside it, both bind.
  if (!draft && !isLive(page, now)) return null

  const all = await listSectionsForPage(client, page.id)
  return { page, ...selectSections(all, now, { draft, includeHidden }) }
}

/**
 * Resolve what `/studio/content/pages/[pageId]` was given — a uuid or a `pages.slug`.
 *
 * Unlike `resolvePage` this returns SYSTEM pages: the reserved `slug = 'global'` row is exactly
 * what `/studio/content/pages/global` is for, and it is reachable here because Studio is behind
 * `requirePermission('content.read')` and is not the public site.
 *
 * Never filters by status or window either. An editor opening a draft must see the draft.
 */
export async function resolveStudioPage(
  client: Client,
  param: string,
): Promise<ResolvedPage | null> {
  const page = await getPageByIdOrSlug(client, param)
  if (page === null) return null

  const sections = await listSectionsForPage(client, page.id)
  return { page, ...selectSections(sections, new Date(), { draft: true }) }
}
