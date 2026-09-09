import type { Metadata } from 'next'
import * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { journalUrl, loadJournalListing } from '@/lib/journal/listing'
import { JournalListingView } from '@/lib/journal/view'

/**
 * `/journal` — the landing.
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly.
 *
 * PHASE 18 APPENDS THE LIST BENEATH THE SEEDED SECTIONS, exactly as Phase 14 did on `/collection`.
 * The two seeded bands stay what they were — a hero and SEED §29's empty state, both editable — and
 * the listing renders under them. With ten drafts and nothing published the list is empty and the
 * empty state is the page, which is the correct thing for a journal with no articles to say and the
 * reason no placeholder card exists.
 *
 * THE EMPTY STATE IS NOT DUPLICATED. `JournalListingView` draws nothing when there are no articles,
 * because the band above already carries §29's sentence. Two of them stacked reads as a bug.
 *
 * NO `rss.xml`. The phase document lists a feed and then holds it: it would add a public URL D3 does
 * not list, which needs an amendment nobody has granted. Until one is, the URL is absent and no feed
 * is advertised in this page's head — and `tests/e2e/journal.spec.ts` asserts both.
 */
const PATH = '/journal'

type Props = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page, pageCount } = await loadJournalListing({ searchParams: await searchParams })

  return cmsPageMetadata(PATH, {
    // Page 2 is its own address and its own canonical: telling a crawler that every page of a
    // listing is really page 1 loses every article that is not on the first one.
    canonicalPath: journalUrl(PATH, page),
    pagination: {
      ...(page > 1 ? { previous: journalUrl(PATH, page - 1) } : {}),
      ...(page < pageCount ? { next: journalUrl(PATH, page + 1) } : {}),
    },
  })
}

export default async function JournalPage({ searchParams }: Props): Promise<React.ReactElement> {
  const listing = await loadJournalListing({ searchParams: await searchParams })

  return (
    <>
      {await renderCmsPage(PATH)}
      <JournalListingView listing={listing} basePath={PATH} activeCategorySlug={null} />
    </>
  )
}
