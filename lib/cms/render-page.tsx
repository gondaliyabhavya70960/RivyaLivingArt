import 'server-only'

import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import * as React from 'react'
import { cache } from 'react'

import { SectionRail } from '@/components/patterns/SectionRail'
import { SectionList } from '@/components/sections/SectionList'
import { sectionRenderer } from '@/components/sections/registry'
import { optionalEnv } from '@/lib/env'
import { buildPageMetadata, type PageMetadataInput } from '@/lib/seo/metadata'
import { redirectOrNotFound } from '@/lib/seo/redirects'
import { deriveSeo } from '@/lib/seo/resolve'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import type { PageSection } from '@/lib/supabase/schemas'

import type { ResolvedPage } from './resolve'

import { isBlockType } from './block-types'
import { loadPageMedia } from './media'
import { loadPageReferences } from './references'
import { resolvePage } from './resolve'

/**
 * Render a seeded path. Twelve of the thirteen static routes are one call to this and nothing else.
 *
 * WHY A FUNCTION AND NOT A CATCH-ALL ROUTE. `app/(site)/[[...path]]/page.tsx` would serve every
 * one of these paths from one file, and it would also swallow every future route: `/product/x`
 * would resolve here, find no `pages` row and 404, instead of failing to build when Phase 15
 * forgets to add it. One thin file per path keeps the route map in the file system where D3 says
 * it lives, and `tests/unit/site-routes.test.ts` asserts the two agree exactly.
 *
 * A PAGE WITH NO LIVE SECTIONS IS A 404, NOT AN EMPTY SHELL. This is SEED §55 stated as code: a
 * published route with nothing on it renders a header, a footer and a blank middle, which a
 * visitor reads as "Coming Soon" and a crawler indexes as a real page. `notFound()` is the honest
 * answer — the page does not exist yet — and `app/(site)/not-found.tsx` says so in seeded words,
 * inside the site shell.
 *
 * MEASURED LIMITATION, RECORDED RATHER THAN WORKED AROUND. On Next 16 the not-found UI reaches the
 * browser in the RSC payload rather than in the initial HTML, so the 404 document's `<body>` is
 * empty until React renders it. Verified in Chromium: with JavaScript the page is complete —
 * status 404, the seeded eyebrow, heading, body and both CTAs, inside the full site chrome;
 * without JavaScript the body is blank. It is not caused by anything in this file: a page whose
 * whole body is `notFound()`, with no `await` before it, behaves identically, and so does one with
 * no `revalidate` and no `not-found.tsx` of its own.
 *
 * WHY IT IS ACCEPTED HERE. The alternative Next documents is a check in `proxy.ts` that rewrites
 * missing paths before the response starts — a database query on every public request, in a file
 * amendment A2·b restricts to session refresh, to improve the one page a visitor is not meant to
 * reach. What actually matters is intact: the HTTP status is a true 404 rather than a soft one, so
 * crawlers and monitoring are correct, and every visitor with JavaScript sees the seeded page.
 * Recorded in ARCHITECTURE.md for Phase 39 (SEO) and Phase 41 (accessibility) to weigh.
 *
 * IN THE SEEDED STATE THAT MEANS EVERY PATH 404s, AND THAT IS CORRECT. Phase 09 seeds all 53
 * sections `DRAFT`, because a section is created DRAFT by database trigger and 25 of them assert
 * business claims nobody has confirmed. The site becomes visible when an editor publishes, which
 * is the workflow Phase 08 built, not something this phase should route around by auto-publishing
 * copy the owner has never read.
 *
 * DRAFT MODE SWITCHES THE CLIENT, and it must. The anonymous client sees only what RLS admits, so
 * previewing an unpublished page through it would return exactly nothing; the cookie-bound client
 * carries the staff session that `app/api/preview/route.ts` has already checked `content.read`
 * against. It also makes the route dynamic, which is what a preview needs.
 */

/** Sections this build cannot draw: an unknown type, or a known one with no renderer yet. */
function unrenderable(sections: readonly PageSection[]): readonly PageSection[] {
  return sections.filter(
    (section) => !isBlockType(section.block_type) || sectionRenderer(section.block_type) === null,
  )
}

/**
 * The development-only diagnostic.
 *
 * NOTHING LIKE THIS SHIPS TO A VISITOR. A block type this build does not know is a deploy running
 * behind the database — a real problem, but one whose audience is a developer, and a red panel on
 * the live site would tell a customer about the project's internals. In production those sections
 * render nothing at all (`SectionList` returns null for each), and Studio shows the same section
 * with an explicit "no renderer" notice, which is where the person who can fix it is looking.
 *
 * The `NODE_ENV` check is a literal comparison rather than a helper so that the bundler can prove
 * it false and drop this whole subtree from a production build.
 */
function MissingRenderers({
  sections,
}: {
  readonly sections: readonly PageSection[]
}): React.ReactElement | null {
  if (process.env.NODE_ENV === 'production' || sections.length === 0) return null

  return (
    <aside className="m-4 rounded-sm border border-state-danger p-4 text-state-danger">
      <p className="text-sm font-semibold">
        {sections.length} section(s) on this page have no renderer in this build.
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <code>{section.block_type}</code> at position {section.position}
          </li>
        ))}
      </ul>
    </aside>
  )
}

/**
 * The page, resolved once per request.
 *
 * BOTH `generateMetadata` AND THE COMPONENT NEED IT, and Next calls them separately — so without
 * this every route would resolve its page twice and load its media twice, on every request. The
 * cache is `React.cache`, which is request-scoped: a module-level map would serve one visitor's
 * draft-mode result to the next visitor.
 */
const resolveForRequest = cache(
  async (path: string): Promise<{ resolved: ResolvedPage | null; draft: boolean }> => {
    const draft = (await draftMode()).isEnabled
    const client = draft ? await createClient() : createPublicClient()
    return { resolved: await resolvePage(client, path, { draft }), draft }
  },
)

/**
 * A route's metadata, driven by the same resolution the render uses.
 *
 * A PATH THAT WILL 404 STILL RETURNS METADATA FROM HERE, rather than raising the 404 early.
 * `generateMetadata` runs before rendering, so raising it here looks like it ought to produce a
 * fully server-rendered 404 document instead of a streamed one — and it does not. Measured, on
 * this version: a page that calls `notFound()` synchronously, before any `await`, still yields an
 * HTTP 404 whose HTML body is empty, with the not-found UI delivered in the RSC payload and
 * rendered on the client. See `renderCmsPage` below for what that means and what it does not.
 * Since raising it early changes nothing observable, it is raised once, where the decision belongs.
 *
 * Zero live sections is passed through as the `noindex` signal.
 */
export async function cmsPageMetadata(
  path: string,
  /**
   * A listing route passes its page and pagination links, an entity route its ENTITY rung; every
   * other route passes none. The DERIVED rung is computed here from the sections that will render,
   * so a page and its metadata cannot disagree about what is on it.
   */
  extra: Pick<PageMetadataInput, 'entity' | 'listing' | 'pagination'> = {},
): Promise<Metadata> {
  const { resolved } = await resolveForRequest(path)
  return buildPageMetadata({
    path,
    liveSectionCount: resolved?.sections.length ?? 0,
    derived: resolved === null ? null : deriveSeo(resolved.sections),
    ...extra,
  })
}

/**
 * `below` — content the route appends after the page's CMS sections.
 *
 * ONLY THE CATALOGUE ROUTES USE IT, and they use it for something the CMS genuinely cannot hold: a
 * grid of database rows with filters over them. Everything a section can express stays a section,
 * because the moment a route starts appending its own copy the owner has lost the ability to
 * change that copy — which is the whole point of D2. A listing is not copy; it is a query.
 *
 * IT DOES NOT RESCUE A PAGE WITH NO LIVE SECTIONS. A category page whose hero is still DRAFT is
 * still a 404: SEED §55's rule is about whether the page has been published, and a product grid
 * appearing under a heading nobody approved would be exactly the "looks finished" failure the rule
 * exists to prevent.
 */
export async function renderCmsPage(
  path: string,
  below?: React.ReactNode,
  /**
   * `?product=<slug>`, for the one route that reads one.
   *
   * `/custom-commissions` is the only CMS page whose content depends on a query parameter — the
   * conversion rail on a product page links to it with the piece the visitor was looking at, and
   * the configurator opens that piece's bound form. Reading a search parameter makes a route
   * dynamic, so it arrives here as an argument from the route that chose to be: the other twelve
   * stay static.
   */
  productSlug: string | null = null,
): Promise<React.ReactElement> {
  const { resolved, draft } = await resolveForRequest(path)
  // Phase 39: the one moment a redirect is consulted. A path with no page row at all may be an
  // address that moved; a page that exists but has nothing live on it is not, and stays a 404.
  if (resolved === null) return redirectOrNotFound(path)

  // In draft mode an empty page is legitimate — an editor is looking at a page they are still
  // building, and answering with a 404 would hide the very thing they asked to preview.
  if (!draft && resolved.sections.length === 0) notFound()

  const client = draft ? await createClient() : createPublicClient()
  /*
   * THREE PARALLEL LOADS, AND NONE OF THEM INSIDE A RENDERER. Media and entity references are both
   * hydrated before rendering starts, for the reason `components/sections/types.ts` gives: a
   * renderer that fetched its own data would issue a round trip per section, in sequence, inside
   * the render. `loadPageReferences` issues nothing at all for a page with no reference block.
   */
  const [assets, references, chrome] = await Promise.all([
    loadPageMedia(client, resolved.sections),
    loadPageReferences(
      client,
      resolved.sections,
      resolved.page.id,
      productSlug,
      resolved.page.path,
    ),
    getSiteChrome(),
  ])

  return (
    <>
      <MissingRenderers sections={unrenderable(resolved.sections)} />
      {/*
       * THE PAGE-SECTION INDEX (RC-245). Rendered here rather than in the site layout because it
       * indexes THIS page's bands, and the layout cannot see them — `resolved.sections` exists
       * only inside this function. It returns null on a page with fewer than two labelled bands,
       * so short routes get no empty column.
       */}
      <SectionRail sections={resolved.sections} strings={chrome.strings} />
      <SectionList
        sections={resolved.sections}
        assets={assets}
        strings={chrome.strings}
        // Optional for the same reason as in the site layout: a page whose sections bind no media
        // must not fail to render because an image setting is absent. Empty resolves to the §47
        // fallback wherever an asset would have been drawn.
        cloudName={optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''}
        references={references}
        livePaths={chrome.livePaths}
      />
      {below}
    </>
  )
}
