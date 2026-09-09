import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as React from 'react'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { journalUrl, loadJournalListing } from '@/lib/journal/listing'
import { JournalListingView } from '@/lib/journal/view'
import { createPublicClient } from '@/lib/supabase/public'
import { NotFoundError } from '@/lib/supabase/errors'
import { getCategoryBySlug, listCategories } from '@/lib/supabase/repositories/journal'

/**
 * `/journal/category/[slug]` — one category's articles.
 *
 * IT IS NOT A CMS PAGE, AND THAT IS THE DIFFERENCE FROM `/collections/[slug]` AND
 * `/portfolio/[slug]`. Those two are entity pages: a collection and a project each have a story
 * somebody wrote, held as blocks on a `pages` row. A category has no story — it is a filter with a
 * name — so giving each of the nine a page would be nine block documents nobody will ever fill in,
 * and nine more routes that 404 until somebody does. What renders here is the category's own two
 * fields and the list.
 *
 * AN UNKNOWN SLUG IS A 404, and so is a category this caller may not read. RLS makes those two
 * cases indistinguishable — `getCategoryBySlug` raises `NotFoundError` for both — and they should
 * stay that way: a draft category that answered differently from a nonexistent one would let a
 * visitor enumerate what the studio has not announced.
 *
 * `intro_heading` IS THE CATEGORY'S OWN SENTENCE and `description` is what a listing says about it.
 * Both are editable, both are optional, and when both are absent the page renders just the name and
 * the list — which is honest for a category nobody has written an introduction for.
 */

type Params = { readonly slug: string }
type Props = {
  readonly params: Promise<Params>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

const BASE = '/journal/category'
const pathFor = (slug: string) => `${BASE}/${slug.toLowerCase()}`

/**
 * The nine seeded categories, pre-rendered.
 *
 * THEY SHIP PUBLISHED, so unlike `/collections/[slug]` and `/portfolio/[slug]` this route has real
 * paths on day one. The listing under each is empty until an article is published, which is the
 * correct state rather than a reason to hide the category.
 */
export async function generateStaticParams(): Promise<Params[]> {
  const categories = await listCategories(createPublicClient())
  return categories.map((category) => ({ slug: category.slug.toLowerCase() }))
}

async function categoryFor(slug: string) {
  return getCategoryBySlug(createPublicClient(), slug).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null
    throw error
  })
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await categoryFor(slug)
  if (category === null) return {}

  const { page, pageCount } = await loadJournalListing({
    searchParams: await searchParams,
    categoryId: category.id,
  })
  const path = pathFor(slug)

  return {
    title: category.name,
    ...(category.description === null ? {} : { description: category.description }),
    alternates: { canonical: journalUrl(path, page) },
    ...(page > 1 || page < pageCount
      ? {
          other: {
            ...(page > 1 ? { 'link:prev': journalUrl(path, page - 1) } : {}),
            ...(page < pageCount ? { 'link:next': journalUrl(path, page + 1) } : {}),
          },
        }
      : {}),
  }
}

export default async function JournalCategoryPage({
  params,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const { slug } = await params
  const category = await categoryFor(slug)
  if (category === null) notFound()

  const listing = await loadJournalListing({
    searchParams: await searchParams,
    categoryId: category.id,
  })

  return (
    <>
      <Stack gap={4} className="rv-container pt-16">
        <Heading level={1} size="display-md">
          {category.intro_heading ?? category.name}
        </Heading>
        {category.description === null ? null : (
          <Text size="lg" tone="secondary">
            {category.description}
          </Text>
        )}
      </Stack>
      <JournalListingView
        listing={listing}
        basePath={pathFor(slug)}
        activeCategorySlug={slug.toLowerCase()}
      />
    </>
  )
}
