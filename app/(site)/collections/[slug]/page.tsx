import type { Metadata } from 'next'
import * as React from 'react'

import { JsonLd } from '@/components/patterns/JsonLd'
import { mediaRefOf } from '@/lib/cms/media'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { optionalEnv } from '@/lib/env'
import { resolveSpec } from '@/lib/media/transform'
import { imageUrl } from '@/lib/media/url'
import { entityBreadcrumbs } from '@/lib/seo/breadcrumbs'
import { siteOrigin } from '@/lib/seo/canonical'
import { collectionJsonLd, graphOf } from '@/lib/seo/jsonld'
import { listCollections } from '@/lib/supabase/repositories/collections'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { createPublicClient } from '@/lib/supabase/public'
import { prerenderParams } from '@/lib/site/prerender'

/**
 * `/collections/[slug]` — the exhibition page.
 *
 * IT IS A CMS PAGE, NOT A BESPOKE LAYOUT, AND THAT IS THE POINT OF THE WHOLE PHASE. Every band a
 * visitor sees is a `page_sections` row on the `pages` row `collections.page_id` names, rendered by
 * the same `renderCmsPage` that serves `/about`. The route contributes exactly two things the CMS
 * cannot: the structured data below, and the fact that this path exists at all. If an exhibition
 * needs a new kind of band, that is a block — never a branch in this file — because the moment a
 * route starts appending its own copy the owner has lost the ability to change it (D2).
 *
 * THE PATH IS DERIVED, NOT STORED TWICE. `sync_collection_page_path` writes
 * `'/collections/' || lower(slug)` onto the page whenever the slug changes, so the URL a visitor
 * loads and the `pages.path` the resolver looks up are the same string by construction. The slug is
 * `citext`, so it is lowercased here as well: `/collections/Winter` and `/collections/winter` are
 * the same collection to the database and would otherwise be two URLs, one of which 404s.
 *
 * ONE GATE, AND IT IS THE PAGE'S. `renderCmsPage` answers a page that is unpublished, unscheduled
 * or has no live sections with a 404, and that single rule covers every case here — including the
 * one worth naming: a collection can be PUBLISHED while its page is not, because publishing a
 * collection row directly does not touch the page. The exhibition then 404s, which is correct.
 * The reverse cannot happen: `sync_entity_page_status` publishes the collection when its page is
 * published, and `enforce_collection_publish_gate` fails the whole transaction if the concept is
 * not owner-confirmed — so a published page always has a published, confirmed collection behind it.
 *
 * THERE IS NO `opengraph-image.tsx` BESIDE THIS FILE, AND THERE MUST NOT BE. The phase document
 * lists one, "uses the `og` preset from `lib/media/transform.ts`" — and that is already exactly what
 * happens: `buildPageMetadata` resolves `seo_entries.og_media_id` for this page through
 * `resolveSpec('og')`, so an editor picks the social image in Studio like they do for every other
 * page. Next gives FILE-BASED metadata precedence over the `metadata` export, so adding the route
 * would silently override the editor's choice on exactly these pages and replace it with a
 * generated card — the owner would change the image in Studio and watch nothing happen. Amendment
 * A14 records it.
 *
 * THE COLLECTION IS READ ONLY FOR THE JSON-LD. A missing one is not a 404 on its own: it would mean
 * a `pages` row that looks like an exhibition and is not linked to a collection, which is an
 * editorial mistake rather than a broken URL, and the page's own sections still render. What it
 * does mean is no structured data, because there is nothing true to say.
 */

type Params = { readonly slug: string }
type Props = { readonly params: Promise<Params> }

const BASE = '/collections'

const pathFor = (slug: string) => `${BASE}/${slug.toLowerCase()}`

/**
 * Published collections only.
 *
 * The anonymous client is the filter, as everywhere else: nothing here says `status = 'PUBLISHED'`,
 * because RLS says it once in a policy. A concept nobody has confirmed is not pre-rendered and,
 * since the same rule applies at request time to its page, is not reachable either.
 *
 * IN THE SEEDED STATE THIS RETURNS NOTHING, and that is the phase shipping as designed: all ten
 * collections are concepts, none is published, and `/collections/anything` is a 404 until the owner
 * confirms one.
 */
export async function generateStaticParams(): Promise<Params[]> {
  return prerenderParams('/collections/[slug]', async () => {
    const collections = await listCollections(createPublicClient())
    return collections.map((collection) => ({ slug: collection.slug.toLowerCase() }))
  })
}

/** The collection for this slug, or null. Compared case-insensitively, as `citext` would. */
async function collectionFor(slug: string) {
  const wanted = slug.toLowerCase()
  const collections = await listCollections(createPublicClient())
  return collections.find((collection) => collection.slug.toLowerCase() === wanted) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const collection = await collectionFor(slug)
  return cmsPageMetadata(pathFor(slug), {
    // The ENTITY rung (a `seo_entries` ENTITY row, read inside) above the page's PATH row; the
    // page's own sections are the DERIVED rung, computed by `cmsPageMetadata`.
    ...(collection === null
      ? {}
      : {
          entity: { type: 'collections', id: collection.id, ogMediaId: collection.hero_media_id },
        }),
  })
}

export default async function CollectionPage({ params }: Props): Promise<React.ReactElement> {
  const { slug } = await params
  const path = pathFor(slug)

  const collection = await collectionFor(slug)
  const graph = collection === null ? null : await jsonLdFor(collection, path)

  return (
    <>
      <JsonLd graph={graph} />
      {await renderCmsPage(path)}
    </>
  )
}

/**
 * The `CollectionPage` node, or null when there is nothing true to put in one.
 *
 * THE IMAGE IS THE SIGNATURE ASSET OR THE HERO, IN THAT ORDER, AND NEITHER IS INVENTED. A concept
 * has neither bound, so no `image` key is emitted — rather than a category photograph that is not
 * this collection's, which is the kind of small dishonesty structured data makes permanent.
 */
async function jsonLdFor(
  collection: Awaited<ReturnType<typeof collectionFor>> & object,
  path: string,
) {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')?.trim() ?? ''
  // A relative `url` in structured data is not a URL. With no origin configured there is nothing
  // valid to emit, which is the honest answer in development rather than a half-formed graph.
  if (origin === null) return null

  const mediaId = collection.signature_media_id ?? collection.hero_media_id
  const [assets, trail] = await Promise.all([
    mediaId === null
      ? Promise.resolve(new Map())
      : listMediaAssetsByIds(createPublicClient(), [mediaId]),
    // Home → the collections listing (only while it is live) → this exhibition.
    entityBreadcrumbs({
      listingPath: '/collection',
      entityName: collection.name,
      entityPath: path,
    }),
  ])
  const asset = mediaId === null ? null : (assets.get(mediaId) ?? null)

  const node = collectionJsonLd(
    collection,
    new URL(path, origin).toString(),
    asset === null || cloudName === ''
      ? null
      : imageUrl(cloudName, mediaRefOf(asset), resolveSpec('og')),
  )
  return graphOf([node, trail])
}
