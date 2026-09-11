import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * The registered-but-unimplemented bulk toolbar.
 *
 * A NAMED UNAVAILABLE STATE, NOT AN ABSENCE AND NOT A BROKEN CONTROL. `/studio/research/explorer`
 * shows this. The change queue and the large-format workspace no longer do: Phase 29 implemented
 * the five research operations and Phase 30 gave those two screens the row selection they act on,
 * so both now render the real toolbar.
 *
 * WHY RENDER ANYTHING AT ALL. Because the alternative teaches the wrong thing. A missing toolbar
 * says the feature does not exist and will not; a greyed-out one that does nothing when clicked
 * says it is broken. This says what is true: the operations are known and the engine is built —
 * what the explorer does not yet carry is a selection to act with, which is a screen's work rather
 * than an engine's.
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
