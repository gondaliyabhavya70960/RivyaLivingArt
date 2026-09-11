import 'server-only'

import type { Metadata } from 'next'

import { mediaRefOf } from '@/lib/cms/media'
import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { resolveSpec } from '@/lib/media/transform'
import { imageUrl } from '@/lib/media/url'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { getGlobalSeoEntry, getSeoEntryByPath } from '@/lib/supabase/repositories/cms'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { getSeoEntryForEntity, type SeoEntityType } from '@/lib/supabase/repositories/seo'

import { canonicalFor, siteOrigin } from './canonical'
import { resolveSeo, type DerivedSeo, type ResolvedSeo } from './resolve'

/**
 * A page's `Metadata`, from the four-level ladder in `lib/seo/resolve.ts` — Phase 39.
 *
 * ENTITY → PATH → DERIVED → GLOBAL, per field, first hit wins; then the SEED §41 title template
 * over whatever the ladder answered; then the canonical rule table in `lib/seo/canonical.ts`; then
 * the directive. Every rung is a row or a computation over rows — the only literal in this file is
 * `'%s'`, and it is a format placeholder rather than copy.
 *
 * THE TEMPLATE IS APPLIED HERE, NOT THROUGH NEXT'S `title.template`. That field lives on a layout
 * and applies to every descendant, including the home page, whose title IS the brand: run through
 * the template it would read "Rivya Living Art | Rivya Living Art". The phase document's rule —
 * `/` renders an absolute title — falls out of resolving per page instead: a title that resolved
 * from the GLOBAL rung is the brand itself and is never templated.
 *
 * `noindex` FOR A PAGE WITH NO PUBLISHED SECTIONS, WHATEVER THE ROW SAYS. `renderCmsPage` already
 * answers such a path with a 404; this is the belt to that braces, kept from Phase 10. The row's
 * own `noindex`/`nofollow` add to it; a filtered listing and `/search` add `noindex` from the
 * canonical rule; nothing subtracts.
 */

const TITLE_PLACEHOLDER = '%s'

export type PageMetadataInput = {
  readonly path: string
  /** How many sections the page will actually render. Zero means `noindex`. */
  readonly liveSectionCount: number
  /**
   * The ENTITY rung: the `seo_entries` row of scope ENTITY for this entity is read here; the
   * entity's OWN SEO columns (a product's `seo_title`) come in as `title`/`description`, because
   * both are words an owner typed for this one thing and rank above the path's row.
   */
  readonly entity?: {
    readonly type: SeoEntityType
    readonly id: string
    readonly title?: string | null
    readonly description?: string | null
    readonly ogMediaId?: string | null
  }
  /** The DERIVED rung, computed by the caller from what it will render (`deriveSeo`). */
  readonly derived?: DerivedSeo | null
  /** A listing's page and whether any query beyond `page` narrows it. */
  readonly listing?: { readonly page: number; readonly filtered: boolean }
  /** `rel="prev"` / `rel="next"` for a paginated view, as absolute-from-root paths. */
  readonly pagination?: { readonly previous?: string; readonly next?: string }
  /** `/search`: no canonical, `noindex, follow`. */
  readonly searchSurface?: boolean
}

export type PageSeo = {
  readonly metadata: Metadata
  readonly resolved: ResolvedSeo
  readonly canonicalHref: string | null
}

/** The og:image, if the ladder names one and RLS admits it. */
async function socialImage(ogMediaId: string | null): Promise<string | null> {
  if (ogMediaId === null) return null
  const assets = await listMediaAssetsByIds(createPublicClient(), [ogMediaId])
  const asset = assets.get(ogMediaId)
  if (asset === undefined) return null
  /*
   * NO CLOUD NAME MEANS NO CARD IMAGE, NOT A FAILED PAGE. `requiredEnv` here would throw inside
   * `generateMetadata`, so a deployment without the variable would 500 on exactly those pages
   * whose SEO entry names an image. Phase 10 made the same choice in the site layout.
   */
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  if (cloudName === null) return null
  // The `og` preset, not an ad-hoc size: it fixes 1200x630 and `f_jpg` rather than `f_auto`,
  // because format negotiation needs an `Accept` header and the crawlers that fetch a card do
  // not send a useful one.
  return imageUrl(cloudName, mediaRefOf(asset), resolveSpec('og'))
}

export async function resolvePageSeo(input: PageMetadataInput): Promise<PageSeo> {
  const client = createPublicClient()

  const [pathEntry, globalEntry, entityEntry, chrome] = await Promise.all([
    getSeoEntryByPath(client, input.path),
    getGlobalSeoEntry(client),
    input.entity === undefined
      ? Promise.resolve(null)
      : getSeoEntryForEntity(client, input.entity.type, input.entity.id),
    getSiteChrome(),
  ])

  const resolved = resolveSeo({
    entity: entityEntry,
    entityOwn:
      input.entity === undefined
        ? null
        : {
            title: input.entity.title,
            description: input.entity.description,
            ogMediaId: input.entity.ogMediaId,
          },
    path: pathEntry,
    derived: input.derived ?? null,
    global: globalEntry,
  })

  const template = siteString(chrome.strings, 'SEO_DEFAULT.title_template')
  const siteName = siteString(chrome.strings, 'SEO_DEFAULT.site_name')

  /**
   * The template applies to a PAGE title. A title that came from the GLOBAL rung is the brand's
   * own, and the site name is the last resort behind it; neither is templated.
   */
  const title =
    resolved.title.level === 'NONE'
      ? (siteName ?? '')
      : resolved.title.level === 'GLOBAL' || template === null
        ? (resolved.title.value ?? '')
        : template.replace(TITLE_PLACEHOLDER, resolved.title.value ?? '')

  const description = resolved.description.value ?? undefined

  const socialTitle =
    resolved.socialTitle.value ?? siteString(chrome.strings, 'SOCIAL.og_headline') ?? title
  const socialDescription =
    resolved.socialDescription.value ??
    siteString(chrome.strings, 'SOCIAL.og_description') ??
    description

  const rawSiteUrl = optionalEnv('NEXT_PUBLIC_SITE_URL')
  const origin = siteOrigin(rawSiteUrl)
  const canonical = canonicalFor({
    siteUrl: origin,
    path: input.path,
    page: input.listing?.page,
    filtered: input.listing?.filtered,
    searchSurface: input.searchSurface,
    ownerCanonical: resolved.canonicalUrl.value,
  })

  const image = await socialImage(resolved.ogMediaId.value)

  const indexable = input.liveSectionCount > 0 && !resolved.noindex && !canonical.noindex
  const follow = !resolved.nofollow

  const metadata: Metadata = {
    title,
    ...(description === undefined ? {} : { description }),
    ...(origin === null
      ? {}
      : {
          metadataBase: new URL(origin),
          ...(canonical.path === null ? {} : { alternates: { canonical: canonical.path } }),
        }),
    ...(input.pagination === undefined ? {} : { pagination: input.pagination }),
    // Explicit rather than a bare string: `follow` still lets a crawler discover the links on a
    // page it will not index, so an incomplete page does not become a dead end in the graph.
    robots: { index: indexable, follow },
    openGraph: {
      type: 'website',
      title: socialTitle,
      ...(socialDescription === undefined ? {} : { description: socialDescription }),
      ...(siteName === null ? {} : { siteName }),
      ...(canonical.href === null ? {} : { url: canonical.href }),
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

  return { metadata, resolved, canonicalHref: canonical.href }
}

export async function buildPageMetadata(input: PageMetadataInput): Promise<Metadata> {
  return (await resolvePageSeo(input)).metadata
}
