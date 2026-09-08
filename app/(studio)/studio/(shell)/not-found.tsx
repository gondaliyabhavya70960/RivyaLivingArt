import Link from 'next/link'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * A Studio route that does not exist.
 *
 * SEPARATE COPY FROM THE PUBLIC 404 (SEED §45), because the public one offers "View the Collection"
 * and "Return Home" — an invitation to browse, which is the wrong thing to say to a staff member
 * who followed a broken link inside their own tool. The shape is the same; the words are not.
 *
 * It says nothing about whether the record exists. `notFound()` is what a Studio page calls when a
 * record is missing OR when the reader may not see it, and distinguishing those here would turn
 * this page into an oracle for probing which ids are real.
 */
export default function StudioNotFound() {
  return (
    <Stack gap={3} className="max-w-prose">
      <Heading level={1} size="display-md">
        {t('studio.state.notFoundHeading')}
      </Heading>
      <Text tone="secondary">{t('studio.state.notFoundBody')}</Text>
      <Link href="/studio" className="rounded-sm underline underline-offset-4">
        <Text as="span">{t('studio.state.backToOverview')}</Text>
      </Link>
    </Stack>
  )
}
