import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { Text } from '@/components/primitives/Text'
import { ActorChip } from '@/components/studio/ActorChip'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { t } from '@/components/studio/strings'
import type { LogLevel, SystemLogRow } from '@/lib/supabase/schemas/system-logs'

import { LogDetail } from './LogDetail'

/**
 * The log as a table — Phase 38, RC-343. Newest first; a repeated event shows its count; the
 * detail is a disclosure per row so the table stays a table. Nothing here is a value: the context
 * was redacted before insert and `LogDetail` redacts it again on the way out.
 */

const LEVEL_TONE: Record<LogLevel, BadgeTone> = {
  INFO: 'neutral',
  WARNING: 'warning',
  ERROR: 'danger',
  SECURITY: 'info',
}

const COLUMNS: readonly Column<SystemLogRow>[] = [
  {
    id: 'when',
    header: t('studio.logs.colWhen'),
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary">
        {row.occurred_at.replace('T', ' ').slice(0, 19)}
      </Text>
    ),
  },
  {
    id: 'level',
    header: t('studio.logs.colLevel'),
    cell: (row) => (
      <Badge tone={LEVEL_TONE[row.level]} data-log-level={row.level}>
        {row.level}
      </Badge>
    ),
  },
  {
    id: 'channel',
    header: t('studio.logs.colChannel'),
    cell: (row) => (
      <Text as="span" size="xs" data-log-channel={row.channel}>
        {row.channel}
      </Text>
    ),
  },
  {
    id: 'event',
    header: t('studio.logs.colEvent'),
    cell: (row) => (
      <div>
        <Text size="sm" data-log-event={row.event}>
          {row.event}
        </Text>
        <Text size="xs" tone="secondary">
          {row.message.length > 160 ? `${row.message.slice(0, 160)}…` : row.message}
        </Text>
      </div>
    ),
  },
  {
    id: 'count',
    header: t('studio.logs.colCount'),
    numeric: true,
    cell: (row) => (
      <Text as="span" size="xs" tone={row.occurrence_count > 1 ? 'primary' : 'secondary'}>
        {String(row.occurrence_count)}
      </Text>
    ),
  },
  {
    id: 'actor',
    header: t('studio.logs.colActor'),
    cell: (row) =>
      row.actor_role === null ? (
        <Text as="span" size="xs" tone="tertiary">
          {t('studio.logs.machine')}
        </Text>
      ) : (
        <ActorChip role={row.actor_role} />
      ),
  },
  {
    id: 'detail',
    header: t('studio.logs.colDetail'),
    cell: (row) => <LogDetail row={row} />,
  },
]

export function LogTable({ rows }: { readonly rows: readonly SystemLogRow[] }) {
  return (
    <DataTable
      caption={t('studio.logs.tableCaption')}
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      empty={{
        reason: 'empty',
        heading: t('studio.logs.emptyHeading'),
        body: t('studio.logs.emptyBody'),
      }}
    />
  )
}
