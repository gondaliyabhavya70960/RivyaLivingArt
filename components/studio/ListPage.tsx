import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'

/**
 * The rhythm every Studio list shares: what this page is for, how to narrow it, then the rows.
 *
 * WHY IT EXISTS, IN ONE SENTENCE FROM §13: "If every screen invents its own header, the rest of the
 * redesign will rot." Measured before Phase B, the five screens the guide names shared almost
 * nothing — `/studio/catalog/products` had a table and a hand-rolled search form with an underline
 * submit; `/studio/content/journal` and `/studio/research/sources` each had a `PageHeader` and
 * their own spacing; `/studio/inquiries/all` had a bespoke inbox; `/studio/content/faqs` was a
 * twenty-line stub. Four different answers to the same question.
 *
 * IT DOES NOT OWN THE `h1`, AND THAT IS THE WHOLE OF ITS RELATIONSHIP WITH `StudioPage`.
 * `StudioPage` renders the breadcrumb, the heading from the route manifest, the pin control and the
 * page's actions. A second heading here would give every Studio surface two `h1`s, and a
 * screen-reader user navigating by heading would land on the frame rather than on what they opened.
 * This is what goes *inside* that frame.
 *
 * THE PURPOSE LINE IS §8's CHECKLIST ITEM, and it is optional for a reason that is not laziness:
 * the route manifest's label already names most of these pages accurately, and a sentence repeating
 * the title in longer words is furniture. It earns its place when the page's job is not obvious
 * from its name — which is most of Research and none of Catalog.
 *
 * FILTERS STAY IN THE URL. `filters` is a slot rather than a component so a page can keep the
 * `GET` form it already has; §6's rule is that filters live in `searchParams` like the Overview
 * tabs, and a slot cannot accidentally take that away. What it does give them is one place in the
 * vertical rhythm, so the rows start at the same height on every screen.
 */
export function ListPage({
  purpose,
  filters,
  children,
}: {
  /** One line, resolved copy. Omit it when the route's own name already says this. */
  readonly purpose?: string
  /** The filter or search form. Keeps its own `method="get"` — see above. */
  readonly filters?: React.ReactNode
  /** The table, the grid, or whatever this list actually is. */
  readonly children: React.ReactNode
}): React.ReactElement {
  return (
    <Stack gap={6}>
      {purpose === undefined ? null : (
        <Text tone="secondary" className="max-w-prose">
          {purpose}
        </Text>
      )}
      {filters}
      {children}
    </Stack>
  )
}
