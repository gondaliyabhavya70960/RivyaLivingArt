import Link from 'next/link'
import type { Route } from 'next'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { DOC_ALLOWLIST, DOC_KEYS } from '@/lib/cms/docs/allowlist'
import { readDocsIndex } from '@/lib/cms/docs/index'

/**
 * `/studio/system/documentation` — Phase 38. The ten FEAT §30 documents, by allowlist key, from
 * the index `npm run docs:index` built and redacted. A missing index is said, not worked around:
 * the runtime never reads `docs/`.
 */
export const metadata = studioMetadata('/studio/system/documentation')

export default async function Page() {
  await requirePermission('system.docs.read')
  const index = readDocsIndex()

  return (
    <StudioPage path="/studio/system/documentation">
      <Stack gap={4}>
        <Text size="sm" data-docs-allowlist-note="">
          {t('studio.docs.allowlistNote')}
        </Text>
        {index === null ? (
          <EmptyState
            reason="unreadable"
            heading={t('studio.docs.noIndexHeading')}
            body={t('studio.docs.noIndexBody')}
          />
        ) : (
          <Surface level={1} className="p-4">
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
              {DOC_KEYS.map((key) => {
                const doc = index.docs.find((entry) => entry.key === key)
                return (
                  <li key={key} data-doc-key={key}>
                    <Link
                      href={`/studio/system/documentation/${key}` as Route}
                      className="underline underline-offset-4"
                    >
                      <Text as="span" size="sm">
                        {DOC_ALLOWLIST[key].title}
                      </Text>
                    </Link>
                    <Text size="xs" tone="tertiary">
                      {doc === undefined ? t('studio.docs.notIndexed') : DOC_ALLOWLIST[key].path}
                    </Text>
                  </li>
                )
              })}
            </ul>
            <Text size="xs" tone="tertiary" className="mt-3">
              {`${t('studio.docs.generatedAt')} ${index.generatedAt}`}
            </Text>
          </Surface>
        )}
      </Stack>
    </StudioPage>
  )
}
