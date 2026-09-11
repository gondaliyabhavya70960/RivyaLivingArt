import 'server-only'

import * as React from 'react'

import { FilterRail } from '@/components/patterns/FilterRail'
import { Pagination } from '@/components/patterns/Pagination'
import { ProductCard } from '@/components/patterns/ProductCard'
import { SortSelect } from '@/components/patterns/SortSelect'
import { Grid } from '@/components/primitives/Grid'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { TextLink } from '@/components/primitives/TextLink'
import { catalogUrl } from '@/lib/catalog/query'
import { optionalEnv } from '@/lib/env'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { listCollections } from '@/lib/supabase/repositories/collections'
import {
  catalogFacetCounts,
  listCatalogProducts,
} from '@/lib/supabase/repositories/catalog-listing'
import { listMaterials } from '@/lib/supabase/repositories/materials'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { siteString } from '@/lib/cms/strings'

import { CATALOG_ACTION_KEYS, CATALOG_EMPTY_KEYS, CATALOG_UI_KEYS } from './labels'
import { buildFilterGroups, type RailEntity } from './rail'
import {
  PAGE_SIZE,
  canonicalCatalogUrl,
  hasActiveFilters,
  parseCatalogQuery,
  type RawSearchParams,
} from './query'

/**
 * The listing, assembled once and used by both catalogue routes.
 *
 * WHY A FUNCTION RATHER THAN A PATTERN COMPONENT. Everything here is composition and data loading:
 * four registered patterns, two repository reads and the two lookup tables the rail needs. A fifth
 * pattern wrapping them would add a registry row that describes no new behaviour, and would still
 * need every one of these arguments passed through it.
 *
 * TWO EMPTY STATES, AND THE DIFFERENCE MATTERS. "This collection is being prepared" (SEED §27) is
 * true of a category with nothing published in it; it is FALSE of a category full of pieces none
 * of which match the filters a visitor just applied, and telling them a collection is unfinished
 * when it is in fact one checkbox away is how someone leaves. So the filtered case says the
 * filters matched nothing and offers the way back, and the unfiltered case says the collection is
 * being prepared — which, with zero products in the database, is what every category says today.
 *
 * NOTHING HERE FABRICATES A PRODUCT. There is no placeholder card, no skeleton row standing in for
 * inventory, no "example" piece. An empty catalogue renders as an empty catalogue.
 */

export interface CatalogListingOptions {
  /** The path this listing lives at, with no query string. Used for every link and the form. */
  readonly basePath: string
  /** Restricts the listing to one category. Null lists across all of them. */
  readonly categoryId?: string | null
  readonly searchParams: RawSearchParams
  /** Category names by id, so a cross-category listing can label each card. */
  readonly categoryNames?: ReadonlyMap<string, string>
}

function railEntities(
  rows: readonly { id: string; slug: string; name: string }[],
): readonly RailEntity[] {
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name }))
}

/**
 * Load everything the listing needs.
 *
 * FIVE READS, FOUR OF THEM IN PARALLEL. The rows and the facet counts are the two the phase
 * specifies; materials and collections are the rail's lookup tables, and the hero assets can only
 * be asked for once the rows are known, so that one is sequential by necessity rather than by
 * accident.
 */
export async function loadCatalogListing({
  basePath,
  categoryId = null,
  searchParams,
}: CatalogListingOptions) {
  const parsed = parseCatalogQuery(searchParams)
  const client = createPublicClient()

  const [materials, collections, chrome] = await Promise.all([
    listMaterials(client),
    listCollections(client),
    getSiteChrome(),
  ])

  /*
   * THE URL CARRIES SLUGS; THE DATABASE JOINS ON IDS.
   *
   * A slug that PARSES but names no visible row — `?material=teak` when there is no published teak
   * — is the same kind of thing as `?sort=price`: a value this listing cannot honour. It is
   * dropped here for the same reason and with the same consequence: it filters nothing, and the
   * canonical URL is emitted WITHOUT it, so a mistyped material cannot mint an indexable variant
   * of a page identical to the unfiltered one. `parseCatalogQuery` could not have caught it — only
   * the database knows which slugs exist — so the query is narrowed once they are known.
   */
  const resolved = (
    entities: readonly RailEntity[],
    slugs: readonly string[],
  ): { slugs: string[]; ids: string[] } => {
    const kept: string[] = []
    const ids: string[] = []
    for (const slug of slugs) {
      const match = entities.find((entity) => entity.slug === slug)
      if (match === undefined) continue
      kept.push(slug)
      ids.push(match.id)
    }
    return { slugs: kept, ids }
  }

  const materialEntities = railEntities(materials)
  const collectionEntities = railEntities(collections)
  const material = resolved(materialEntities, parsed.material)
  const collection = resolved(collectionEntities, parsed.collection)

  const query = { ...parsed, material: material.slugs, collection: collection.slugs }
  const filters = { categoryId, materialIds: material.ids, collectionIds: collection.ids }

  const [listing, facets] = await Promise.all([
    listCatalogProducts(client, query, filters),
    catalogFacetCounts(client, query, filters),
  ])

  // `listMediaAssetsByIds` de-duplicates and short-circuits on an empty list, and returns the map
  // this render needs directly — a card looks its own hero up by id rather than scanning an array.
  const assetsById = await listMediaAssetsByIds(
    client,
    listing.rows.map((row) => row.hero_media_id).filter((id): id is string => id !== null),
  )

  /*
   * THE TOTAL COMES FROM THE FACET QUERY, not from a second count on the rows query. The two run
   * the same predicate, so one number serves both — and taking it from one place is what stops the
   * grid and the pagination disagreeing about how many results there are.
   */
  const pageCount = Math.max(1, Math.ceil(facets.total / PAGE_SIZE))

  return {
    query,
    listing,
    facets,
    chrome,
    total: facets.total,
    page: parsed.page,
    pageCount,
    /** True when the requested page has no rows because it lies past the last one. */
    beyondEnd: listing.beyondEnd || (parsed.page > pageCount && parsed.page > 1),
    assetsById,
    materials: materialEntities,
    collections: collectionEntities,
    canonical: canonicalCatalogUrl(basePath, query),
  }
}

export type LoadedCatalogListing = Awaited<ReturnType<typeof loadCatalogListing>>

export function CatalogListing({
  basePath,
  loaded,
  categoryNames,
}: {
  readonly basePath: string
  readonly loaded: LoadedCatalogListing
  readonly categoryNames?: ReadonlyMap<string, string>
}): React.ReactElement {
  const { query, listing, facets, chrome, assetsById, materials, collections, page, pageCount } =
    loaded
  const strings = chrome.strings
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''

  const groups = buildFilterGroups({ query, facets, materials, collections, strings })
  const filtered = hasActiveFilters(query)
  const emptyMessage = siteString(
    strings,
    filtered ? CATALOG_EMPTY_KEYS.noResults : CATALOG_EMPTY_KEYS.collection,
  )
  const clear = siteString(strings, CATALOG_ACTION_KEYS.clear)
  const gridName = siteString(strings, CATALOG_UI_KEYS.results)

  const skipToFilters = siteString(strings, 'ACTION_LABEL.skip_to_filters')
  const skipToResults = siteString(strings, 'ACTION_LABEL.skip_to_results')

  return (
    <div className="mx-auto grid max-w-(--rv-container-wide) gap-10 px-(--rv-gutter) py-12 lg:grid-cols-[16rem_1fr]">
      {/*
       * PHASE 41: TWO SKIP LINKS, BECAUSE THE SHELL'S "SKIP TO CONTENT" LANDS INSIDE THE PROBLEM.
       *
       * `<main>` begins above the filter rail, so a keyboard user who takes the shell's skip link
       * arrives at the top of a listing and still has twenty filter controls between them and the
       * first product — on every category page, every time. These two point past each block rather
       * than at a landmark, which is the distinction WCAG 2.2 §2.4.1 is actually about.
       *
       * Visually hidden until focused, like the shell's: in the accessibility tree and the tab order
       * at all times, on screen only while in use. A link that is `display: none` until focus can
       * never receive focus.
       */}
      <div className="col-span-full">
        {skipToFilters === null ? null : (
          <a
            href="#catalog-filters"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-sm focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-ink"
          >
            {skipToFilters}
          </a>
        )}
        {skipToResults === null ? null : (
          <a
            href="#catalog-results"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-sm focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-ink"
          >
            {skipToResults}
          </a>
        )}
      </div>

      {/* `tabIndex={-1}` so the jump moves FOCUS and not only the viewport: without it the next Tab
          press returns to the top of the document, which is where the visitor just escaped from. */}
      <div id="catalog-filters" tabIndex={-1}>
        <FilterRail
          basePath={basePath}
          query={query}
          groups={groups}
          strings={strings}
          clearHref={basePath}
        />
      </div>

      <Stack gap={8} id="catalog-results" tabIndex={-1}>
        <SortSelect basePath={basePath} query={query} strings={strings} />

        {listing.rows.length === 0 ? (
          <Stack gap={3} data-catalog-empty={filtered ? 'filtered' : 'collection'}>
            {emptyMessage === null ? null : <Text size="lg">{emptyMessage}</Text>}
            {filtered && clear !== null ? (
              <TextLink href={basePath} data-clear-filters="">
                {clear}
              </TextLink>
            ) : null}
          </Stack>
        ) : (
          <Grid
            gap={8}
            className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            {...(gridName === null ? {} : { role: 'list', 'aria-label': gridName })}
          >
            {listing.rows.map((product) => (
              <div key={product.id} {...(gridName === null ? {} : { role: 'listitem' })}>
                <ProductCard
                  product={product}
                  asset={
                    product.hero_media_id === null
                      ? null
                      : (assetsById.get(product.hero_media_id) ?? null)
                  }
                  categoryName={
                    product.category_id === null
                      ? null
                      : (categoryNames?.get(product.category_id) ?? null)
                  }
                  strings={strings}
                  cloudName={cloudName}
                />
              </div>
            ))}
          </Grid>
        )}

        <Pagination
          hrefFor={(n) => catalogUrl(basePath, query, { page: n })}
          page={page}
          pageCount={pageCount}
          labels={{
            region: siteString(strings, CATALOG_UI_KEYS.pagination),
            previous: siteString(strings, CATALOG_ACTION_KEYS.previous),
            next: siteString(strings, CATALOG_ACTION_KEYS.next),
            position: siteString(strings, CATALOG_UI_KEYS.paginationPosition),
          }}
        />
      </Stack>
    </div>
  )
}
