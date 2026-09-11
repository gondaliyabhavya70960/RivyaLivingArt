import Link from 'next/link'
import type { Route } from 'next'

import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { redact } from '@/lib/logging/redact'
import type { SystemLogRow } from '@/lib/supabase/schemas/system-logs'

/**
 * One row's detail — Phase 38, RC-344. The correlation ids as filters, the first occurrence, and
 * the context as redacted JSON (redacted again on render: the table cannot know who wrote it).
 */

function Id({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (value === null) return null
  return (
    <div className="contents">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="m-0 break-all">
        {href === undefined ? (
          value
        ) : (
          <Link href={href as Route} className="underline underline-offset-4">
            {value}
          </Link>
        )}
      </dd>
    </div>
  )
}

export function LogDetail({ row }: { readonly row: SystemLogRow }) {
  const context = JSON.stringify(redact(row.context), null, 2)
  return (
    <details className="text-xs" data-log-detail={row.id}>
      <summary className="text-ink-secondary cursor-pointer">{t('studio.logs.detail')}</summary>
      <div className="mt-2 flex flex-col gap-2">
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <Id label={t('studio.logs.firstSeen')} value={row.first_occurred_at} />
          <Id label={t('studio.logs.requestId')} value={row.request_id} />
          <Id
            label={t('studio.logs.workflowRun')}
            value={row.workflow_run_id}
            href={
              row.workflow_run_id === null
                ? undefined
                : `/studio/operations/logs?run=${row.workflow_run_id}`
            }
          />
          <Id
            label={t('studio.logs.researchSource')}
            value={row.research_source_id}
            href={
              row.research_source_id === null
                ? undefined
                : `/studio/operations/logs?source=${row.research_source_id}`
            }
          />
          <Id label={t('studio.logs.entityType')} value={row.entity_type} />
          <Id label={t('studio.logs.entityId')} value={row.entity_id} />
          <Id label={t('studio.logs.dedupeKey')} value={row.dedupe_key} />
        </dl>
        <Text size="xs" tone="secondary">
          {t('studio.logs.contextLabel')}
        </Text>
        <pre
          className="bg-surface-raised-2 m-0 max-h-64 overflow-auto rounded-sm p-2 text-xs"
          data-log-context=""
        >
          {context}
        </pre>
      </div>
    </details>
  )
}
