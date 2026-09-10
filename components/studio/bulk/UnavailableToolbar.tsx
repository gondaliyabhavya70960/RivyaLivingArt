import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * The registered-but-unimplemented bulk toolbar.
 *
 * A NAMED UNAVAILABLE STATE, NOT AN ABSENCE AND NOT A BROKEN CONTROL. `/studio/research/explorer`
 * and `/studio/research/changes` show this; the five research operations behind it are registered
 * in `lib/bulk/operations/research/index.ts` with `available: false` and the phase that owns them.
 *
 * WHY RENDER ANYTHING AT ALL. Because the alternative teaches the wrong thing. A missing toolbar
 * says the feature does not exist and will not; a greyed-out one that does nothing when clicked
 * says it is broken. This says what is true: the operations are known, the engine is built, and
 * the rows they act on arrive in Phase 29.
 *
 * A SERVER COMPONENT WITH NO STATE. It renders a sentence.
 */
export function UnavailableBulkToolbar(): React.ReactElement {
  return (
    <Surface level={1} className="p-4" data-bulk-unavailable>
      <Text tone="secondary">{t('studio.bulk.unavailable')}</Text>
    </Surface>
  )
}
