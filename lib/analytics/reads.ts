/**
 * What the metric registry is allowed to know — Phase 37.
 *
 * EVERY METRIC COMPUTES FROM THIS INTERFACE AND NOTHING ELSE. The production implementation is
 * `createAnalyticsReads()` in `lib/supabase/repositories/analytics.ts`, the one place a query may
 * live; the tests implement it in memory, which is how `analytics-no-fabrication.test.ts` runs
 * the whole registry against an empty database without a database. A metric that wanted a
 * figure this interface cannot supply would have to add a read here, in the open, rather than
 * reach for a table on its own.
 *
 * THE FACTS ARE SLIM ON PURPOSE. An enquiry fact carries kind, status, WhatsApp state, a date and
 * a path — never a name, a phone number or a message. The analytics tab summarises; it does not
 * need, and must not hold, a person.
 */

export interface ProductFacts {
  readonly id: string
  readonly status: string
  readonly categoryId: string | null
  readonly isLargeFormat: boolean
  /** `products.dimensions` as stored; parsed by the metric with `lib/catalog/dimensions.ts`. */
  readonly dimensions: unknown
  readonly heroMediaId: string | null
  readonly createdAt: string
  /** `publication_readiness.unmet_required.length`, or null when nothing has been computed. */
  readonly unmetRequired: number | null
}

export interface CategoryFacts {
  readonly id: string
  readonly slug: string
}

export interface CollectionFacts {
  readonly id: string
  readonly status: string
}

export interface ProductCollectionLink {
  readonly productId: string
  readonly collectionId: string
}

export interface InquiryFacts {
  readonly kind: string
  readonly pipelineStatus: string
  readonly whatsappState: string
  readonly createdAt: string
  readonly sourcePath: string | null
}

export interface PageFacts {
  readonly id: string
  readonly kind: string
  readonly status: string
  readonly updatedAt: string
}

export interface SectionFacts {
  readonly pageId: string
  readonly hasDesktopMedia: boolean
  readonly hasMobileMedia: boolean
}

export interface MediaFacts {
  readonly id: string
  readonly isConcept: boolean
  readonly altText: string
}

export interface SourceFacts {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly isEnabled: boolean
  readonly adapterKey: string
  /** The attribute keys `research_sources.attribute_extraction` is configured to pull. */
  readonly attributeKeys: readonly string[]
}

export interface AdapterFacts {
  readonly key: string
  readonly capabilities: readonly string[]
}

export interface SourceHealthFacts {
  readonly sourceId: string
  readonly health: string
  readonly lastRunAt: string | null
  readonly lastRunStatus: string | null
  readonly successRate7d: number | null
  readonly queueDepth: number
}

export type CorpusFamily = 'ASSORTMENT' | 'PRICE_ARCHITECTURE' | 'DIMENSIONS'

export interface CorpusSnapshotFacts {
  readonly family: CorpusFamily
  readonly currency: string | null
  readonly computedAt: string
  /** The Phase 31 result object as stored; each metric reads the fields it names. */
  readonly result: Readonly<Record<string, unknown>>
  readonly coverage: readonly { readonly n: number; readonly denominator: number }[]
}

export interface ScoreFacts {
  readonly score: number | null
  readonly state: 'SCORED' | 'INSUFFICIENT_DATA'
  readonly categoryId: string | null
}

export interface AnalyticsReads {
  products(): Promise<readonly ProductFacts[]>
  categories(): Promise<readonly CategoryFacts[]>
  collections(): Promise<readonly CollectionFacts[]>
  productCollections(): Promise<readonly ProductCollectionLink[]>
  /** product id → number of `product_media` rows. */
  productMediaCounts(): Promise<ReadonlyMap<string, number>>
  inquiries(): Promise<readonly InquiryFacts[]>
  pages(): Promise<readonly PageFacts[]>
  sections(): Promise<readonly SectionFacts[]>
  media(): Promise<readonly MediaFacts[]>
  /** Every media id referenced by a product, a section, a collection or a slot binding. */
  mediaUsedIds(): Promise<ReadonlySet<string>>
  sources(): Promise<readonly SourceFacts[]>
  adapters(): Promise<readonly AdapterFacts[]>
  sourceHealth(): Promise<readonly SourceHealthFacts[]>
  /** source id → research products captured. */
  researchProductCountsBySource(): Promise<ReadonlyMap<string, number>>
  successfulRunsSince(since: Date): Promise<number>
  latestCorpusSnapshots(family: CorpusFamily): Promise<readonly CorpusSnapshotFacts[]>
  /** One entry per research row: its normalised material tokens. */
  materialTokens(): Promise<readonly (readonly string[])[]>
  activeModel(): Promise<{ readonly id: string; readonly version: string } | null>
  latestScores(modelId: string): Promise<readonly ScoreFacts[]>
}

/**
 * The empty database, as reads. What every metric is run against by the no-fabrication test,
 * and what a metric sees on a fresh deployment: no product, no enquiry, no source, no snapshot.
 */
export function emptyAnalyticsReads(): AnalyticsReads {
  return {
    products: async () => [],
    categories: async () => [],
    collections: async () => [],
    productCollections: async () => [],
    productMediaCounts: async () => new Map(),
    inquiries: async () => [],
    pages: async () => [],
    sections: async () => [],
    media: async () => [],
    mediaUsedIds: async () => new Set(),
    sources: async () => [],
    adapters: async () => [],
    sourceHealth: async () => [],
    researchProductCountsBySource: async () => new Map(),
    successfulRunsSince: async () => 0,
    latestCorpusSnapshots: async () => [],
    materialTokens: async () => [],
    activeModel: async () => null,
    latestScores: async () => [],
  }
}
