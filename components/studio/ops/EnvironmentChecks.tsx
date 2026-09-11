import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { t } from '@/components/studio/strings'
import type { CheckResult, CheckStatus } from '@/lib/ops/env-checks'

/**
 * The eight checks as a table — Phase 38, RC-342. Status, code, latency, checked-at and the
 * identifiers a check reports (a commit, a count, a version, an email). The runner has already
 * redacted the detail; this renders what it was given and adds nothing.
 */

const TONE: Record<CheckStatus, BadgeTone> = {
  OK: 'success',
  DEGRADED: 'warning',
  UNREACHABLE: 'danger',
  NOT_CONFIGURED: 'neutral',
  UNKNOWN: 'info',
}

function Detail({ detail }: { readonly detail: CheckResult['detail'] }) {
  const entries = Object.entries(detail)
  if (entries.length === 0) return null
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-ink-secondary">{key}</dt>
          <dd className="m-0 break-all">{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

const COLUMNS: readonly Column<CheckResult>[] = [
  {
    id: 'check',
    header: t('studio.env.colCheck'),
    cell: (row) => (
      <Text as="span" size="sm" data-env-check={row.id}>
        {row.id}
      </Text>
    ),
  },
  {
    id: 'configured',
    header: t('studio.env.colConfigured'),
    cell: (row) => (
      <Text as="span" size="sm" data-env-configured={String(row.configured)}>
        {row.configured ? t('studio.env.yes') : t('studio.env.no')}
      </Text>
    ),
  },
  {
    id: 'status',
    header: t('studio.env.colStatus'),
    cell: (row) => (
      <Badge tone={TONE[row.status]} data-env-status={row.status}>
        {row.status}
      </Badge>
    ),
  },
  {
    id: 'code',
    header: t('studio.env.colCode'),
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary">
        {row.code}
      </Text>
    ),
  },
  {
    id: 'latency',
    header: t('studio.env.colLatency'),
    numeric: true,
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary">
        {`${String(row.latencyMs)} ms`}
      </Text>
    ),
  },
  {
    id: 'checked',
    header: t('studio.env.colChecked'),
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary">
        {row.checkedAt.replace('T', ' ').slice(0, 19)}
      </Text>
    ),
  },
  {
    id: 'detail',
    header: t('studio.env.colDetail'),
    cell: (row) => <Detail detail={row.detail} />,
  },
]

export function EnvironmentChecks({ results }: { readonly results: readonly CheckResult[] }) {
  return (
    <Stack gap={3}>
      <DataTable
        caption={t('studio.env.tableCaption')}
        columns={COLUMNS}
        rows={results}
        rowKey={(row) => row.id}
        empty={{
          reason: 'empty',
          heading: t('studio.env.emptyHeading'),
          body: t('studio.env.emptyBody'),
        }}
      />
    </Stack>
  )
}
