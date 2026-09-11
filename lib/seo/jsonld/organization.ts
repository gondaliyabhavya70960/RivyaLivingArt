import type { OwnerVerification } from '@/lib/supabase/schemas'

import { present, verifiedOnly } from './guard'

/**
 * `Organization` — the root layout's statement of who the business is, and nothing else.
 *
 * WHAT IS NOT HERE IS THE POINT. No `foundingDate`, `numberOfEmployees`, `address`, `telephone`,
 * `award`, `hasCredential`, `aggregateRating`. Every one of those is a business fact nobody has
 * supplied, and `guard.ts` lists them as forbidden at any depth. The node carries the brand name
 * and the site's own URL; `logo` only once a brand asset exists (a Phase 43 gap today); `sameAs`
 * only from profile URLs the owner typed into `global_content`.
 *
 * GATED ON THE BRAND ROW. The name comes from `BRAND.brand.name`, and the node is emitted only
 * while that row is not OWNER_VERIFICATION_REQUIRED — a name the owner has not confirmed is not
 * yet the business's name in a machine-readable assertion.
 */

export type OrganizationJsonLd = {
  readonly '@type': 'Organization'
  readonly '@id': string
  readonly name: string
  readonly url: string
  readonly logo?: string
  readonly sameAs?: readonly string[]
}

export type OrganizationInput = {
  readonly name: string | null
  readonly verification: OwnerVerification
  readonly url: string | null
  readonly logoUrl?: string | null
  /** Owner-entered profile URLs, already absolute. Non-URLs are dropped, never corrected. */
  readonly sameAs?: readonly string[]
}

export function organizationId(origin: string): string {
  return `${origin}/#organization`
}

export function organizationJsonLd(input: OrganizationInput): OrganizationJsonLd | null {
  const name = verifiedOnly(present(input.name), input.verification)
  const url = present(input.url)
  if (name === undefined || url === undefined) return null

  const sameAs = (input.sameAs ?? []).filter((candidate) => {
    try {
      const parsed = new URL(candidate)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch {
      return false
    }
  })
  const logo = present(input.logoUrl)

  return {
    '@type': 'Organization',
    '@id': organizationId(url),
    name,
    url,
    ...(logo === undefined ? {} : { logo }),
    ...(sameAs.length === 0 ? {} : { sameAs }),
  }
}
