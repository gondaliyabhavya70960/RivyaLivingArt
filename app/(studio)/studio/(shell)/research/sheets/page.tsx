import type { Route } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import {
  ExportDefinitionForm,
  type DefinitionFormValues,
  type EntityOption,
} from '@/components/studio/sheets/ExportDefinitionForm'
import { SheetsRunHistory } from '@/components/studio/sheets/SheetsRunHistory'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { isEnabled } from '@/lib/flags'
import { defaultSpreadsheetId, serviceAccountEmail } from '@/lib/sheets/client'
import {
  ENTITY_COLUMNS,
  ENTITY_LABELS,
  defaultColumns,
  extraRunPermission,
  requiresScope,
} from '@/lib/sheets/definitions'
import { listDefinitions, listRecentRuns } from '@/lib/supabase/repositories/sheets'
import { SHEET_ENTITIES, type ExportDefinitionRow } from '@/lib/supabase/schemas/sheets'
import { createClient } from '@/lib/supabase/server'

import {
  pauseAction,
  resumeAction,
  runNowAction,
  saveDefinitionAction,
  setEnabledAction,
} from './actions'

/**
 * /studio/research/sheets — the one-way export to Google Sheets.
 *
 * THE BANNER STATES THREE THINGS AND NONE OF THEM IS A CREDENTIAL: the flag's state, the default
 * spreadsheet id (an identifier), and the service-account email the admin must share the sheet
 * with (an identity). The private key is parsed in `lib/sheets/client.ts` and never reaches this
 * page or any other.
 *
 * WITH THE FLAG OFF EVERY DEFINITION RENDERS READ-ONLY AND RUN NOW IS DISABLED WITH THE REASON;
 * the action refuses regardless. Definitions are managed by owner and admin; runs are for the four
 * roles holding `integrations.sheets.run`, enquiries additionally for holders of
 * `inquiries.export` — the action writes a DENIED audit row for anyone else.
 */
export const metadata = studioMetadata('/studio/research/sheets')

const PATH = '/studio/research/sheets'

const one = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const entityOptions: readonly EntityOption[] = SHEET_ENTITIES.map((entity) => ({
  key: entity,
  label: ENTITY_LABELS[entity],
  requiresScope: requiresScope(entity),
  columns: ENTITY_COLUMNS[entity].map((column) => ({
    key: column.key,
    label: column.label,
    pii: column.pii === true,
  })),
}))

function formValues(definition: ExportDefinitionRow | null): DefinitionFormValues {
  if (definition === null) {
    return {
      id: null,
      slug: '',
      name: '',
      entity: 'RESEARCH_PRODUCTS',
      scopeId: '',
      columns: defaultColumns('RESEARCH_PRODUCTS'),
      filter: '{}',
      spreadsheetId: '',
      tabName: '',
      schedule: 'MANUAL',
      includesPii: false,
    }
  }
  return {
    id: definition.id,
    slug: definition.slug,
    name: definition.name,
    entity: definition.entity,
    scopeId: definition.scope_id ?? '',
    columns: definition.columns,
    filter: JSON.stringify(definition.filter),
    spreadsheetId: definition.spreadsheet_id ?? '',
    tabName: definition.tab_name,
    schedule: definition.schedule,
    includesPii: definition.includes_pii,
  }
}

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const params = await searchParams
  const client = await createClient()

  const [definitions, runs, flagOn] = await Promise.all([
    listDefinitions(client),
    listRecentRuns(client, 100),
    isEnabled('google_sheets'),
  ])
  const spreadsheetId = defaultSpreadsheetId()
  const email = serviceAccountEmail()

  const canManage = roleHasPermission(session.role, 'integrations.sheets.manage')
  const canRun = roleHasPermission(session.role, 'integrations.sheets.run')
  const mayRun = (definition: ExportDefinitionRow): boolean =>
    canRun && roleHasPermission(session.role, extraRunPermission(definition.entity))

  const editParam = one(params.edit)
  const editing =
    editParam === 'new'
      ? formValues(null)
      : UUID.test(editParam)
        ? formValues(definitions.find((definition) => definition.id === editParam) ?? null)
        : null

  const definitionNames = new Map(definitions.map((definition) => [definition.id, definition.name]))

  // THE >50 % ROW-COUNT WARNING: each SUCCEEDED run against the previous SUCCEEDED run of the
  // same definition, from the runs already loaded (newest first).
  const flagged = new Set<string>()
  const previous = new Map<string, number>()
  for (const run of [...runs].reverse()) {
    if (run.status !== 'SUCCEEDED') continue
    const before = previous.get(run.definition_id)
    if (before !== undefined && before > 0) {
      const change = Math.abs(run.row_count - before) / before
      if (change > 0.5) flagged.add(run.id)
    }
    previous.set(run.definition_id, run.row_count)
  }

  const columns: readonly Column<ExportDefinitionRow>[] = [
    {
      id: 'name',
      header: t('studio.sheets.colName'),
      cell: (row) => (
        <Stack gap={0}>
          <Text size="sm">{row.name}</Text>
          <Text size="xs" tone="secondary">
            {row.slug}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'entity',
      header: t('studio.sheets.colEntity'),
      cell: (row) => <Text size="sm">{ENTITY_LABELS[row.entity]}</Text>,
    },
    {
      id: 'tab',
      header: t('studio.sheets.colTab'),
      cell: (row) => <Text size="sm">{row.tab_name}</Text>,
    },
    {
      id: 'schedule',
      header: t('studio.sheets.colSchedule'),
      cell: (row) => <Text size="sm">{row.schedule}</Text>,
    },
    {
      id: 'pii',
      header: t('studio.sheets.colPii'),
      cell: (row) => (
        <Badge tone={row.includes_pii ? 'warning' : 'neutral'}>
          {row.includes_pii ? t('studio.sheets.piiYes') : t('studio.sheets.piiNo')}
        </Badge>
      ),
    },
    {
      id: 'lastRun',
      header: t('studio.sheets.colLastRun'),
      cell: (row) =>
        row.last_run_at === null ? (
          <Text size="xs" tone="secondary">
            {t('studio.sheets.never')}
          </Text>
        ) : (
          <RelativeTime value={row.last_run_at} />
        ),
    },
    {
      id: 'status',
      header: t('studio.sheets.colStatus'),
      cell: (row) => (
        <Cluster gap={1}>
          {row.last_status === null ? null : (
            <Badge tone={row.last_status === 'FAILED' ? 'warning' : 'neutral'}>
              {row.last_status}
            </Badge>
          )}
          {row.paused_at === null ? null : (
            <Badge tone="warning" data-sheets-paused={row.id}>
              {t('studio.sheets.pausedPill')}
              {row.paused_reason === null ? '' : ` · ${row.paused_reason}`}
            </Badge>
          )}
          {row.is_enabled ? null : <Badge tone="neutral">{t('studio.sheets.disabledPill')}</Badge>}
        </Cluster>
      ),
    },
    {
      id: 'actions',
      header: t('studio.sheets.colActions'),
      cell: (row) => (
        <Cluster gap={2} align="center">
          {mayRun(row) ? (
            <ActionForm action={runNowAction}>
              <input type="hidden" name="definition_id" value={row.id} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={!flagOn || !row.is_enabled || row.paused_at !== null}
                data-sheets-run={row.slug}
              >
                {t('studio.sheets.runNow')}
              </Button>
            </ActionForm>
          ) : null}
          {canManage ? (
            <>
              <ActionForm action={row.paused_at === null ? pauseAction : resumeAction}>
                <input type="hidden" name="definition_id" value={row.id} />
                <Button type="submit" variant="quiet" size="sm" data-sheets-pause-toggle={row.slug}>
                  {row.paused_at === null ? t('studio.sheets.pause') : t('studio.sheets.resume')}
                </Button>
              </ActionForm>
              <ActionForm action={setEnabledAction}>
                <input type="hidden" name="definition_id" value={row.id} />
                <input type="hidden" name="enabled" value={row.is_enabled ? 'false' : 'true'} />
                <Button type="submit" variant="quiet" size="sm">
                  {row.is_enabled ? t('studio.sheets.disable') : t('studio.sheets.enable')}
                </Button>
              </ActionForm>
              <Link
                href={`${PATH}?edit=${row.id}` as Route}
                className="text-sm underline underline-offset-4"
                data-sheets-edit={row.slug}
              >
                {t('studio.sheets.edit')}
              </Link>
            </>
          ) : null}
        </Cluster>
      ),
    },
  ]

  return (
    <StudioPage path={PATH}>
      <Stack gap={6}>
        <Surface level={1} className="p-6" data-sheets-banner={flagOn ? 'on' : 'off'}>
          <Stack gap={2}>
            <Text size="sm" tone="secondary">
              {t('studio.sheets.intro')}
            </Text>
            <Text size="sm">{flagOn ? t('studio.sheets.flagOn') : t('studio.sheets.flagOff')}</Text>
            {spreadsheetId === null || email === null ? (
              <Text size="sm" tone="secondary" data-sheets-not-configured="">
                {t('studio.sheets.notConfigured')}
              </Text>
            ) : (
              <Stack gap={0}>
                <Text size="xs" tone="secondary">
                  {t('studio.sheets.spreadsheetLabel')}: {spreadsheetId}
                </Text>
                <Text size="xs" tone="secondary" data-sheets-service-account="">
                  {t('studio.sheets.serviceAccountLabel')}: {email}
                </Text>
              </Stack>
            )}
          </Stack>
        </Surface>

        <Surface level={1} className="p-6">
          <Stack gap={4}>
            <Cluster gap={3} align="center">
              <PageHeader level={2} title={t('studio.sheets.definitionsHeading')} />
              {canManage && editing === null ? (
                <Link
                  href={`${PATH}?edit=new` as Route}
                  className="text-sm underline underline-offset-4"
                  data-sheets-new=""
                >
                  {t('studio.sheets.formHeadingNew')}
                </Link>
              ) : null}
            </Cluster>
            <DataTable
              caption={t('studio.sheets.definitionsHeading')}
              columns={columns}
              rows={definitions}
              rowKey={(row) => row.id}
              empty={{
                reason: 'empty',
                heading: t('studio.sheets.definitionsEmpty'),
                body: t('studio.sheets.definitionsEmptyBody'),
              }}
            />
            {canRun ? null : (
              <Text size="xs" tone="secondary">
                {t('studio.sheets.needsRun')}
              </Text>
            )}
            {canManage ? null : (
              <Text size="xs" tone="secondary">
                {t('studio.sheets.needsManage')}
              </Text>
            )}
          </Stack>
        </Surface>

        {canManage && editing !== null ? (
          <Surface level={2} className="p-6" data-sheets-form="">
            <ExportDefinitionForm
              entities={entityOptions}
              initial={editing}
              canSetPii={canManage}
              action={saveDefinitionAction}
              cancelHref={PATH}
              labels={{
                heading:
                  editing.id === null
                    ? t('studio.sheets.formHeadingNew')
                    : t('studio.sheets.formHeadingEdit'),
                slug: t('studio.sheets.formSlug'),
                name: t('studio.sheets.formName'),
                entity: t('studio.sheets.formEntity'),
                scope: t('studio.sheets.formScope'),
                columns: t('studio.sheets.formColumns'),
                columnsHelp: t('studio.sheets.formColumnsHelp'),
                filter: t('studio.sheets.formFilter'),
                filterHelp: t('studio.sheets.formFilterHelp'),
                spreadsheet: t('studio.sheets.formSpreadsheet'),
                tab: t('studio.sheets.formTab'),
                schedule: t('studio.sheets.formSchedule'),
                scheduleHelp: t('studio.sheets.formScheduleHelp'),
                pii: t('studio.sheets.formPii'),
                piiHelp: t('studio.sheets.formPiiHelp'),
                save: t('studio.sheets.save'),
                cancel: t('studio.sheets.cancel'),
              }}
            />
          </Surface>
        ) : null}

        <Surface level={1} className="p-6" data-sheets-history="">
          <Stack gap={4}>
            <PageHeader level={2} title={t('studio.sheets.historyHeading')} />
            <SheetsRunHistory runs={runs} definitionNames={definitionNames} flagged={flagged} />
          </Stack>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
