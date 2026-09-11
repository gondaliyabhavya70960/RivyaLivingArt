'use client'

import { useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Heading } from '@/components/primitives/Heading'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import type { StudioFormAction } from '@/components/studio/form-state'

/**
 * RC-336 `ExportDefinitionForm` — entity, a column picker from that entity's allowlist, a filter,
 * the destination tab, the schedule and the PII toggle.
 *
 * A CLIENT ISLAND FOR ONE REASON: the column checkboxes follow the entity select. Everything else
 * is a plain form the Server Action validates again — the allowlist, the schedule, the JSON, the
 * scope — and RLS judges the write as the person. The PII toggle renders only for the Enquiries
 * entity and only for a role that may manage definitions; the action refuses it regardless.
 */

export interface EntityOption {
  readonly key: string
  readonly label: string
  readonly requiresScope: boolean
  readonly columns: readonly {
    readonly key: string
    readonly label: string
    readonly pii: boolean
  }[]
}

export interface DefinitionFormValues {
  readonly id: string | null
  readonly slug: string
  readonly name: string
  readonly entity: string
  readonly scopeId: string
  readonly columns: readonly string[]
  readonly filter: string
  readonly spreadsheetId: string
  readonly tabName: string
  readonly schedule: string
  readonly includesPii: boolean
}

export function ExportDefinitionForm({
  entities,
  initial,
  canSetPii,
  action,
  cancelHref,
  labels,
}: {
  readonly entities: readonly EntityOption[]
  readonly initial: DefinitionFormValues
  readonly canSetPii: boolean
  readonly action: StudioFormAction
  readonly cancelHref: string
  readonly labels: {
    readonly heading: string
    readonly slug: string
    readonly name: string
    readonly entity: string
    readonly scope: string
    readonly columns: string
    readonly columnsHelp: string
    readonly filter: string
    readonly filterHelp: string
    readonly spreadsheet: string
    readonly tab: string
    readonly schedule: string
    readonly scheduleHelp: string
    readonly pii: string
    readonly piiHelp: string
    readonly save: string
    readonly cancel: string
  }
}) {
  const [entity, setEntity] = useState(initial.entity)
  const selected = entities.find((option) => option.key === entity) ?? entities[0]
  const chosen = new Set(initial.columns)

  return (
    <ActionForm action={action}>
      <Stack gap={4}>
        <Heading level={3} size="display-xs">
          {labels.heading}
        </Heading>
        {initial.id === null ? null : (
          <input type="hidden" name="definition_id" value={initial.id} />
        )}

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.slug}
          </Text>
          <Input name="slug" defaultValue={initial.slug} required data-sheets-slug="" />
        </label>

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.name}
          </Text>
          <Input name="name" defaultValue={initial.name} required data-sheets-name="" />
        </label>

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.entity}
          </Text>
          <Select
            name="entity"
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            data-sheets-entity=""
          >
            {entities.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        {selected?.requiresScope === true ? (
          <label className="flex max-w-md flex-col gap-1">
            <Text size="xs" tone="secondary" as="span">
              {labels.scope}
            </Text>
            <Input name="scope_id" defaultValue={initial.scopeId} data-sheets-scope="" />
          </label>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend>
            <Text size="xs" tone="secondary" as="span">
              {labels.columns}
            </Text>
          </legend>
          <Text size="xs" tone="secondary">
            {labels.columnsHelp}
          </Text>
          <div className="grid gap-1 sm:grid-cols-2">
            {(selected?.columns ?? []).map((column) => (
              <label key={column.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="columns"
                  value={column.key}
                  defaultChecked={chosen.has(column.key)}
                  data-sheets-column={column.key}
                />
                <Text size="xs" as="span">
                  {column.label}
                  {column.pii ? ' · personal data' : ''}
                </Text>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.filter}
          </Text>
          <textarea
            name="filter"
            rows={3}
            defaultValue={initial.filter}
            className="border-line bg-surface border px-3 py-2 font-mono text-sm"
            data-sheets-filter=""
          />
          <Text size="xs" tone="secondary" as="span">
            {labels.filterHelp}
          </Text>
        </label>

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.spreadsheet}
          </Text>
          <Input
            name="spreadsheet_id"
            defaultValue={initial.spreadsheetId}
            data-sheets-spreadsheet=""
          />
        </label>

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.tab}
          </Text>
          <Input name="tab_name" defaultValue={initial.tabName} required data-sheets-tab="" />
        </label>

        <label className="flex max-w-md flex-col gap-1">
          <Text size="xs" tone="secondary" as="span">
            {labels.schedule}
          </Text>
          <Input name="schedule" defaultValue={initial.schedule} required data-sheets-schedule="" />
          <Text size="xs" tone="secondary" as="span">
            {labels.scheduleHelp}
          </Text>
        </label>

        {selected?.key === 'INQUIRIES' && canSetPii ? (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="includes_pii"
              value="true"
              defaultChecked={initial.includesPii}
              data-sheets-pii=""
            />
            <Stack gap={0}>
              <Text size="xs" as="span">
                {labels.pii}
              </Text>
              <Text size="xs" tone="secondary" as="span">
                {labels.piiHelp}
              </Text>
            </Stack>
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="sm" data-sheets-save="">
            {labels.save}
          </Button>
          <a href={cancelHref} className="text-sm underline underline-offset-4">
            {labels.cancel}
          </a>
        </div>
      </Stack>
    </ActionForm>
  )
}
