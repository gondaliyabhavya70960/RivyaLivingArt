import type { JournalArticle } from '@/lib/supabase/schemas'

/**
 * `Article` structured data for a journal article.
 *
 * `author` IS THE ORGANISATION UNLESS A VERIFIED HUMAN BYLINE EXISTS, which is the phase document's
 * rule and D10's underneath it. `journal_articles.byline` defaults to the studio's own name; an
 * editor who types a person's name is asserting that a real individual wrote this, which is a claim
 * about who works at Rivya, so the row carries `owner_verification` and this function emits a
 * `Person` only once that says VERIFIED. An unverified human byline falls back to the organisation
 * rather than being dropped: the article was written by the studio either way, and omitting `author`
 * entirely would make a valid claim disappear because a different one was unconfirmed.
 *
 * `datePublished` AND `dateModified` COME FROM REAL COLUMNS OR ARE ABSENT. Never `new Date()`, never
 * `created_at` standing in for a publication date. An article with no `published_at` is not
 * published, so this function is not called for one — but the guard is here rather than assumed,
 * because a machine reading a fabricated date has no way to tell.
 *
 * NO `wordCount`, NO `articleBody`, NO `keywords`. The body is a block document; serialising it into
 * structured data would republish the article outside the page's own rules and would need a
 * definition of "the text" that this repository does not have. `wordCount` would be derived from the
 * same estimate `reading_minutes` uses, and an estimate presented as a count is a number that looks
 * measured and is not.
 */

export type ArticleJsonLd = {
  readonly '@context': 'https://schema.org'
  readonly '@type': 'Article'
  readonly headline: string
  readonly url: string
  readonly author: { readonly '@type': 'Organization' | 'Person'; readonly name: string }
  readonly publisher: { readonly '@type': 'Organization'; readonly name: string }
  readonly datePublished?: string
  readonly dateModified?: string
  readonly description?: string
  readonly image?: string
  readonly articleSection?: string
}

export function articleJsonLd(
  article: JournalArticle,
  options: {
    readonly url: string
    /** The studio's name, from `BRAND.brand.name`. Never a literal in this file. */
    readonly organisationName: string
    readonly imageUrl: string | null
    /** The primary category's name, for `articleSection`. */
    readonly categoryName: string | null
  },
): ArticleJsonLd | null {
  const headline = article.title.trim()
  const organisation = options.organisationName.trim()
  // A node with no headline describes nothing, and one with no publisher name cannot say who
  // published it. Both are `not null` columns or configured values, so these guard whitespace.
  if (headline === '' || organisation === '') return null

  const byline = article.byline.trim()
  const humanByline = byline !== '' && byline !== organisation
  const verified = article.owner_verification === 'VERIFIED'

  const description = article.excerpt?.trim() ?? ''
  const published = article.published_at
  const modified = article.updated_at

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    url: options.url,
    author:
      humanByline && verified
        ? { '@type': 'Person', name: byline }
        : { '@type': 'Organization', name: organisation },
    publisher: { '@type': 'Organization', name: organisation },
    ...(published === null ? {} : { datePublished: published }),
    ...(modified === null ? {} : { dateModified: modified }),
    ...(description === '' ? {} : { description }),
    ...(options.imageUrl === null ? {} : { image: options.imageUrl }),
    ...(options.categoryName === null ? {} : { articleSection: options.categoryName }),
  }
}
