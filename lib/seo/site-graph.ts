import 'server-only'

import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { listGlobalContent } from '@/lib/supabase/repositories/cms'

import { siteOrigin } from './canonical'
import { graphOf, organizationJsonLd, webSiteJsonLd, type JsonLdGraph } from './jsonld'

/**
 * The root layout's graph: `Organization` and `WebSite`, from the brand row and the origin.
 *
 * OMIT, NEVER DEFAULT. Both nodes need the site's origin (`NEXT_PUBLIC_SITE_URL`) and the brand
 * name (`BRAND.brand.name`, with `SEO_DEFAULT.site_name` behind it — the masthead's own order, so
 * the structured data and the visible page cannot disagree about what the business is called).
 * With either missing this returns null and the layout emits nothing.
 *
 * THE ORGANIZATION IS GATED ON THE BRAND ROW'S VERIFICATION. The name row is read with its
 * `owner_verification` so `organizationJsonLd` can refuse a name the owner has not confirmed; the
 * seeded row is NOT_REQUIRED (the studio's own name asserts nothing that needs a second person)
 * and passes. `sameAs` comes only from `SOCIAL.profile_*` rows the owner typed — none are seeded.
 * No `logo` until a brand asset exists (a Phase 43 gap).
 */
export const SEARCH_PATH = '/search'

export async function siteJsonLd(): Promise<JsonLdGraph | null> {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  if (origin === null) return null

  const [chrome, brandRows, socialRows] = await Promise.all([
    getSiteChrome(),
    listGlobalContent(createPublicClient(), 'BRAND'),
    listGlobalContent(createPublicClient(), 'SOCIAL'),
  ])

  const brandRow = brandRows.find((row) => row.key === 'brand.name' && row.is_enabled) ?? null
  const name =
    siteString(chrome.strings, 'BRAND.brand.name') ??
    siteString(chrome.strings, 'SEO_DEFAULT.site_name')
  if (name === null) return null

  const organization = organizationJsonLd({
    name,
    verification: brandRow?.owner_verification ?? 'NOT_REQUIRED',
    url: origin,
    sameAs: socialRows
      .filter((row) => row.is_enabled && row.key.startsWith('profile_'))
      .map((row) => row.value.trim()),
  })
  const website = webSiteJsonLd({
    name,
    url: origin,
    alternateName: siteString(chrome.strings, 'BRAND.brand.alternate_name'),
    searchPath: SEARCH_PATH,
    hasOrganization: organization !== null,
  })

  return graphOf([organization, website])
}
