'use client'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * A Studio page that threw.
 *
 * A CLIENT COMPONENT BECAUSE NEXT REQUIRES IT — an error boundary needs `reset`, which is a
 * callback. That is the only reason; nothing here is interactive beyond the retry.
 *
 * IT NEVER RENDERS `error.message`. On the server Next replaces the message with a digest in
 * production, but not in development — so a developer sees the real text, gets used to it being
 * there, and a message that leaks a connection string or a row's contents onto a staff member's
 * screen is one deploy away. The digest is shown instead: it is what correlates this screen with
 * the server log, which is the only thing the reader can act on.
 *
 * The shape follows SEED §46 (heading, body, Try Again, secondary) with Studio wording.
 */
export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Stack gap={3} className="max-w-prose">
      <Heading level={1} size="display-md">
        {t('studio.state.errorHeading')}
      </Heading>
      <Text tone="secondary">{t('studio.state.errorBody')}</Text>

      {error.digest !== undefined && (
        <Text size="xs" tone="tertiary">
          {t('studio.state.errorReference')} <code>{error.digest}</code>
        </Text>
      )}

      <div className="flex gap-4">
        <button type="button" onClick={reset} className="rounded-sm underline underline-offset-4">
          <Text as="span">{t('studio.state.tryAgain')}</Text>
        </button>
        <a href="/studio" className="rounded-sm underline underline-offset-4">
          <Text as="span">{t('studio.state.backToOverview')}</Text>
        </a>
      </div>
    </Stack>
  )
}
