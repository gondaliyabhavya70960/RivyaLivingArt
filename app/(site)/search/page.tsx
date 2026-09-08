import type { Metadata } from 'next'
import type * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Container } from '@/components/primitives/Container'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Label } from '@/components/primitives/Label'
import { Section } from '@/components/primitives/Section'
import { Text } from '@/components/primitives/Text'
import { siteString } from '@/lib/cms/strings'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * /search
 *
 * THE ONE STATIC ROUTE THAT IS NOT A `renderCmsPage` DELEGATE, and the reason is a decision Phase
 * 09 already took and wrote down: `/search` has no `pages` row. It is a query surface with nothing
 * an editor composes — no sections, no blocks — so a row would exist only to be empty and to
 * appear in Studio inviting somebody to add content that would never render. The phase document's
 * deliverable table lists this path among the `renderCmsPage` delegates; that list was written
 * before the seed made that call, and delegating here would 404 the route outright. Recorded in
 * ARCHITECTURE.md rather than resolved silently in either direction.
 *
 * IT STILL RENDERS NO COPY OF ITS OWN. Every string is a `global_content` row: the field's label
 * and placeholder, the button, and SEED §26's no-results heading and body.
 *
 * THE ENGINE IS PHASE 23. Until then any query returns the no-results surface — which is honest
 * rather than broken: the form submits, the query survives in the URL and in the field, and the
 * page says plainly that nothing matched. What it must never do is imply the catalogue was
 * searched and found wanting when nothing was searched at all, so the copy is §26's own wording
 * and the phase that adds the index changes nothing else about this file.
 */
const PATH = '/search'

export async function generateMetadata(): Promise<Metadata> {
  // `liveSectionCount: 0` is not a placeholder — this page genuinely has no CMS sections, so it is
  // `noindex`. A search-results URL is exactly what a crawler should not be indexing.
  return buildPageMetadata({ path: PATH, liveSectionCount: 0 })
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.ReactElement> {
  const { strings } = await getSiteChrome()
  const params = await searchParams

  const raw = params['q']
  const query = (Array.isArray(raw) ? raw[0] : raw) ?? ''

  const pageHeading = siteString(strings, 'UI_LABEL.search.heading')
  const label = siteString(strings, 'UI_LABEL.search.label')
  const placeholder = siteString(strings, 'FORM_COPY.search.placeholder')
  const submit = siteString(strings, 'ACTION_LABEL.search.submit')
  const emptyHeading = siteString(strings, 'EMPTY_STATE.search.heading')
  const emptyBody = siteString(strings, 'EMPTY_STATE.search.body')

  return (
    <Section>
      <Container size="default">
        {/*
         * The page's own heading, and the reason it is not the results heading: "Nothing matched
         * that search." describes an outcome, not a document, and it is absent entirely before the
         * first query. A page whose h1 appears only sometimes has no h1 the rest of the time.
         */}
        {pageHeading === null ? null : (
          <Heading level={1} size="display-md" className="mb-8">
            {pageHeading}
          </Heading>
        )}

        {/* A GET form, so a search is a URL a visitor can bookmark, share and reload — and so it
            works with no JavaScript. Nothing here is a client island. */}
        <form method="get" action={PATH} role="search" className="flex items-end gap-3">
          <div className="flex-1">
            {/* A real <label>, hidden. `VisuallyHidden` cannot render one — its element union
                stops at the wrappers whose semantics survive hiding — and an `aria-label` on the
                input would give the field a name with no clickable target. */}
            {label === null ? null : (
              <Label htmlFor="site-search" className="sr-only">
                {label}
              </Label>
            )}
            <Input
              id="site-search"
              type="search"
              name="q"
              defaultValue={query}
              {...(placeholder === null ? {} : { placeholder })}
            />
          </div>
          {submit === null ? null : (
            <Button type="submit" variant="primary">
              {submit}
            </Button>
          )}
        </form>

        {/*
         * The results region exists whether or not a query was typed, and it is a live region so
         * that a screen-reader user who submits without leaving the field hears the outcome. It is
         * empty before the first search rather than pre-announcing "nothing matched" — which would
         * be false, since nothing was asked.
         */}
        <div aria-live="polite" className="mt-10">
          {query.trim() === '' ? null : (
            <>
              {/* `level={2}`: the results are a section of the search page, not a second page. */}
              {emptyHeading === null ? null : (
                <Heading level={2} size="display-sm">
                  {emptyHeading}
                </Heading>
              )}
              {emptyBody === null ? null : (
                <Text tone="secondary" className="mt-3">
                  {emptyBody}
                </Text>
              )}
            </>
          )}
        </div>
      </Container>
    </Section>
  )
}
