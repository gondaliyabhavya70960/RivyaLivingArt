import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { HelpText } from '@/components/primitives/HelpText'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable } from '@/components/studio/DataTable'
import { SelectField, TextField } from '@/components/studio/FormField'
import type { StudioFormAction } from '@/components/studio/form-state'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import type { ResolvedSlot } from '@/lib/cms/merchandising'
import { MERCH_FALLBACK_MODES, slotSpec } from '@/lib/cms/merchandising-register'
import type { MerchandisingEntry, MerchandisingSlot } from '@/lib/supabase/schemas'

import { EntryControls } from './EntryControls'

/**
 * One slot, edited whole: its entries in order, what can be added, its settings, and what the
 * public sees right now.
 *
 * A SERVER COMPONENT THAT RENDERS WORDS IT RESOLVED and hands the client controls their labels.
 * The three screens that own slots draw this once per slot; nothing here decides which slots a
 * screen may draw — `listSlotsOwnedBy` decided that, and the actions refuse a slot posted to the
 * wrong screen regardless.
 *
 * THE PICKER IS A `<select>`, NOT A SEARCH. The candidates are the published rows of the types the
 * slot admits — a few dozen at most on this catalogue — grouped by type, so a slot admitting
 * products and collections has one control. A typed search is a Client Component with a fetch
 * behind it, and Phase 23 owns search; a select works with no JavaScript and offers exactly what
 * the resolver will show. Concept collections are absent from it and the note beside it says why.
 *
 * THE PREVIEW IS THE RESOLVER'S OWN ANSWER, read with the public client by the page and passed in,
 * so "what the public currently sees" is what the public currently gets — provenance included —
 * and not the editor's guess from the table above it.
 */
export type Candidate = {
  readonly type: MerchandisingSlot['allowed_entity_types'][number]
  readonly id: string
  readonly label: string
}

export type EntryLabel = {
  readonly title: string
  readonly status: string | null
}

export type SlotEditorProps = {
  readonly slot: MerchandisingSlot
  readonly entries: readonly MerchandisingEntry[]
  /** By `${entity_type}:${entity_id}`. An entry with no label names something this session cannot see. */
  readonly labels: ReadonlyMap<string, EntryLabel>
  readonly candidates: readonly Candidate[]
  readonly preview: ResolvedSlot
  readonly route: string
  readonly canWrite: boolean
  readonly addAction: StudioFormAction
  readonly entryAction: StudioFormAction
  readonly settingsAction: StudioFormAction
  /** Shown beside the picker when concept collections were withheld from it. */
  readonly conceptsWithheld?: boolean
}

function windowLabel(entry: MerchandisingEntry): string {
  if (entry.publish_at === null && entry.unpublish_at === null) {
    return t('studio.merchandising.entry.noWindow')
  }
  const from =
    entry.publish_at === null
      ? ''
      : `${t('studio.merchandising.entry.from')} ${entry.publish_at.slice(0, 16)}`
  const until =
    entry.unpublish_at === null
      ? ''
      : `${t('studio.merchandising.entry.until')} ${entry.unpublish_at.slice(0, 16)}`
  return [from, until].filter(Boolean).join(' · ')
}

const TYPE_LABEL: Record<Candidate['type'], string> = {
  PRODUCT: 'Product',
  COLLECTION: 'Collection',
  CATEGORY: 'Category',
  JOURNAL_ARTICLE: 'Article',
  PORTFOLIO_PROJECT: 'Project',
  MATERIAL: 'Material',
}

export function SlotEditor({
  slot,
  entries,
  labels,
  candidates,
  preview,
  route,
  canWrite,
  addAction,
  entryAction,
  settingsAction,
  conceptsWithheld = false,
}: SlotEditorProps): React.ReactElement {
  const spec = slotSpec(slot.key)
  const present = new Set(entries.map((entry) => `${entry.entity_type}:${entry.entity_id}`))
  const offered = candidates.filter(
    (candidate) => !present.has(`${candidate.type}:${candidate.id}`),
  )
  const byType = new Map<Candidate['type'], Candidate[]>()
  for (const candidate of offered) {
    const list = byType.get(candidate.type) ?? []
    list.push(candidate)
    byType.set(candidate.type, list)
  }

  const controlLabels = {
    moveUp: t('studio.merchandising.entry.moveUp'),
    moveDown: t('studio.merchandising.entry.moveDown'),
    remove: t('studio.merchandising.entry.remove'),
    publish: t('studio.merchandising.entry.publish'),
    unpublish: t('studio.merchandising.entry.unpublish'),
    pin: t('studio.merchandising.entry.pin'),
    unpin: t('studio.merchandising.entry.unpin'),
    windowHeading: t('studio.merchandising.entry.windowHeading'),
    publishAt: t('studio.merchandising.entry.publishAt'),
    unpublishAt: t('studio.merchandising.entry.unpublishAt'),
    windowHelp: t('studio.merchandising.entry.windowHelp'),
    note: t('studio.merchandising.entry.note'),
    saveWindow: t('studio.merchandising.entry.saveWindow'),
  }

  return (
    <Stack gap={6} data-slot-editor={slot.key}>
      <PageHeader level={2} title={slot.name} description={slot.description ?? undefined} />
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-tertiary">{t('studio.merchandising.slot.key')}</dt>
          <dd>
            <code>{slot.key}</code>
          </dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">{t('studio.merchandising.slot.surface')}</dt>
          <dd>
            <Link href={slot.surface as Route} className="underline underline-offset-4">
              {slot.surface}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">{t('studio.merchandising.slot.readBy')}</dt>
          <dd>{spec?.readBy ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">{t('studio.merchandising.slot.types')}</dt>
          <dd>{slot.allowed_entity_types.map((type) => TYPE_LABEL[type]).join(', ')}</dd>
        </div>
      </dl>

      <DataTable<MerchandisingEntry>
        caption={t('studio.merchandising.entries.caption')}
        rows={entries}
        rowKey={(entry) => entry.id}
        empty={{
          reason: 'empty',
          heading: t('studio.merchandising.entries.emptyHeading'),
          body: t('studio.merchandising.entries.emptyBody'),
        }}
        columns={[
          {
            id: 'entity',
            header: t('studio.merchandising.entries.colEntity'),
            cell: (entry) =>
              labels.get(`${entry.entity_type}:${entry.entity_id}`)?.title ??
              t('studio.merchandising.entry.unknownTarget'),
          },
          {
            id: 'type',
            header: t('studio.merchandising.entries.colType'),
            cell: (entry) => TYPE_LABEL[entry.entity_type],
          },
          {
            id: 'status',
            header: t('studio.merchandising.entries.colStatus'),
            cell: (entry) => <StatusPill status={entry.status} />,
          },
          {
            id: 'window',
            header: t('studio.merchandising.entries.colWindow'),
            cell: (entry) => windowLabel(entry),
          },
          {
            id: 'pinned',
            header: t('studio.merchandising.entries.colPinned'),
            cell: (entry) => (entry.is_pinned ? '●' : '—'),
          },
          {
            id: 'actions',
            header: t('studio.merchandising.entries.colActions'),
            cell: (entry) => {
              const index = entries.findIndex((candidate) => candidate.id === entry.id)
              return (
                <EntryControls
                  entryId={entry.id}
                  route={route}
                  status={entry.status}
                  pinned={entry.is_pinned}
                  isFirst={index === 0}
                  isLast={index === entries.length - 1}
                  publishAt={entry.publish_at}
                  unpublishAt={entry.unpublish_at}
                  note={entry.note}
                  canWrite={canWrite}
                  action={entryAction}
                  labels={controlLabels}
                />
              )
            },
          },
        ]}
      />

      {canWrite ? (
        <ActionForm action={addAction}>
          <Stack gap={3}>
            <PageHeader level={3} title={t('studio.merchandising.add.heading')} />
            <input type="hidden" name="slot_id" value={slot.id} />
            <input type="hidden" name="route" value={route} />
            {offered.length === 0 ? (
              <HelpText>{t('studio.merchandising.add.nothingToOffer')}</HelpText>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('studio.merchandising.add.entity')}</span>
                <Select name="entity" required>
                  {[...byType.entries()].map(([type, list]) => (
                    <optgroup key={type} label={TYPE_LABEL[type]}>
                      {list.map((candidate) => (
                        <option key={candidate.id} value={`${candidate.type}:${candidate.id}`}>
                          {candidate.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </label>
            )}
            <HelpText>{t('studio.merchandising.add.publishedOnly')}</HelpText>
            {conceptsWithheld ? (
              <HelpText>{t('studio.merchandising.add.conceptsNote')}</HelpText>
            ) : null}
            <div>
              <Button type="submit" variant="primary" disabled={offered.length === 0}>
                {t('studio.merchandising.add.submit')}
              </Button>
            </div>
          </Stack>
        </ActionForm>
      ) : null}

      {canWrite ? (
        <ActionForm action={settingsAction}>
          <Stack gap={3}>
            <PageHeader level={3} title={t('studio.merchandising.settings.heading')} />
            <input type="hidden" name="slot_id" value={slot.id} />
            <input type="hidden" name="route" value={route} />
            <TextField
              name="min_items"
              label={t('studio.merchandising.settings.minItems')}
              defaultValue={String(slot.min_items)}
            />
            <TextField
              name="max_items"
              label={t('studio.merchandising.settings.maxItems')}
              defaultValue={String(slot.max_items)}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="auto_fill" defaultChecked={slot.auto_fill} />
              <span>{t('studio.merchandising.settings.autoFill')}</span>
            </label>
            <HelpText>{t('studio.merchandising.settings.autoFillHelp')}</HelpText>
            <TextField
              name="auto_fill_rule"
              label={t('studio.merchandising.settings.autoFillRule')}
              defaultValue={slot.auto_fill_rule ?? ''}
            />
            <SelectField
              name="fallback_mode"
              label={t('studio.merchandising.settings.fallbackMode')}
              defaultValue={slot.fallback_mode}
              options={MERCH_FALLBACK_MODES.map((mode) => ({
                value: mode,
                label: t(`studio.merchandising.settings.fallback.${mode}`),
              }))}
            />
            <TextField
              name="fallback_section_id"
              label={t('studio.merchandising.settings.fallbackSection')}
              help={t('studio.merchandising.settings.fallbackSectionHelp')}
              defaultValue={slot.fallback_section_id ?? ''}
            />
            <div>
              <Button type="submit">{t('studio.merchandising.settings.save')}</Button>
            </div>
          </Stack>
        </ActionForm>
      ) : null}

      <SlotPreview preview={preview} />
    </Stack>
  )
}

/** What the public sees now, from the resolver itself. */
export function SlotPreview({ preview }: { readonly preview: ResolvedSlot }): React.ReactElement {
  return (
    <Stack gap={2} data-slot-preview={preview.key} data-provenance={preview.provenance}>
      <PageHeader level={3} title={t('studio.merchandising.preview.heading')} />
      {preview.reason === 'UNKNOWN_SLOT' ? (
        <Text size="sm" tone="secondary">
          {t('studio.merchandising.preview.unknownSlot')}
        </Text>
      ) : (
        <>
          <Text size="sm">
            {t(`studio.merchandising.preview.provenance.${preview.provenance}`)}
          </Text>
          {preview.rule === null ? null : (
            <Text size="sm" tone="secondary">
              {t('studio.merchandising.preview.rule')}: {preview.rule}
            </Text>
          )}
          {preview.fallback === null ? null : (
            <Text size="sm" tone="secondary">
              {t(`studio.merchandising.settings.fallback.${preview.fallback.mode}`)}
            </Text>
          )}
          {preview.cards.length === 0 ? (
            <Text size="sm" tone="secondary">
              {t('studio.merchandising.preview.empty')}
            </Text>
          ) : (
            <ol className="list-decimal pl-5 text-sm">
              {preview.cards.map((card) => (
                <li key={card.id} data-preview-card={card.key}>
                  {card.title}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Stack>
  )
}
