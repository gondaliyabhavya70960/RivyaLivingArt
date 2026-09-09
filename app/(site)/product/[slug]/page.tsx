import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as React from 'react'

import { ProductGallery } from '@/components/patterns/ProductGallery'
import { ProductInquiryRail } from '@/components/patterns/ProductInquiryRail'
import { ProductMaterialStory } from '@/components/patterns/ProductMaterialStory'
import { ProductSpecifications } from '@/components/patterns/ProductSpecifications'
import { RelatedContent, SAME_CATEGORY_LIMIT } from '@/components/patterns/RelatedContent'
import { Container } from '@/components/primitives/Container'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { currencyExponent, presentPrice, productBadges } from '@/lib/catalog/price'
import { getSiteChrome } from '@/lib/site/chrome'
import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { serialiseJsonLd } from '@/lib/seo/jsonld'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { productImageUrls, productJsonLd } from '@/lib/seo/product-jsonld'
import { imageUrl } from '@/lib/media/url'
import { mediaRefOf } from '@/lib/cms/media'
import { resolveSpec } from '@/lib/media/transform'
import { createPublicClient } from '@/lib/supabase/public'
import { listCategories } from '@/lib/supabase/repositories/categories'
import { listMaterials } from '@/lib/supabase/repositories/materials'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import {
  getProductBySlug,
  listProductMaterialIdsPublic,
  listProductMediaEdges,
  listProductsByCategory,
} from '@/lib/supabase/repositories/products'
import { listProductSpecs } from '@/lib/supabase/repositories/product-specs'
import { listRelationsForProduct } from '@/lib/supabase/repositories/relations'
import { NotFoundError } from '@/lib/supabase/errors'

/**
 * `/product/[slug]` — the page where a visitor understands an object rather than a listing.
 *
 * EVERY BAND IS ABSENT WHEN IT HAS NOTHING TO SAY. Not collapsed, not an empty heading, not "details
 * to follow": no specification rows means no specification block, no attached materials means no
 * material band, no relations means no related section, no media means no gallery. That is what
 * lets a product with a title, a category and one image read as a finished page rather than a
 * skeleton — which is the state the early real products will actually be in.
 *
 * FOUR-OH-FOUR IS THE ONLY REFUSAL, and it covers two different facts that must stay
 * indistinguishable: a slug nobody has used, and a product that exists but is not published.
 * `getProductBySlug` runs through the anon client, so RLS returns nothing in both cases and the
 * route cannot tell them apart even if it wanted to. Telling them apart would leak the existence
 * of a draft.
 *
 * NOTHING HERE PERSISTS OR REDIRECTS. The rail links to `/contact` and `/custom-commissions` with
 * `product=<slug>`, which Phases 19 and 20 read. There is no WhatsApp link on this route in this
 * phase (D1: an inquiry must be saved first, and saving does not exist until Phase 20) and no
 * checkout affordance of any kind, ever.
 */

type Params = { readonly slug: string }
type Props = { readonly params: Promise<Params> }

const BASE = '/product'

/**
 * Published products only.
 *
 * The anon client is the point: an unpublished product is not pre-rendered, and because the same
 * visibility rule applies at request time it is not reachable either. Two gates, one predicate.
 */
export async function generateStaticParams(): Promise<Params[]> {
  const client = createPublicClient()
  const categories = await listCategories(client)
  const lists = await Promise.all(
    categories.map(async (category) => listProductsByCategory(client, category.id)),
  )
  // A product with no category is legitimately unreachable this way; `dynamicParams` still renders
  // it on request. Pre-rendering is an optimisation, not the visibility rule.
  return [...new Set(lists.flat().map((product) => product.slug))].map((slug) => ({ slug }))
}

/** The product, or null. One read, shared by `generateMetadata` and the render. */
async function productFor(slug: string) {
  try {
    return await getProductBySlug(createPublicClient(), slug)
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await productFor(slug)

  return buildPageMetadata({
    path: `${BASE}/${slug}`,
    // A product that is not visible is not indexable. `liveSectionCount` is the switch
    // `buildPageMetadata` already has for "there is nothing here", and it is the honest value.
    liveSectionCount: product === null ? 0 : 1,
    override: {
      title: product?.seo_title ?? product?.title ?? null,
      description: product?.seo_description ?? product?.summary ?? null,
    },
  })
}

export default async function Page({ params }: Props): Promise<React.ReactElement> {
  const { slug } = await params
  const product = await productFor(slug)
  if (product === null) notFound()

  const client = createPublicClient()
  const chrome = await getSiteChrome()
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''

  const [mediaEdges, materialIds, specs, relations, categories] = await Promise.all([
    listProductMediaEdges(client, product.id),
    listProductMaterialIdsPublic(client, product.id),
    listProductSpecs(client, product.id),
    listRelationsForProduct(client, product.id),
    listCategories(client),
  ])

  const category = categories.find((row) => row.id === product.category_id) ?? null

  /*
   * THE HERO IS INCLUDED IN THE GALLERY EVEN WHEN NO `product_media` ROW NAMES IT.
   * `products.hero_media_id` and a `role = 'hero'` edge are two different ways of saying the same
   * thing, and an owner who set the column but never added the edge would otherwise get a gallery
   * missing the one image the card already shows.
   */
  const galleryIds = [
    ...(product.hero_media_id === null ? [] : [product.hero_media_id]),
    ...mediaEdges.map((edge) => edge.media_asset_id),
  ]
  const assetsById = await listMediaAssetsByIds(client, [...new Set(galleryIds)])
  const galleryAssets = [...new Set(galleryIds)]
    .map((id) => assetsById.get(id))
    .filter((asset): asset is NonNullable<typeof asset> => asset !== undefined)
    .filter((asset) => asset.resource_type === 'image')

  const allMaterials = await listMaterials(client)
  const materials = allMaterials.filter((material) => materialIds.includes(material.id))

  /*
   * RELATED: editor edges first, and the same-category set ONLY when there are none.
   *
   * `listRelationsForProduct` returns every edge type; only the ones pointing at a product can be
   * rendered as a card here. An edge to a journal article or a portfolio project is real and will
   * be rendered by a later phase — dropping it from THIS list is not the same as ignoring it.
   */
  const relatedProductIds = relations
    .filter((edge) => edge.target_type === 'product')
    .map((edge) => edge.target_id)

  const sameCategory =
    relatedProductIds.length === 0 && product.category_id !== null
      ? (await listProductsByCategory(client, product.category_id))
          .filter((row) => row.id !== product.id)
          .slice(0, SAME_CATEGORY_LIMIT)
      : []

  const curated =
    relatedProductIds.length === 0
      ? []
      : (
          await Promise.all(
            relatedProductIds.map(async (id) =>
              (await listProductsByCategory(client, product.category_id ?? '')).find(
                (row) => row.id === id,
              ),
            ),
          )
        ).filter((row): row is NonNullable<typeof row> => row !== undefined)

  const relatedProducts = curated.length > 0 ? curated : sameCategory
  const relatedAssets = await listMediaAssetsByIds(
    client,
    relatedProducts.map((row) => row.hero_media_id).filter((id): id is string => id !== null),
  )

  const price = presentPrice(product, chrome.strings)
  const badges = productBadges(product, chrome.strings)

  const jsonLd = productJsonLd({
    product,
    url: `${BASE}/${slug}`,
    brandName: siteString(chrome.strings, 'BRAND.brand.name'),
    category,
    imageUrls:
      cloudName === ''
        ? []
        : productImageUrls(galleryAssets[0] ?? null, galleryAssets.slice(1), (asset) =>
            imageUrl(cloudName, mediaRefOf(asset), resolveSpec('og')),
          ),
    // The same exponent the presenter divides by, so the structured price and the rendered one
    // cannot disagree about where the decimal point goes.
    formatAmount: (minor, currency) => {
      const exponent = currencyExponent(currency)
      return exponent === null ? null : (minor / 10 ** exponent).toFixed(exponent)
    },
  })

  return (
    <Container>
      <Stack gap={12}>
        {jsonLd === null ? null : (
          <script
            type="application/ld+json"
            // The value is escaped by `serialiseJsonLd`; `<` cannot close the element.
            dangerouslySetInnerHTML={{ __html: serialiseJsonLd(jsonLd) }}
          />
        )}

        <Stack gap={4}>
          {/* The one h1 on this route. */}
          <Heading level={1}>{product.title ?? product.slug}</Heading>
          {category === null ? null : (
            <Text as="p" size="sm" tone="secondary" data-product-category="">
              {category.name}
            </Text>
          )}
          {/*
            `presentPrice` returns null for a row it cannot present honestly, and null renders
            nothing — a product page with no price line, which is the correct output for a piece
            whose price is a conversation.
          */}
          {price === null ? null : (
            <Text as="p" data-price-state={price.state}>
              {[price.label, price.amount].filter((part) => part !== null).join(' ')}
            </Text>
          )}
          {badges.length === 0 ? null : (
            <Text as="p" size="sm" tone="secondary" data-product-badges="">
              {badges.join(' · ')}
            </Text>
          )}
          {product.description === null || product.description.trim() === '' ? null : (
            <Text>{product.description}</Text>
          )}
        </Stack>

        <ProductGallery assets={galleryAssets} strings={chrome.strings} cloudName={cloudName} />

        <ProductInquiryRail
          slug={product.slug}
          isCustomizable={product.is_customizable}
          strings={chrome.strings}
        />

        <ProductSpecifications
          specs={specs}
          dimensions={product.dimensions}
          strings={chrome.strings}
        />

        <ProductMaterialStory
          materials={materials}
          imagery={new Map()}
          strings={chrome.strings}
          cloudName={cloudName === '' ? null : cloudName}
        />

        <RelatedContent
          mode={curated.length > 0 ? 'curated' : 'same-category'}
          products={relatedProducts}
          assets={relatedAssets}
          categoryName={category?.name ?? null}
          strings={chrome.strings}
          cloudName={cloudName}
        />
      </Stack>
    </Container>
  )
}
