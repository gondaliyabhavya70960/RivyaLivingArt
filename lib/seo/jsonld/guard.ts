import type { OwnerVerification } from '@/lib/supabase/schemas'

/**
 * The verification gate as code — PHASE-39-46 §Phase 39.
 *
 * `verifiedOnly(value, verification)` is what every capability-bearing property passes through
 * before it can reach a graph. A value whose row is still OWNER_VERIFICATION_REQUIRED comes back
 * `undefined`, and `undefined` is what the builders spread as "key absent" — never null, never an
 * empty string, because a JSON-LD consumer reads `"telephone": null` as a malformed number rather
 * than an unknown one.
 *
 * NOT_REQUIRED PASSES. It is the state of a row that asserts nothing needing a person's word — the
 * studio's own name, a seeded editorial heading — and treating it as unverified would empty every
 * graph on the site for want of a click nobody needs to make. VERIFIED passes because someone
 * made it.
 *
 * THE FORBIDDEN LIST IS THE OTHER HALF. Structured data is the one place where inventing a fact is
 * worse than writing it on a page: a search engine reads it as an assertion by the business, shows
 * it in a result, and keeps showing it. The keys and types below are the ones the phase document
 * names as never emitted anywhere — each asserts a capability, a delivered outcome or a commercial
 * term Rivya has not confirmed, and three of them (`Offer` for a non-FIXED price, `shippingDetails`,
 * `returnPolicy`) would contradict the no-checkout rule outright. No builder has a branch that can
 * produce them; `forbiddenKeysIn()` is how the unit test and the build-time validator prove it.
 */

export function verifiedOnly<T>(value: T, verification: OwnerVerification): T | undefined {
  return verification === 'OWNER_VERIFICATION_REQUIRED' ? undefined : value
}

/** Keys no graph on this site may carry, at any depth. */
export const FORBIDDEN_KEYS = [
  'aggregateRating',
  'review',
  'reviews',
  'award',
  'awards',
  'hasCredential',
  'foundingDate',
  'numberOfEmployees',
  'address',
  'telephone',
  'openingHours',
  'openingHoursSpecification',
  'priceRange',
  'gtin',
  'gtin8',
  'gtin12',
  'gtin13',
  'gtin14',
  'mpn',
  'shippingDetails',
  'hasMerchantReturnPolicy',
  'returnPolicy',
  'deliveryTime',
  'areaServed',
  'availability',
] as const

/** Types no graph on this site may carry, at any depth. */
export const FORBIDDEN_TYPES = [
  'LocalBusiness',
  'Store',
  'Review',
  'Rating',
  'AggregateRating',
  'Award',
  'Certification',
  'OpeningHoursSpecification',
  'OfferShippingDetails',
  'MerchantReturnPolicy',
  'Service',
] as const

const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set(FORBIDDEN_KEYS)
const FORBIDDEN_TYPE_SET: ReadonlySet<string> = new Set(FORBIDDEN_TYPES)

/**
 * Every forbidden key and type present anywhere in `node`, as `path` strings — empty for a clean
 * graph. `ContactPoint.telephone` is the one exemption: the phase document allows a verified
 * telephone on the contact node and nowhere else, and `contact.ts` is the only builder that can
 * write one, gated on the section's verification.
 */
export function forbiddenKeysIn(node: unknown, path: string = '$'): readonly string[] {
  const found: string[] = []
  const walk = (value: unknown, at: string, parentType: string | null): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${at}[${String(index)}]`, parentType))
      return
    }
    if (value === null || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const type = typeof record['@type'] === 'string' ? (record['@type'] as string) : null
    if (type !== null && FORBIDDEN_TYPE_SET.has(type)) found.push(`${at}.@type=${type}`)
    for (const [key, child] of Object.entries(record)) {
      const here = `${at}.${key}`
      const exempt = key === 'telephone' && type === 'ContactPoint'
      if (FORBIDDEN_KEY_SET.has(key) && !exempt) found.push(here)
      walk(child, here, type ?? parentType)
    }
  }
  walk(node, path, null)
  return found
}

/** `undefined` for a blank string, so a builder can spread it as an absent key. */
export function present(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}
