import type * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { CoverageReport } from '@/lib/seo/coverage'

/**
 * The Coverage tab — counts of rows in a named state. No figure here is a ranking, a volume or a
 * claim; every one is a list of addresses an editor can go and fix.
 */
export function CoveragePanel({ report }: { readonly report: CoverageReport }) {
  const block = (
    key: string,
    heading: string,
    paths: readonly string[],
    body?: string,
  ): React.ReactElement => (
    <Surface level={1} className="grid gap-2 p-4" data-seo-coverage={key}>
      <div className="flex flex-wrap items-baseline gap-3">
        <Text size="xl" data-seo-coverage-count="">
          {String(paths.length)}
        </Text>
        <Text size="sm">{heading}</Text>
      </div>
      {body === undefined ? null : (
        <Text size="xs" tone="tertiary">
          {body}
        </Text>
      )}
      {paths.length === 0 ? null : (
        <Text size="xs" tone="secondary">
          {paths.join(' · ')}
        </Text>
      )}
    </Surface>
  )

  return (
    <Stack gap={4} data-seo-coverage-panel="">
      <Text size="sm" tone="secondary">
        {t('studio.seo.coverage.intro')
          .replace('{{total}}', String(report.total))
          .replace('{{pages}}', String(report.pages))
          .replace('{{entities}}', String(report.entities))}
      </Text>
      <div className="grid gap-3 md:grid-cols-2">
        {block(
          'derived',
          t('studio.seo.coverage.derived'),
          report.derived,
          t('studio.seo.coverage.derivedBody'),
        )}
        {block(
          'missing-description',
          t('studio.seo.coverage.missingDescription'),
          report.missingDescription,
        )}
        {block('missing-og', t('studio.seo.coverage.missingOg'), report.missingOgImage)}
        {block(
          'duplicate-titles',
          t('studio.seo.coverage.duplicateTitles'),
          report.duplicateTitles.map((d) => `"${d.title}": ${d.paths.join(', ')}`),
        )}
        {block('noindex', t('studio.seo.coverage.noindex'), report.noindexEntities)}
        <Surface level={1} className="grid gap-2 p-4" data-seo-coverage="keywords">
          <div className="flex flex-wrap items-baseline gap-3">
            <Text size="xl" data-seo-coverage-count="">
              {String(report.keywordsUnresearched)}
            </Text>
            <Text size="sm">
              {t('studio.seo.coverage.keywords').replace('{{total}}', String(report.keywordsTotal))}
            </Text>
          </div>
          <Text size="xs" tone="tertiary">
            {t('studio.seo.keywords.caveat')}
          </Text>
        </Surface>
      </div>
    </Stack>
  )
}
