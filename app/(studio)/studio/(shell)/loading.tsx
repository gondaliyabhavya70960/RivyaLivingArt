import { Skeleton } from '@/components/primitives/Skeleton'
import { Stack } from '@/components/primitives/Stack'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { t } from '@/components/studio/strings'

/**
 * Shown while a Studio page's server render is in flight.
 *
 * IT ANNOUNCES ITSELF. A skeleton is invisible to a screen reader — the region simply stays empty,
 * so a non-sighted user gets no signal that anything is happening and reasonably concludes the
 * navigation failed. `role="status"` with a real sentence is what makes the wait perceivable.
 *
 * The shapes deliberately do not imitate any particular page. A skeleton that mimics a table and
 * resolves into an empty state is a small lie about what is coming.
 */
export default function StudioLoading() {
  return (
    <div role="status" aria-live="polite">
      <VisuallyHidden>{t('studio.state.loading')}</VisuallyHidden>
      <Stack gap={4} aria-hidden="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </Stack>
    </div>
  )
}
