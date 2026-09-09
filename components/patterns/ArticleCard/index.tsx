import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { SiteStrings } from '@/lib/cms/strings'
import type { JournalArticle, MediaAsset } from '@/lib/supabase/schemas'

/**
 * RC-220. One journal article, as a card.
 *
 * 16:9, AND THE ONLY CARD ON THE SITE THAT CHANGES LAYOUT RATHER THAN RATIO ON A PHONE. A product
 * card and a project card are browsed — the eye moves across a grid of images. A list of articles is
 * READ: the title is the thing being scanned, and a stack of full-width 16:9 images pushes three
 * titles below the fold that a horizontal row keeps on it. Below 640px the card becomes 96px of
 * media beside the text, which is the registry's own line for this component.
 *
 * THE DATE IS A `<time datetime>` AND COMES FROM `published_at`. Not `created_at`, which is when
 * somebody started typing, and never "today" for an unpublished piece: a draft renders no date at
 * all rather than a placeholder that becomes wrong the moment it is published.
 *
 * READING TIME IS LABELLED AS AN ESTIMATE AND IS OMITTED WHEN NULL. `reading_minutes` is derived by
 * a trigger from the article's own blocks at 200 words per minute — a rate that is a convention, not
 * a measurement of this reader — so the string that renders it says so. An article with no body has
 * NULL, and the card shows nothing rather than "1 min read", which would describe a body that does
 * not exist.
 *
 * NO AUTHOR NAME. `byline` defaults to the organisation, and a card that printed "Rivya Living Art"
 * under every title on a page that is entirely Rivya's would be noise. The article page renders it;
 * the card does not.
 */

export type ArticleCardStrings = {
  /** e.g. `{{minutes}} min read` — a seeded sentence, because it is one. */
  readonly readingTime: string | null
}

export type ArticleCardProps = {
  readonly article: JournalArticle
  readonly cover: MediaAsset | null
  /** The article's primary category name, when the caller has it. Rendered as the eyebrow. */
  readonly categoryName: string | null
  readonly sizes: string
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly copy: ArticleCardStrings
}

/** `{{minutes}} min read`, filled. Null when there is no body or no seeded string to say it with. */
function readingTime(article: JournalArticle, copy: ArticleCardStrings): string | null {
  if (article.reading_minutes === null || copy.readingTime === null) return null
  return copy.readingTime.replace('{{minutes}}', String(article.reading_minutes))
}

export function ArticleCard({
  article,
  cover,
  categoryName,
  sizes,
  strings,
  cloudName,
  copy,
}: ArticleCardProps): React.ReactElement {
  const minutes = readingTime(article, copy)
  const published = article.published_at

  return (
    <a
      href={`/journal/${article.slug.toLowerCase()}`}
      data-article-card=""
      data-entry-key={article.slug}
      className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
    >
      {/*
        Horizontal below 640px — 96px of media beside the text — and stacked above it. The media
        column is fixed rather than fractional so the text column does not reflow between two
        articles whose titles are different lengths.
      */}
      <div className="flex gap-4 sm:block">
        <div className="w-24 shrink-0 sm:w-auto">
          <BlockImage
            asset={cover}
            ratio="16:9"
            preset="card"
            sizes={sizes}
            strings={strings}
            cloudName={cloudName}
          />
        </div>

        <Stack gap={2} className="min-w-0 sm:mt-3">
          {categoryName === null ? null : <Eyebrow>{categoryName}</Eyebrow>}
          {/* Three lines on a phone, where the card is a row and the title is most of it. */}
          <Heading level={3} size="display-xs" className="line-clamp-3 sm:line-clamp-none">
            {article.title}
          </Heading>
          {article.excerpt === null ? null : (
            <Text size="base" tone="secondary" className="hidden sm:block">
              {article.excerpt}
            </Text>
          )}
          {published === null && minutes === null ? null : (
            <Text size="sm" tone="tertiary">
              {published === null ? null : (
                <time dateTime={published}>{formatDate(published)}</time>
              )}
              {published !== null && minutes !== null ? ' · ' : null}
              {minutes}
            </Text>
          )}
        </Stack>
      </div>
    </a>
  )
}

/**
 * `2026-09-09T…` → `9 September 2026`.
 *
 * `en-GB` AND A FIXED UTC TIME ZONE. A date formatted in the visitor's zone renders differently on
 * the server and in the browser, which React reports as a hydration mismatch and a reader sees as
 * the date changing after the page loads. The publication date of an article is a fact about the
 * studio's day, not about the reader's.
 */
function formatDate(iso: string): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(when)
}

/**
 * The grid a journal listing draws.
 *
 * THREE ACROSS AT DESKTOP, TWO AT TABLET, AND A SINGLE COLUMN OF ROWS ON A PHONE — which is not the
 * same as one card per row of the desktop layout, because the card itself changes shape there. The
 * rhythm ships with the card for the reason RC-219's does: a section free to lay these out itself is
 * free to put four across, and four article cards in a row are headlines nobody can read.
 */
export function ArticleCardGrid({
  articles,
  covers,
  categoryNames,
  strings,
  cloudName,
  copy,
}: {
  readonly articles: readonly JournalArticle[]
  readonly covers: ReadonlyMap<string, MediaAsset>
  readonly categoryNames: ReadonlyMap<string, string>
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly copy: ArticleCardStrings
}): React.ReactElement | null {
  if (articles.length === 0) return null

  return (
    <Grid gap={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          cover={
            article.cover_media_id === null ? null : (covers.get(article.cover_media_id) ?? null)
          }
          categoryName={
            article.primary_category_id === null
              ? null
              : (categoryNames.get(article.primary_category_id) ?? null)
          }
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 96px"
          strings={strings}
          cloudName={cloudName}
          copy={copy}
        />
      ))}
    </Grid>
  )
}
