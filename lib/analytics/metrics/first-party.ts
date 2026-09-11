import { dimensionEntries } from '@/lib/catalog/dimensions'
import { SAMPLE_FLOOR } from '@/lib/scraper/analytics/coverage'

import {
  available,
  bandLabel,
  daysBetween,
  isoWeekLabel,
  median,
  percent,
  tally,
  topN,
  unavailable,
  withinDays,
} from './shared'
import type { MetricModule } from './types'

/**
 * The eight first-party metrics — Phase 37, FEAT §28's first line.
 *
 * EVERY ONE READS ZERO WHEN THE CATALOGUE IS EMPTY, and says so with `n = 0` rather than with a
 * placeholder. The two that cannot honestly produce a share with nothing underneath
 * (`large_format_share`, `inquiry_trends`) say why instead. `product_scale` has the one floor the
 * phase document sets — five products with dimensions — and suppresses percentiles below Phase 31's
 * sample floor of twelve, because a p90 over seven numbers is a number with no meaning.
 */

const PUBLISHED = 'PUBLISHED'
const SCALE_FLOOR = 5
const SCALE_EDGES = [600, 1200, 1800, 2400] as const

export const catalog: MetricModule = {
  id: 'catalog',
  labelKey: 'studio.analytics.metric.catalog',
  dimension: 'FIRST_PARTY',
  definition:
    'Products by status, by readiness band and by age: how many exist, how many are published, and how many were created in the last 30 and 90 days. Reads zero when the catalogue is empty.',
  coverage: 'n = products counted; denominator = products in the catalogue (every status).',
  requires: { tables: ['products'] },
  availableFrom: 14,
  async compute({ reads, now }) {
    const products = await reads.products()
    const byStatus = tally(products, (product) => product.status)
    const readiness = tally(products, (product) =>
      product.unmetRequired === null
        ? 'not assessed'
        : product.unmetRequired === 0
          ? 'ready to publish'
          : product.unmetRequired <= 2
            ? 'nearly ready'
            : 'not ready',
    )
    const last30 = products.filter((product) => withinDays(product.createdAt, now, 30)).length
    const last90 = products.filter((product) => withinDays(product.createdAt, now, 90)).length
    return available(products.length, products.length, {
      figure: products.length,
      unit: 'count',
      groups: byStatus,
      series: readiness,
      detail: { created_last_30_days: last30, created_last_90_days: last90 },
    })
  },
}

export const productCategories: MetricModule = {
  id: 'product_categories',
  labelKey: 'studio.analytics.metric.product_categories',
  dimension: 'FIRST_PARTY',
  definition:
    "Published products per category and each category's share of the published catalogue.",
  coverage: 'n = published products with a category; denominator = published products.',
  requires: { tables: ['products', 'categories'] },
  availableFrom: 14,
  async compute({ reads }) {
    const [products, categories] = await Promise.all([reads.products(), reads.categories()])
    const slugs = new Map(categories.map((category) => [category.id, category.slug]))
    const published = products.filter((product) => product.status === PUBLISHED)
    const counted = tally(published, (product) =>
      product.categoryId === null ? null : (slugs.get(product.categoryId) ?? null),
    )
    const n = counted.reduce((total, datum) => total + datum.value, 0)
    return available(n, published.length, {
      figure: counted.length,
      unit: 'count',
      series: counted.map((datum) => ({ ...datum })),
      groups: counted.map((datum) => ({
        label: datum.label,
        value: percent(datum.value, published.length),
      })),
    })
  },
}

export const productScale: MetricModule = {
  id: 'product_scale',
  labelKey: 'studio.analytics.metric.product_scale',
  dimension: 'FIRST_PARTY',
  definition:
    'The longest declared axis of every product with recorded dimensions, in bands. Needs at least five products with dimensions; percentiles are shown only from twelve.',
  coverage: 'n = products with at least one linear dimension; denominator = products.',
  requires: { tables: ['products'] },
  availableFrom: 14,
  async compute({ reads }) {
    const products = await reads.products()
    const longest = products
      .map((product) =>
        dimensionEntries(product.dimensions)
          .filter((entry) => entry.unit === 'mm')
          .reduce((max, entry) => Math.max(max, entry.value), 0),
      )
      .filter((value) => value > 0)
    if (longest.length === 0) {
      return unavailable('no product dimensions recorded', 0, products.length)
    }
    if (longest.length < SCALE_FLOOR) {
      return unavailable(
        `fewer than ${String(SCALE_FLOOR)} products with dimensions (${String(longest.length)} recorded)`,
        longest.length,
        products.length,
      )
    }
    const bands = tally(longest, (value) => bandLabel(value, SCALE_EDGES, 'mm'))
    const sorted = [...longest].sort((a, b) => a - b)
    const enough = sorted.length >= SAMPLE_FLOOR
    const at = (q: number): number | null =>
      enough ? (sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? null) : null
    return available(longest.length, products.length, {
      figure: median(longest),
      unit: 'mm',
      series: bands,
      notes: enough
        ? []
        : [`percentiles suppressed below the sample floor of ${String(SAMPLE_FLOOR)}`],
      detail: { p10_mm: at(0.1), p90_mm: at(0.9), sample_floor: SAMPLE_FLOOR },
    })
  },
}

export const largeFormatShare: MetricModule = {
  id: 'large_format_share',
  labelKey: 'studio.analytics.metric.large_format_share',
  dimension: 'FIRST_PARTY',
  definition:
    'The share of published products flagged large-format. Needs at least one published product.',
  coverage: 'n = published large-format products; denominator = published products.',
  requires: { tables: ['products'] },
  availableFrom: 30,
  async compute({ reads }) {
    const published = (await reads.products()).filter((product) => product.status === PUBLISHED)
    if (published.length === 0) return unavailable('no published product', 0, 0)
    const large = published.filter((product) => product.isLargeFormat).length
    return available(large, published.length, {
      figure: percent(large, published.length),
      unit: 'percent',
      groups: [
        { label: 'large-format', value: large },
        { label: 'other', value: published.length - large },
      ],
    })
  },
}

export const collectionMix: MetricModule = {
  id: 'collection_mix',
  labelKey: 'studio.analytics.metric.collection_mix',
  dimension: 'FIRST_PARTY',
  definition:
    'Published collections, published products per collection, and published products assigned to no collection.',
  coverage: 'n = published products in at least one collection; denominator = published products.',
  requires: { tables: ['products', 'collections', 'product_collections'] },
  availableFrom: 16,
  async compute({ reads }) {
    const [products, collections, links] = await Promise.all([
      reads.products(),
      reads.collections(),
      reads.productCollections(),
    ])
    const published = products.filter((product) => product.status === PUBLISHED)
    const publishedIds = new Set(published.map((product) => product.id))
    const publishedCollections = collections.filter((collection) => collection.status === PUBLISHED)
    const perCollection = new Map<string, number>(
      publishedCollections.map((collection) => [collection.id, 0]),
    )
    const assigned = new Set<string>()
    for (const link of links) {
      if (!publishedIds.has(link.productId) || !perCollection.has(link.collectionId)) continue
      perCollection.set(link.collectionId, (perCollection.get(link.collectionId) ?? 0) + 1)
      assigned.add(link.productId)
    }
    return available(assigned.size, published.length, {
      figure: publishedCollections.length,
      unit: 'count',
      series: [...perCollection.entries()].map(([label, value]) => ({ label, value })),
      detail: { unassigned_published_products: published.length - assigned.size },
    })
  },
}

export const inquiryTrends: MetricModule = {
  id: 'inquiry_trends',
  labelKey: 'studio.analytics.metric.inquiry_trends',
  dimension: 'FIRST_PARTY',
  definition:
    'Enquiries per week over the last twelve weeks, by kind and by pipeline status, and the share that reached the WhatsApp handoff. Needs at least one enquiry.',
  coverage: 'n = enquiries in the last twelve weeks; denominator = enquiries ever recorded.',
  requires: { tables: ['inquiries'] },
  availableFrom: 20,
  async compute({ reads, now }) {
    const inquiries = await reads.inquiries()
    if (inquiries.length === 0) return unavailable('no enquiry recorded', 0, 0)
    const recent = inquiries.filter((inquiry) => withinDays(inquiry.createdAt, now, 84))
    const handedOff = recent.filter(
      (inquiry) => inquiry.whatsappState === 'REDIRECTED' || inquiry.whatsappState === 'SHORTENED',
    ).length
    const weeks = tally(recent, (inquiry) => isoWeekLabel(inquiry.createdAt)).sort((a, b) =>
      a.label.localeCompare(b.label),
    )
    return available(recent.length, inquiries.length, {
      figure: recent.length,
      unit: 'count',
      series: weeks,
      groups: [
        ...tally(recent, (inquiry) => `kind: ${inquiry.kind}`),
        ...tally(recent, (inquiry) => `status: ${inquiry.pipelineStatus}`),
      ],
      detail: { whatsapp_handoff_percent: percent(handedOff, recent.length) },
    })
  },
}

export const contentPerformance: MetricModule = {
  id: 'content_performance',
  labelKey: 'studio.analytics.metric.content_performance',
  dimension: 'FIRST_PARTY',
  definition:
    'Database-derived content health, not traffic: published versus draft pages, sections per page, days since each page was updated, and enquiries attributed to a page path. No web-analytics provider is connected.',
  coverage: 'n = published pages; denominator = pages (system pages excluded).',
  requires: { tables: ['pages', 'page_sections', 'inquiries'] },
  availableFrom: 8,
  async compute({ reads, now }) {
    const [pages, sections, inquiries] = await Promise.all([
      reads.pages(),
      reads.sections(),
      reads.inquiries(),
    ])
    const sitePages = pages.filter((page) => page.kind !== 'SYSTEM')
    const published = sitePages.filter((page) => page.status === PUBLISHED)
    const sectionsPerPage = new Map<string, number>()
    for (const section of sections) {
      sectionsPerPage.set(section.pageId, (sectionsPerPage.get(section.pageId) ?? 0) + 1)
    }
    const perPage = sitePages.map((page) => sectionsPerPage.get(page.id) ?? 0)
    const staleness = sitePages.map((page) => daysBetween(page.updatedAt, now))
    const attributed = topN(
      tally(inquiries, (inquiry) => inquiry.sourcePath),
      5,
    )
    return available(published.length, sitePages.length, {
      figure: published.length,
      unit: 'count',
      groups: tally(sitePages, (page) => page.status),
      series: attributed,
      notes: ['traffic analytics are not connected; these figures are read from the database'],
      detail: {
        sections_per_page_median: median(perPage),
        days_since_update_median: median(staleness),
        inquiries_with_a_source_path: inquiries.filter((inquiry) => inquiry.sourcePath !== null)
          .length,
      },
    })
  },
}

export const mediaCoverage: MetricModule = {
  id: 'media_coverage',
  labelKey: 'studio.analytics.metric.media_coverage',
  dimension: 'FIRST_PARTY',
  definition:
    'How much of the published catalogue is illustrated: the share of published products with a hero, with a gallery of three or more, and with hero alt text; the share of sections with a mobile image; the share of media assets used anywhere; and the share that are AI concept renders.',
  coverage: 'n = published products with a hero image; denominator = published products.',
  requires: {
    tables: ['products', 'product_media', 'page_sections', 'media_assets', 'media_usages'],
  },
  availableFrom: 7,
  async compute({ reads }) {
    const [products, mediaCounts, sections, media, used] = await Promise.all([
      reads.products(),
      reads.productMediaCounts(),
      reads.sections(),
      reads.media(),
      reads.mediaUsedIds(),
    ])
    const altById = new Map(media.map((asset) => [asset.id, asset.altText.trim().length > 0]))
    const published = products.filter((product) => product.status === PUBLISHED)
    const withHero = published.filter((product) => product.heroMediaId !== null)
    const withGallery = published.filter((product) => (mediaCounts.get(product.id) ?? 0) >= 3)
    const withAlt = withHero.filter((product) => altById.get(product.heroMediaId ?? '') === true)
    const withDesktop = sections.filter((section) => section.hasDesktopMedia)
    const withMobile = withDesktop.filter((section) => section.hasMobileMedia)
    const concept = media.filter((asset) => asset.isConcept).length
    const usedCount = media.filter((asset) => used.has(asset.id)).length
    return available(withHero.length, published.length, {
      figure: percent(withHero.length, published.length),
      unit: 'percent',
      groups: [
        { label: 'hero', value: percent(withHero.length, published.length) },
        { label: 'gallery ≥ 3', value: percent(withGallery.length, published.length) },
        { label: 'hero alt text', value: percent(withAlt.length, withHero.length) },
        { label: 'mobile slot', value: percent(withMobile.length, withDesktop.length) },
        { label: 'assets used', value: percent(usedCount, media.length) },
        { label: 'concept renders', value: percent(concept, media.length) },
      ],
      detail: {
        media_assets: media.length,
        concept_assets: concept,
        sections_with_desktop_media: withDesktop.length,
      },
    })
  },
}

export const FIRST_PARTY_METRICS: readonly MetricModule[] = [
  catalog,
  productCategories,
  productScale,
  largeFormatShare,
  collectionMix,
  inquiryTrends,
  contentPerformance,
  mediaCoverage,
]
