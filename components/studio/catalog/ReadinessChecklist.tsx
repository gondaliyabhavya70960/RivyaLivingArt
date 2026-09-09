import * as React from 'react'

import { Badge } from '@/components/primitives/Badge'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { ReadinessEntry } from '@/lib/catalog/validation'

/**
 * FEAT §22's publication readiness, as the specification requires it: a transparent checklist of
 * NAMED items, never an opaque score.
 *
 * WHY A NUMBER WOULD BE WORSE THAN NOTHING. "Readiness 60%" tells an editor that something is
 * wrong and nothing about what, so the only way forward is to guess — and a percentage invites the
 * reading that 100% means "good", when what it actually measures is whether ten fields are
 * non-empty. The list says Hero image, and the editor adds a hero image.
 *
 * REQUIRED AND ADVISORY ARE BOTH SHOWN, and both are labelled. Hiding the advisory ones would make
 * the list look complete while Gallery and Customization sat unanswered; showing them without the
 * distinction would suggest publishing is blocked when it is not. `lib/catalog/validation.ts`
 * argues which items fall on which side.
 *
 * IT RENDERS THE ITEM NAMES VERBATIM. The phase's own verification reads them off the page, and a
 * paraphrase here would be a second vocabulary for the same ten things.
 */
export function ReadinessChecklist({
  checklist,
}: {
  readonly checklist: readonly ReadinessEntry[]
}): React.ReactElement {
  return (
    <Stack gap={3} data-readiness="">
      <Heading level={2} size="display-xs">
        {t('studio.catalog.readiness.heading')}
      </Heading>
      <Text tone="secondary" size="sm">
        {t('studio.catalog.readiness.body')}
      </Text>
      <ul className="mt-2 space-y-2">
        {checklist.map((entry) => (
          <li
            key={entry.item}
            data-readiness-item={entry.item}
            data-readiness-met={entry.met ? 'true' : 'false'}
            className="flex flex-wrap items-center gap-3"
          >
            <Text as="span">{entry.item}</Text>
            <Badge tone={entry.met ? 'success' : 'warning'}>
              {entry.met ? t('studio.catalog.readiness.met') : t('studio.catalog.readiness.unmet')}
            </Badge>
            <Text as="span" size="2xs" uppercase tone="tertiary">
              {entry.required
                ? t('studio.catalog.readiness.required')
                : t('studio.catalog.readiness.optional')}
            </Text>
          </li>
        ))}
      </ul>
    </Stack>
  )
}
