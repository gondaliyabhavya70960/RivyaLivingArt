import * as React from 'react'

import { Text } from '@/components/primitives/Text'
import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { SelectorResult } from '@/lib/cms/selectors'

/**
 * What a reference block shows when the thing it refers to does not exist.
 *
 * IT IS NOT A SKELETON AND NOT A PLACEHOLDER CARD, and both of those were the obvious answers.
 *
 *   * A SKELETON says "loading". Nothing is loading — there is nothing to load, and there will be
 *     nothing to load until a later phase creates the table or the owner publishes a product. A
 *     shimmer that never resolves is a lie told politely, and it is the kind that gets shipped
 *     because it looks considered.
 *   * A PLACEHOLDER CARD is a product, project or article that does not exist. That is the
 *     fabrication D10 forbids in its plainest form, and it is worse than an empty band because it
 *     looks finished — nobody files a bug against a page that looks right.
 *
 * SO IT IS A SENTENCE THE OWNER WROTE. `EMPTY_STATE.collection`, `.portfolio` and `.journal` are
 * SEED §27, §28 and §29 verbatim, seeded by Phase 09 and editable in Studio. When the string is
 * missing the component renders NOTHING — `lib/cms/strings.ts` ships no fallbacks for the public
 * site, and a default here would be a sentence nobody wrote appearing in the one place designed to
 * admit that there is nothing to say.
 *
 * `data-empty-reason` CARRIES THE DISTINCTION THE PAGE DOES NOT. "The table does not exist yet" and
 * "the table is empty" look identical to a visitor and are different facts to whoever is deciding
 * whether the site is broken or merely young. It is an attribute rather than words, because the
 * visitor is not that reader.
 */

export type EditorialFallbackProps = {
  readonly strings: SiteStrings
  /** A dotted `global_content` key — `EMPTY_STATE.portfolio` and its two siblings. */
  readonly contentKey: string
  /** From the selector, so the page records why it is empty without saying so. */
  readonly reason: SelectorResult['reason']
}

export function EditorialFallback({
  strings,
  contentKey,
  reason,
}: EditorialFallbackProps): React.ReactElement | null {
  const message = siteString(strings, contentKey)
  if (message === null) return null

  return (
    <div data-empty-reason={reason} className="max-w-prose">
      <Text tone="secondary">{message}</Text>
    </div>
  )
}
