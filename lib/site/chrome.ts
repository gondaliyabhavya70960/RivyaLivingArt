import 'server-only'

import { cache } from 'react'

import { siteStrings, type SiteStrings } from '@/lib/cms/strings'
import { createPublicClient } from '@/lib/supabase/public'
import { listCategories } from '@/lib/supabase/repositories/categories'
import {
  getContactDetailsSection,
  listGlobalContent,
  listNavigationItems,
  listPublicPagePaths,
} from '@/lib/supabase/repositories/cms'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import type { Category, MediaAsset } from '@/lib/supabase/schemas'

import { contactDetailsOf, type ContactDetails } from './contact-details'
import { announcementFrom, type Announcement } from './announcement'
import { buildMenu, footerColumns, type FooterColumn, type MenuItem } from './menu'
import { livePathsFrom } from './live-paths'

/**
 * Everything the site chrome needs, fetched once per request.
 *
 * THE LAYOUT CALLS THIS AND NOTHING ELSE DOES. A header that fetched its own menu, a footer that
 * fetched its own columns and an announcement bar that fetched its own row would be three round
 * trips per page, in sequence, on every route on the site — and the third one would only be
 * discovered by someone reading a waterfall in a profiler months later. `React.cache` makes a
 * second call within the same request free, so `generateMetadata` and the layout can both ask
 * without arranging to share.
 *
 * "ONE ROUND TRIP" IS FIVE PARALLEL QUERIES, NOT ONE STATEMENT. PostgREST has no join across
 * unrelated tables and supabase-js has no batch, so the honest reading of the phase document's
 * requirement is one *call site* and one *wait*: `Promise.all` makes the five overlap, so the cost
 * is the slowest of them rather than their sum. A `select=*,children(*)` embed would collapse two
 * of them, but only by making the shape of the query depend on a foreign key name — which is worse
 * to read and no faster than the parallel version.
 *
 * IT USES THE ANONYMOUS CLIENT EVEN FOR A SIGNED-IN VISITOR. The chrome is the same for everyone:
 * there is no per-visitor menu and no staff-only footer link. Using the cookie-bound client would
 * make every public route dynamic to produce a byte-identical result. Draft mode does not change
 * that either — previewing an unpublished PAGE does not mean previewing an unpublished MENU, and
 * an editor who saw draft navigation in preview would be looking at a site no visitor can reach.
 *
 * WHAT IS ABSENT IS ABSENT. Phase 09 seeds the announcement rows `DRAFT`, because the message
 * asserts three services the owner has not yet confirmed; the anon policy therefore does not admit
 * them and `announcement` is null. The bar does not render. That is the designed outcome of D10,
 * not a gap to paper over with a default message.
 */
export type SiteChrome = {
  /** Null when no enabled, published announcement row exists. The bar renders nothing. */
  readonly announcement: Announcement | null
  /** `menu = 'HEADER'`, top level in position order, each with its published children. */
  readonly header: readonly MenuItem[]
  /** `menu = 'MOBILE'`. Separate rows, so a shorter mobile menu is an edit rather than a deploy. */
  readonly mobile: readonly MenuItem[]
  /** `menu = 'FOOTER'`, grouped into SEED §24's columns. */
  readonly footer: readonly FooterColumn[]
  /** Every published, enabled `global_content` row, by `group_key.key`. */
  readonly strings: SiteStrings
  /** The seven primary categories, for the mega menu's cards. */
  readonly categories: readonly Category[]
  /** Category hero assets by id. A category whose hero is unset or hidden is simply absent. */
  readonly categoryMedia: ReadonlyMap<string, MediaAsset>
  /** From the one `contact-details` section. Null when the section is absent or does not parse. */
  readonly contact: ContactDetails | null
  /**
   * Has the owner confirmed those details are right?
   *
   * SEPARATE FROM `contact` BECAUSE THE TWO ANSWER DIFFERENT QUESTIONS. The footer renders whatever
   * the section says, verified or not — an editor needs to see their own work. The WhatsApp handoff
   * does not: a phone number nobody has confirmed is worse than none, because a customer will ring
   * it, so `lib/whatsapp/number.ts` requires this to be true before it will use the number.
   */
  readonly contactVerified: boolean
  /**
   * The paths a visitor can actually load right now — pages with at least one section the
   * anonymous client can see.
   *
   * NARROWER THAN THE ROUTE MAP, ON PURPOSE. `/custom-commissions` has a route file and a `pages`
   * row and answers 404, because every section on it is still DRAFT. `resolveInternalTarget` uses
   * this set to decide whether an editor's link may be an anchor or must render as plain text, and
   * the route map cannot answer that question.
   *
   * It rides on the chrome load because it is one query per request for something several
   * renderers need, and `getSiteChrome` is already memoised per request.
   */
  readonly livePaths: ReadonlySet<string>
}

async function loadSiteChrome(): Promise<SiteChrome> {
  const client = createPublicClient()

  const [globalRows, navRows, categories, contactSection, publicPaths] = await Promise.all([
    listGlobalContent(client),
    listNavigationItems(client),
    listCategories(client),
    getContactDetailsSection(client),
    listPublicPagePaths(client),
  ])

  // The heroes of the categories that have one. Two of the seven do not — Phase 09 recorded both
  // as gaps — so this list is deliberately shorter than `categories`, and the menu renders those
  // two as text-only cards rather than borrowing a picture from another family.
  const heroIds = [...new Set(categories.map((c) => c.hero_media_id).filter(isNotNull))]
  const categoryMedia = await listMediaAssetsByIds(client, heroIds)

  const strings = siteStrings(globalRows)

  /*
   * THE ORACLE IS COMPOSED BEFORE THE MENUS ARE BUILT, because the menus now consult it — Phase 45.
   *
   * `publicPaths` alone was wrong for the seven `/collection/<slug>` paths: each has a published
   * `pages` row, and the route still 404s while its `categories` row is DRAFT. See
   * `lib/site/live-paths.ts` for why the two gates cannot be one query.
   */
  const livePaths = livePathsFrom(
    publicPaths.map((page) => page.path),
    categories.map((category) => category.slug),
  )

  return {
    announcement: announcementFrom(globalRows),
    header: buildMenu(navRows, 'HEADER', livePaths),
    mobile: buildMenu(navRows, 'MOBILE', livePaths),
    footer: footerColumns(navRows, livePaths),
    strings,
    categories,
    categoryMedia,
    contact: contactDetailsOf(contactSection),
    contactVerified: contactSection?.owner_verification === 'VERIFIED',
    livePaths,
  }
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

/**
 * Request-scoped and memoised.
 *
 * `React.cache` and not a module-level variable: a module-level cache in a server process is
 * shared between requests and between visitors, and would serve the menu as it was when the
 * process started until the process restarted — surviving every publish and every revalidate.
 */
export const getSiteChrome = cache(loadSiteChrome)
