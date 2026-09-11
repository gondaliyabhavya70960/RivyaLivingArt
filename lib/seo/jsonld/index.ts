/**
 * The structured-data allowlist — one builder per type, every one pure, every one returning
 * `object | null`, and null whenever its gate fails. Nothing else in the codebase may emit a
 * structured-data script element: `components/patterns/JsonLd.tsx` is the sole emitter and
 * `scripts/seo/check-jsonld-scope.mjs` fails the build on a second one.
 *
 *   Organization    root layout      brand row not awaiting verification; logo only when an asset exists
 *   WebSite         root layout      always, with the one SearchAction the site offers
 *   BreadcrumbList  entity routes    a trail of real published parents, two positions or nothing
 *   Product         /product/[slug]  offers only for FIXED and VERIFIED; no rating, review, gtin, mpn
 *   CollectionPage  /collections/*   the page is PUBLISHED; no item count
 *   Article         /journal/[slug]  PUBLISHED; author is the organisation unless a VERIFIED byline
 *   FAQPage         /faq             only VERIFIED rows; no block when none are
 *   ContactPoint    /contact         the contact section is VERIFIED
 *
 * `guard.ts` holds the gate (`verifiedOnly`) and the forbidden-key list both the unit test and the
 * build-time validator check against.
 */

export { articleJsonLd, type ArticleJsonLd } from './article'
export { breadcrumbJsonLd, type BreadcrumbJsonLd, type Crumb } from './breadcrumb'
export { collectionJsonLd, type CollectionJsonLd } from './collection'
export { contactPointJsonLd, type ContactPointJsonLd } from './contact'
export { faqPageJsonLd, type FaqPageJsonLd, type FaqRowLike } from './faq'
export { FORBIDDEN_KEYS, FORBIDDEN_TYPES, forbiddenKeysIn, verifiedOnly } from './guard'
export { organizationId, organizationJsonLd, type OrganizationJsonLd } from './organization'
export {
  productImageUrls,
  productJsonLd,
  type ProductJsonLd,
  type ProductJsonLdInput,
} from './product'
export { webSiteJsonLd, type WebSiteJsonLd } from './website'

export const SCHEMA_CONTEXT = 'https://schema.org' as const

/** One or more nodes as the single graph a route emits. */
export type JsonLdGraph = {
  readonly '@context': typeof SCHEMA_CONTEXT
  readonly '@graph': readonly object[]
}

/** The nodes that are not null, as one graph — or null when none survived their gates. */
export function graphOf(nodes: readonly (object | null | undefined)[]): JsonLdGraph | null {
  const present = nodes.filter((node): node is object => node !== null && node !== undefined)
  if (present.length === 0) return null
  return { '@context': SCHEMA_CONTEXT, '@graph': present }
}

/**
 * The graph as a string safe to place inside a `<script>` element.
 *
 * `<` IS ESCAPED, AND THAT IS NOT PARANOIA ABOUT OUR OWN DATA. The brand name is a
 * `global_content` row an editor can type into, and a `</script>` sequence anywhere inside a
 * script block ends the block wherever it appears — including inside a JSON string. Escaping it
 * as `<` is still valid JSON, parses to the same value, and cannot close the element.
 */
export function serialiseJsonLd(graph: unknown): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c')
}
