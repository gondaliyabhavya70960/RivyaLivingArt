import 'server-only'

import type { Metadata } from 'next'

import { siteString } from '@/lib/cms/strings'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { getGlobalSeoEntry, getSeoEntryByPath } from '@/lib/supabase/repositories/cms'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { resolveSpec } from '@/lib/media/transform'
import { imageUrl } from '@/lib/media/url'
import { mediaRefOf } from '@/lib/cms/media'
import { optionalEnv } from '@/lib/env'
import type { SeoEntry } from '@/lib/supabase/schemas'

/**
 * A page's `Metadata`, from `seo_entries` with the SEED §41 fallbacks behind it.
 *
 * THE FALLBACK CHAIN IS THREE DEEP AND EVERY STEP IS A ROW, not a literal: the path's own entry,
 * then the single `GLOBAL` entry, then the `SEO_DEFAULT` strings. Only the last resort — an empty
 * title — is decided in code, and it is empty rather than invented. There is one literal in this
 * file, `'%s'`, and it is a format placeholder rather than copy.
 *
 * ALL EIGHT PER-PATH ENTRIES ARE `DRAFT` AS SEEDED, so the anonymous client returns none of them
 * and every page currently renders from the GLOBAL row. That is not a defect to code around: the
 * titles assert what Rivya makes ("Resin Furniture & Functional Art"), so Phase 09 left them for
 * the owner to confirm. The chain means the site still has a coherent title and description in the
 * meantime instead of nothing.
 *
 * `noindex` FOR A PAGE WITH NO PUBLISHED SECTIONS. `renderCmsPage` already answers such a path
 * with a 404, so this is the belt to that braces: a route that starts rendering something before
 * its content is ready must not enter an index on the strength of it, and a crawler that saw the
 * page in a window where it briefly resolved would otherwise keep it.
 */

const TITLE_PLACEHOLDER = '%s'

export type PageMetadataInput = {
  readonly path: string
  /** How many sections the page will actually render. Zero means `noindex`. */
  readonly liveSectionCount: number
  /**
   * The address this particular view should be indexed at, when it is not `path`.
   *
   * A LISTING HAS MORE ADDRESSES THAN ROUTES. `/collection/furniture?sort=title&page=2` is a real,
   * linkable, crawlable page and its canonical URL is itself — pointing every filtered and paged
   * view back at the bare path would tell a crawler that page 2 is a duplicate of page 1 and that
   * its products do not exist. Phase 14 passes the canonical URL its own query builder produced,
   * so what is indexed is exactly what is rendered.
   */
  readonly canonicalPath?: string
  /** `rel="prev"` / `rel="next"` for a paginated view, as absolute-from-root paths. */
  readonly pagination?: { readonly previous?: string; readonly next?: string }
  /**
   * Title and description from the ROW ITSELF, for a route whose page is an entity rather than a
   * `pages` record.
   *
   * `/product/[slug]` has no `seo_entries` row and cannot have one: entries are keyed by path, and
   * there is one path per product. The words live on `products.seo_title` / `seo_description`
   * instead. Passing them here rather than writing a second metadata builder is what keeps the
   * §41 fallback chain — global entry, then `SEO_DEFAULT.site_name`, then the title template, then
   * the social keys and the OG image — in one place. A second builder would drift from this one
   * the first time either changed.
   *
   * Absent or blank falls through to exactly what a page with no entry gets.
   */
  readonly override?: {
    readonly title?: string | null
    readonly description?: string | null
  }
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * `NEXT_PUBLIC_SITE_URL` as a `URL`, or null.
 *
 * NULL RATHER THAN A GUESS. `metadataBase` decides what a relative OpenGraph image resolves to; a
 * wrong origin there produces a card pointing at a domain that is not ours. An absent variable in
 * development is ordinary, and Next simply omits the absolute URLs.
 */
function siteUrl(): URL | null {
  const raw = process.env['NEXT_PUBLIC_SITE_URL']
  if (raw === undefined || raw.trim() === '') return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** The og:image, if the entry names one and RLS admits it. */
async function socialImage(entry: SeoEntry | null): Promise<string | null> {
  if (entry?.og_media_id == null) return null
  const assets = await listMediaAssetsByIds(createPublicClient(), [entry.og_media_id])
  const asset = assets.get(entry.og_media_id)
  if (asset === undefined) return null
  /*
   * NO CLOUD NAME MEANS NO CARD IMAGE, NOT A FAILED PAGE. `requiredEnv` here would throw inside
   * `generateMetadata` — so a deployment without the variable would 500 on exactly those pages
   * whose SEO entry names an image, which is the opposite of how a missing OPTIONAL asset should
   * behave. Phase 10 made the same change in the site layout and `MediaSlot` for the same reason;
   * this call was the one left holding `requiredEnv`, and it only fires once an entry has an
   * `og_media_id`, which is why nothing had caught it.
   */
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  if (cloudName === null) return null

  // The `og` preset, not an ad-hoc size: it fixes 1200x630 and `f_jpg` rather than `f_auto`,
  // because format negotiation needs an `Accept` header and the crawlers that fetch a card do
  // not send a useful one.
  return imageUrl(cloudName, mediaRefOf(asset), resolveSpec('og'))
}

export async function buildPageMetadata(input: PageMetadataInput): Promise<Metadata> {
  const client = createPublicClient()

  const [entry, globalEntry, chrome] = await Promise.all([
    getSeoEntryByPath(client, input.path),
    getGlobalSeoEntry(client),
    getSiteChrome(),
  ])

  const template = siteString(chrome.strings, 'SEO_DEFAULT.title_template')
  const siteName = siteString(chrome.strings, 'SEO_DEFAULT.site_name')

  const pageTitle = nonEmpty(input.override?.title) ?? nonEmpty(entry?.title)
  const fallbackTitle = nonEmpty(globalEntry?.title) ?? siteName

  /**
   * The template is applied HERE rather than through Next's `title.template`, because that field
   * lives on a layout and applies to every descendant — including the pages whose own entry is
   * already a full title. §41's `%s | Rivya Living Art` is meant for a page title, and the GLOBAL
   * entry's title is the brand itself: run through the template it would read
   * "Rivya Living Art | Rivya Living Art".
   */
  const title =
    pageTitle === null
      ? (fallbackTitle ?? '')
      : template === null
        ? pageTitle
        : template.replace(TITLE_PLACEHOLDER, pageTitle)

  const description =
    nonEmpty(input.override?.description) ??
    nonEmpty(entry?.description) ??
    nonEmpty(globalEntry?.description) ??
    undefined

  const socialTitle =
    nonEmpty(entry?.social_title) ??
    // The override is the page's own title, so it precedes the GLOBAL social fallbacks but not a
    // social title an editor wrote for this specific path.
    nonEmpty(input.override?.title) ??
    nonEmpty(globalEntry?.social_title) ??
    siteString(chrome.strings, 'SOCIAL.og_headline') ??
    title
  const socialDescription =
    nonEmpty(entry?.social_description) ??
    nonEmpty(input.override?.description) ??
    nonEmpty(globalEntry?.social_description) ??
    siteString(chrome.strings, 'SOCIAL.og_description') ??
    description

  const image = await socialImage(entry ?? globalEntry)
  const base = siteUrl()

  /**
   * `robots` comes from the row when it is set, but a page with nothing on it is `noindex`
   * regardless of what the row says. The row expresses editorial intent; this expresses whether
   * there is anything to index at all, and the second one wins.
   */
  const indexable = input.liveSectionCount > 0
  const robotsValue = nonEmpty(entry?.robots) ?? nonEmpty(globalEntry?.robots)

  /**
   * ONE RESOLVED PATH FOR BOTH THE CANONICAL AND `og:url`, because they answer the same question.
   *
   * `canonicalPath` is what the catalogue routes pass so that page 3 of a filtered listing is
   * canonical to itself rather than to page 1. `og:url` used `input.path` — the bare route — so the
   * two disagreed on exactly the pages where `canonicalPath` was supplied: pasting
   * `/collection/lighting?page=3` into WhatsApp previewed page 1's title and image, and the share
   * silently sent the recipient somewhere the sender had not been looking at.
   */
  const canonicalPath = input.canonicalPath ?? input.path

  return {
    title,
    ...(description === undefined ? {} : { description }),
    ...(base === null ? {} : { metadataBase: base, alternates: { canonical: canonicalPath } }),
    ...(input.pagination === undefined ? {} : { pagination: input.pagination }),
    robots: indexable
      ? (robotsValue ?? undefined)
      : // Explicit rather than `robots: 'noindex'`: `follow` still lets a crawler discover the
        // links on the page, so an incomplete page does not become a dead end in the graph.
        { index: false, follow: true },
    openGraph: {
      type: 'website',
      title: socialTitle,
      ...(socialDescription === undefined ? {} : { description: socialDescription }),
      ...(siteName === null ? {} : { siteName }),
      ...(base === null ? {} : { url: new URL(canonicalPath, base).toString() }),
      ...(image === null ? {} : { images: [image] }),
    },
    twitter: {
      // `summary_large_image` because every og asset this project produces is the 1200×630 `og`
      // preset — a `summary` card would letterbox it into a thumbnail.
      card: 'summary_large_image',
      title: socialTitle,
      ...(socialDescription === undefined ? {} : { description: socialDescription }),
      ...(image === null ? {} : { images: [image] }),
    },
  }
}
