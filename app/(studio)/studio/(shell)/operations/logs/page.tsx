import Link from 'next/link'
import type { Route } from 'next'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { LogFilters } from '@/components/studio/ops/LogFilters'
import { LogTable } from '@/components/studio/ops/LogTable'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { logFilterQuery, parseLogFilter } from '@/lib/logging/log-filters'
import { listSystemLogs } from '@/lib/supabase/repositories/system-logs'
import { createClient } from '@/lib/supabase/server'

/**
 * `/studio/operations/logs` — Phase 38. What the machine did and where it failed: `system_logs`,
 * newest first, under the filters in the URL. Read requires `operations.logs.read` (owner, admin);
 * the CSV export is a link to `/api/studio/logs/export` for holders of `operations.logs.export`.
 * Every row was redacted before insert and is redacted again on render.
 */
export const metadata = studioMetadata('/studio/operations/logs')
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('operations.logs.read')
  const filter = parseLogFilter(await searchParams)
  const rows = await listSystemLogs(await createClient(), { ...filter, limit: 200 })
  const canExport = roleHasPermission(session.role, 'operations.logs.export')
  const query = logFilterQuery(filter)

  return (
    <StudioPage
      path="/studio/operations/logs"
      actions={
        canExport ? (
          <Link
            href={`/api/studio/logs/export${query === '' ? '' : `?${query}`}` as Route}
            className="rounded-sm underline underline-offset-4"
            data-logs-export=""
          >
            <Text as="span" size="sm">
              {t('studio.logs.export')}
            </Text>
          </Link>
        ) : undefined
      }
    >
      <Stack gap={4}>
        <Text size="sm" tone="secondary">
          {t('studio.logs.intro')}
        </Text>
        <LogFilters filter={filter} />
        <LogTable rows={rows} />
        <Text size="xs" tone="tertiary">
          {t('studio.logs.retentionNote')}
        </Text>
      </Stack>
    </StudioPage>
  )
}
