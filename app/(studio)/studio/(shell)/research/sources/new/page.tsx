import type { Route } from 'next'
import Link from 'next/link'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { studioMetadata } from '@/components/studio/StudioPage'
import { SourceForm } from '@/components/studio/research/SourceForm'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listAdapterDescriptors } from '@/lib/scraper/adapters/registry'

import { createSourceAction } from '../actions'

/**
 * /studio/research/sources/new — the create route beneath the sources leaf (D4).
 *
 * IT CREATES A SOURCE THAT CAN DO NOTHING. Every new row is `UNREVIEWED`, disabled and `DRAFT`, and
 * `research_sources_enabled_requires_approval` makes any other starting state unstorable. So this
 * form is deliberately not a wizard ending in "start fetching": it ends on the source's own page,
 * where the patterns, the mapping and the schedule are added and where an owner is asked for the
 * one decision this software cannot make.
 *
 * THE POLITENESS DEFAULTS ARE THE TIMID ONES and they are pre-filled rather than left blank, so a
 * source configured by somebody in a hurry is slow rather than fast. Twenty requests a minute,
 * three seconds apart, one at a time.
 */
export const metadata = studioMetadata('/studio/research/sources')

export default async function Page() {
  await requirePermission('research.write')
  const adapters = listAdapterDescriptors()

  return (
    <Stack gap={6}>
      <PageHeader
        level={1}
        title={t('studio.research.addSource')}
        description={t('studio.research.policyOwnerOnlyBody')}
      />
      <Link href={'/studio/research/sources' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.research.sourcesHeading')}
        </Text>
      </Link>

      <Surface level={1} className="p-6">
        <SourceForm
          action={createSourceAction}
          adapters={adapters.map((adapter) => ({
            key: adapter.key,
            version: adapter.version,
            capabilities: [...adapter.capabilities],
          }))}
          source={null}
        />
      </Surface>
    </Stack>
  )
}
