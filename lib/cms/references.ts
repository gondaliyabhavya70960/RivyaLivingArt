import 'server-only'

import {
  selectArticles,
  selectCollectionProducts,
  selectProducts,
  selectProjects,
} from '@/lib/cms/selectors'
import type { EntityCard, SelectorClient, SelectorResult } from '@/lib/cms/selectors'
import { isEnabled } from '@/lib/flags'
import type { ResolvedForm } from '@/lib/cms/forms'
import { forProduct, getPublishedBySlug } from '@/lib/supabase/repositories/customization-forms'
import { getProductForCommission } from '@/lib/supabase/repositories/products'
import {
  getCollectionIdBySlug,
  getCollectionIdForPage,
} from '@/lib/supabase/repositories/collections'
import { getProjectIdForPage, listProjectMedia } from '@/lib/supabase/repositories/portfolio'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { listMaterials } from '@/lib/supabase/repositories/materials'
import { type PublicModel, loadPublicModel } from '@/lib/supabase/repositories/models'
import type { Material, MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { collectionProductsBlock } from '@/content/blocks/collection-products'
import { commissionConfiguratorBlock } from '@/content/blocks/commission-configurator'
import { projectGalleryBlock } from '@/content/blocks/project-gallery'
import { journalStripBlock } from '@/content/blocks/journal-strip'
import { portfolioStripBlock } from '@/content/blocks/portfolio-strip'
import { selectedWorksBlock } from '@/content/blocks/selected-works'
import { threeDResinBlock } from '@/content/blocks/three-d-resin'
import { parseBlockPayload } from './registry'

/**
 * Resolving what the reference blocks refer to, before rendering starts.
 *
 * WHY NOT IN THE RENDERER. `components/sections/types.ts` states the rule and the reason:
 * a section renderer is synchronous and pure, because a renderer that fetched its own data would
 * be a round trip per section, in sequence, inside the render — and would be untestable without a
 * database and unusable in the Studio preview. Media already works this way: `loadPageMedia`
 * hydrates a whole page's assets in one step and the renderers receive them. This is the same
 * arrangement for entities.
 *
 * ONE PASS, IN PARALLEL, AND ONLY FOR THE SECTIONS THAT NEED IT. A page with no reference block
 * issues no query at all; a homepage with three issues three at once. The alternative — resolving
 * every block type in case — would query `products` on `/privacy`.
 *
 * A FAILURE HERE IS AN EMPTY BAND, NOT A DEAD PAGE. `selectProjects` answers `NOT_YET_BUILT` for a
 * table Phase 17 has not created, which is an ordinary state rather than an error, and the
 * renderer draws its seeded editorial fallback. Only a genuine query failure throws, and that is
 * `app/(site)/error.tsx`'s business.
 */

/** One reference block's answer, plus the assets its cards named. */
export type SectionReference = {
  readonly result: SelectorResult
  /** Hero assets for the cards, by `media_assets.id`. Absent where RLS hid one. */
  readonly assets: ReadonlyMap<string, MediaAsset>
  /**
   * ORDERED MEDIA, for a block that renders pictures rather than entity cards.
   *
   * `project-gallery` is the only user today, and it needed something the card shape cannot carry:
   * a gallery draws `portfolio_project_media` in the curator's order, each row with its own caption
   * and alt override, and an `EntityCard` has neither of those nor an order that means anything.
   * Squeezing it into `cards` with an empty `href` was the alternative and it would have made every
   * consumer of `cards` handle a case that is not a card.
   *
   * RESOLVED HERE FOR THE SAME REASON EVERYTHING ELSE IS: one pass, before render, so a gallery
   * does not become a round trip per photograph inside an async component.
   */
  readonly media?: readonly ProjectGalleryItem[]
  /**
   * A RESOLVED CUSTOMIZATION FORM, for the one block that mounts an interactive surface.
   *
   * `commission-configurator` needs two things a selector cannot give it: a whole form definition —
   * steps and fields, in order — and the state of a feature flag. Both are resolved here for the
   * reason everything else is: `SectionRenderer` is SYNCHRONOUS AND PURE, so a renderer that
   * fetched its own form would be a round trip inside the render and untestable without a database.
   *
   * `null` MEANS "DO NOT RENDER", and it is deliberately not distinguished from "not found". The
   * flag is off, or the named form does not exist, or it exists and is not published — three
   * different facts with one correct behaviour, and telling a visitor which of them it is would
   * publish the studio's release schedule.
   */
  readonly configurator?: ResolvedForm | null
  /**
   * Answers the configurator opens with, from `?product=<slug>`.
   *
   * FROM THE PRODUCT ROW, NEVER FROM A GUESS. The only thing pre-filled is the project type, and it
   * is read from the product's CATEGORY — a column on the row — through the fixed correspondence in
   * `PROJECT_TYPE_BY_CATEGORY`. A category with no correspondence pre-fills nothing rather than
   * choosing the nearest option, because a visitor who arrives to find the form has decided what
   * they want has been told something about their own brief that nobody checked.
   */
  readonly prefill?: Readonly<Record<string, string>>
  /**
   * Phase 21: the model a `three-d-resin` band's slot names, with the published materials its
   * labels may cite. `null` when the slot is empty, the flag is off, or the model is not public —
   * the renderer then draws its scene imagery as before.
   */
  readonly model?: ModelReference | null
}

export type ModelReference = {
  readonly model: PublicModel
  readonly materials: readonly Material[]
}

/** One picture in a project gallery: the asset, plus what the editor said about it HERE. */
export type ProjectGalleryItem = {
  readonly asset: MediaAsset
  readonly caption: string | null
  readonly altOverride: string | null
}

/** By `page_sections.id`. A section with no entry here is not a reference block. */
export type PageReferences = ReadonlyMap<string, SectionReference>

/**
 * Which selector answers which block, and how many cards it is asked for.
 *
 * KEYED BY BLOCK TYPE so that adding a fourth reference block is one entry here plus a renderer,
 * and so that `renderCmsPage` never learns the names of any of them.
 */
const SELECTORS = {
  'selected-works': {
    select: selectProducts,
    limit: (section: PageSection) => parseBlockPayload(selectedWorksBlock, section.payload).limit,
    categorySlug: (section: PageSection) =>
      parseBlockPayload(selectedWorksBlock, section.payload).category_slug,
  },
  'portfolio-strip': {
    select: selectProjects,
    limit: (section: PageSection) => parseBlockPayload(portfolioStripBlock, section.payload).limit,
    categorySlug: () => null,
  },
  'journal-strip': {
    select: selectArticles,
    limit: (section: PageSection) => parseBlockPayload(journalStripBlock, section.payload).limit,
    categorySlug: (section: PageSection) =>
      parseBlockPayload(journalStripBlock, section.payload).category_slug,
  },
  /**
   * The one entry whose narrowing costs a query, which is why `collectionId` exists at all.
   *
   * A slug in the payload is looked up; an empty one means "the collection this page belongs to"
   * and is answered from `collections.page_id`. Both resolve to an id BEFORE the selector runs, so
   * `selectCollectionProducts` stays a single read and the two readings differ in one line here
   * rather than in a branch inside the selector.
   */
  'collection-products': {
    select: selectCollectionProducts,
    limit: (section: PageSection) =>
      parseBlockPayload(collectionProductsBlock, section.payload).limit,
    categorySlug: () => null,
    collectionId: async (client: SelectorClient, section: PageSection, pageId: string) => {
      const slug = parseBlockPayload(collectionProductsBlock, section.payload).collection_slug
      const named = slug?.trim() ?? ''
      return named === ''
        ? getCollectionIdForPage(client, pageId)
        : getCollectionIdBySlug(client, named)
    },
  },
} as const

export type ReferenceBlockType = keyof typeof SELECTORS

export function isReferenceBlock(blockType: string): blockType is ReferenceBlockType {
  return Object.hasOwn(SELECTORS, blockType)
}

/**
 * `pageId` IS REQUIRED, NOT OPTIONAL, AND THAT IS THE POINT. A `collection-products` band with no
 * slug means "the collection this page belongs to", so the page is part of the question rather
 * than context — and a call site that did not have one would silently render every exhibition
 * band empty. Making it optional would have made that a runtime surprise instead of a compile
 * error at every call site.
 */
export async function loadPageReferences(
  client: SelectorClient,
  sections: readonly PageSection[],
  pageId: string,
  /**
   * `?product=<slug>`, when the route read one.
   *
   * OPTIONAL, AND ONLY ONE ROUTE PASSES IT. Reading a search parameter opts a Server Component out
   * of static rendering, so `/custom-commissions` is dynamic and the other twelve CMS routes are
   * not — which is why this arrives as an argument rather than being read here from `headers()`.
   */
  productSlug: string | null = null,
): Promise<PageReferences> {
  const referencing = sections.filter(
    (section) => isReferenceBlock(section.block_type) || section.block_type === MODEL_SLOT_BLOCK,
  )
  if (referencing.length === 0) return new Map()

  const resolved = await Promise.all(
    referencing.map(async (section) => {
      if (section.block_type === MODEL_SLOT_BLOCK) {
        return [section.id, await loadModelSlot(client, section)] as const
      }
      const config: {
        select: (typeof SELECTORS)[ReferenceBlockType]['select']
        limit: (section: PageSection) => number
        categorySlug: (section: PageSection) => string | null
        collectionId?: (
          client: SelectorClient,
          section: PageSection,
          pageId: string,
        ) => Promise<string | null>
      } = SELECTORS[section.block_type as ReferenceBlockType]

      /*
       * THE GALLERY IS NOT A SELECTOR, so it is answered here rather than through `SELECTORS`.
       * A selector returns cards for entities that may not exist; this returns the pictures of one
       * project, in the order its curator arranged them, and there is no card in it.
       */
      if (section.block_type === 'project-gallery') {
        return [section.id, await loadProjectGallery(client, section, pageId)] as const
      }

      /*
       * NOR IS THE CONFIGURATOR, and for a different reason again: it returns no entities at all.
       * What it resolves is a FORM DEFINITION and a feature flag, both of which the renderer must
       * have before it draws anything and neither of which a card-shaped selector can express.
       */
      if (section.block_type === 'commission-configurator') {
        return [section.id, await loadConfigurator(client, section, productSlug)] as const
      }

      const result = await config.select(client, {
        limit: config.limit(section),
        categorySlug: config.categorySlug(section),
        collectionId: await config.collectionId?.(client, section, pageId),
      })

      // One media query per block rather than one per card. With no cards it issues none at all,
      // because `listMediaAssetsByIds` short-circuits an empty list.
      const mediaIds = result.cards
        .map((card: EntityCard) => card.mediaId)
        .filter((id): id is string => id !== null)
      const assets = await listMediaAssetsByIds(client, mediaIds)

      return [section.id, { result, assets }] as const
    }),
  )

  return new Map(resolved)
}

/**
 * The form a `commission-configurator` band mounts, or null.
 *
 * THE FLAG IS CHECKED FIRST AND THE FORM IS NOT LOADED IF IT IS OFF. Not an optimisation: a
 * switched-off feature should cost nothing and, more to the point, should leave no trace in the
 * query log of a page that does not render it.
 *
 * THE READ GOES THROUGH THE PAGE'S OWN CLIENT, so RLS decides what is visible. A draft form
 * resolves to null for a visitor and to the real thing in a Studio preview, which is exactly the
 * behaviour a preview needs and exactly the behaviour a public page must not have.
 */
/**
 * The seven seeded categories, mapped onto SEED §15's nine starting points.
 *
 * BOTH VOCABULARIES ARE FIXED AND SEEDED, so this is a stated correspondence rather than an
 * inference — which is what lets `?product=` pre-fill a project type without guessing. The values
 * are the option values the commissions seed derives from §15's labels; a category absent from this
 * map pre-fills nothing, and three of the seven are absent on purpose: `decor`, `gifts` and
 * `collectible-design` have no §15 starting point of their own, and answering "Other" on a
 * visitor's behalf tells them their brief is a leftover.
 */
const PROJECT_TYPE_BY_CATEGORY: Readonly<Record<string, string>> = {
  furniture: 'custom_furniture',
  'wall-statement-art': 'wall_statement_art',
  preservation: 'preservation_piece',
  '3d-resin': '3d_resin_concept',
}

async function loadConfigurator(
  client: SelectorClient,
  section: PageSection,
  productSlug: string | null,
): Promise<SectionReference> {
  const empty = { result: EMPTY_GALLERY, assets: new Map<string, MediaAsset>(), configurator: null }
  if (!(await isEnabled('commission_configurator'))) return empty

  /*
   * A PRODUCT IN THE URL OVERRULES THE BLOCK'S OWN SLUG, and that is the right precedence. The
   * payload says which form this PAGE mounts by default; `?product=` says which piece the visitor
   * was looking at when they pressed "Customize This Piece", and a preservation keepsake must not
   * open the furniture brief because the page's default said so. A product with no binding falls
   * back to the page's form rather than to nothing: the visitor still gets to ask.
   */
  const bound = productSlug === null ? null : await formForProductSlug(client, productSlug)

  if (bound !== null) return { ...empty, ...bound }

  const slug = parseBlockPayload(commissionConfiguratorBlock, section.payload).formSlug.trim()
  if (slug === '') return empty

  return { ...empty, configurator: await getPublishedBySlug(client, slug) }
}

/** The form bound to a product, plus what its row lets us pre-fill. Null when the slug resolves to nothing. */
async function formForProductSlug(
  client: SelectorClient,
  productSlug: string,
): Promise<{ configurator: ResolvedForm; prefill: Record<string, string> } | null> {
  const product = await getProductForCommission(client, productSlug)
  if (product === null) return null

  const form = await forProduct(client, product.id, product.categoryId)
  if (form === null) return null

  const projectType =
    product.categorySlug === null ? undefined : PROJECT_TYPE_BY_CATEGORY[product.categorySlug]

  return {
    configurator: form,
    prefill: projectType === undefined ? {} : { project_type: projectType },
  }
}

/**
 * A project's gallery, for the page it belongs to.
 *
 * NOTHING AT ALL WHEN THE PAGE BELONGS TO NO PROJECT, which is every page but a project's own
 * story. The block declares `allowedPages: ['/portfolio/[slug]']` so Studio will not offer it
 * elsewhere; this is the other half of that, for a row that got there some other way.
 *
 * RLS DOES THE FILTERING TWICE OVER AND NEITHER IS RESTATED HERE: `portfolio_project_media` is
 * readable only when its parent project is published, and `media_assets` has its own policy on top,
 * so a picture attached to an unannounced project resolves to nothing for a visitor. An asset the
 * policy hid is DROPPED rather than rendered as a gap.
 */
async function loadProjectGallery(
  client: SelectorClient,
  section: PageSection,
  pageId: string,
): Promise<SectionReference> {
  const payload = parseBlockPayload(projectGalleryBlock, section.payload)
  const projectId = await getProjectIdForPage(client, pageId)
  if (projectId === null) return { result: EMPTY_GALLERY, assets: new Map(), media: [] }

  const wanted = new Set<string>(payload.roles)
  const rows = (await listProjectMedia(client, projectId))
    .filter((row) => wanted.has(row.role))
    .slice(0, payload.limit)

  const assets = await listMediaAssetsByIds(
    client,
    rows.map((row) => row.media_asset_id),
  )

  const media = rows.flatMap((row) => {
    const asset = assets.get(row.media_asset_id)
    return asset === undefined
      ? []
      : [{ asset, caption: row.caption, altOverride: row.alt_override }]
  })

  return { result: media.length === 0 ? EMPTY_GALLERY : OK_GALLERY, assets, media }
}

/** A gallery has no cards; `reason` still travels, so `data-empty-reason` reads the same as elsewhere. */
const EMPTY_GALLERY: SelectorResult = { cards: [], reason: 'EMPTY' }
const OK_GALLERY: SelectorResult = { cards: [], reason: 'OK' }

// --- Phase 21: the three-d-resin model slot ---------------------------------------------------------

const MODEL_SLOT_BLOCK = 'three-d-resin'

/**
 * The model a `three-d-resin` band mounts, or nothing.
 *
 * THREE GATES, ALL HERE. The flag (`three_d_viewer`), the slot (`payload.model_media_id`), and the
 * public read (`loadPublicModel`, which returns null for a model that is not PUBLISHED, has no
 * PUBLISHED poster, or does not exist). Any of the three failing yields `model: null`, and the
 * renderer draws the band's own imagery as it always has — the same "no empty slot" rule every
 * mount point follows.
 */
async function loadModelSlot(
  client: SelectorClient,
  section: PageSection,
): Promise<SectionReference> {
  const empty: SectionReference = { result: EMPTY_GALLERY, assets: new Map(), model: null }
  const modelId = parseBlockPayload(threeDResinBlock, section.payload).model_media_id
  if (modelId === null) return empty
  if (!(await isEnabled('three_d_viewer'))) return empty
  const model = await loadPublicModel(client, modelId)
  if (model === null) return empty
  const materials = await listMaterials(client)
  return { ...empty, result: OK_GALLERY, model: { model, materials } }
}
