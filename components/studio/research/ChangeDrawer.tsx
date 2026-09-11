import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import type { StudioFormAction } from '@/components/studio/form-state'
import type { ChangeRow } from '@/lib/supabase/repositories/research/changes'
import type { NoteRow, TagRow } from '@/lib/supabase/repositories/research/review'

/**
 * One change, its two sides, and the nine things a person may do about it.
 *
 * BEFORE AND AFTER ARE RENDERED FROM THE STORED VALUES, NOT RE-DERIVED. The detector stored the
 * compared values as jsonb precisely so that this screen is a rendering decision and not a second
 * parse — "which axis moved" is answerable here because `before` and `after` are the objects the
 * rule compared, and six months from now they will still be, whatever the normaliser does next.
 *
 * THE SNAPSHOT LINKS ARE THE POINT OF THE WHOLE DESIGN. A change record is an assertion about
 * somebody else's business, and an assertion like that is worth nothing if it cannot be checked.
 * Both gzipped pages are named here; a null key means the snapshot has aged out at 180 days, which
 * is said rather than shown as a broken link.
 *
 * A SERVER COMPONENT. Every action is a form posting to a Server Action, so the drawer needs no
 * client JavaScript at all — which also means an action works with the keyboard, without
 * JavaScript, and in a screen reader, for free rather than by effort.
 */

const MATERIALITY_TONE: Readonly<Record<string, 'danger' | 'warning' | 'neutral'>> = {
  MATERIAL: 'danger',
  MINOR: 'warning',
  NOISE: 'neutral',
}

/**
 * A stored jsonb value, as a person reads it.
 *
 * NOT `JSON.stringify`, because the commonest values here are a price object and a dimensions
 * object and both read terribly as JSON. An array becomes a list, an object becomes `key value`
 * pairs, and anything else is its own string — which covers the eleven fields this phase diffs
 * without inventing a formatter per field.
 */
export function readable(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map(String).join(', ')
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, entry]) => entry !== null && entry !== undefined,
    )
    return entries.length === 0
      ? '—'
      : entries.map(([key, entry]) => `${key} ${String(entry)}`).join(' · ')
  }
  return String(value)
}

function Side({ label, value }: { readonly label: string; readonly value: unknown }) {
  return (
    <div>
      <Text size="xs" tone="secondary" as="span">
        {label}
      </Text>
      <Text size="sm" className="break-words">
        {readable(value)}
      </Text>
    </div>
  )
}

export interface ChangeDrawerActions {
  readonly review: StudioFormAction
  readonly ignore: StudioFormAction
  readonly shortlist: StudioFormAction
  readonly reject: StudioFormAction
  readonly confirm: StudioFormAction
  readonly note: StudioFormAction
  readonly tag: StudioFormAction
  readonly undo: StudioFormAction
}

export function ChangeDrawer({
  change,
  productLabel,
  sourceName,
  notes,
  tags,
  appliedTagIds,
  canConfirm,
  actions,
}: {
  readonly change: ChangeRow
  readonly productLabel: string
  readonly sourceName: string
  readonly notes: readonly NoteRow[]
  readonly tags: readonly TagRow[]
  readonly appliedTagIds: ReadonlySet<string>
  readonly canConfirm: boolean
  readonly actions: ChangeDrawerActions
}) {
  const tone = MATERIALITY_TONE[change.materiality] ?? 'neutral'

  return (
    <Surface level={1} className="p-6" data-change-drawer={change.id}>
      <Stack gap={5}>
        <Stack gap={2}>
          <PageHeader level={2} title={productLabel} description={sourceName} />
          <Cluster gap={2}>
            <Badge tone={tone}>{change.materiality}</Badge>
            <Badge tone="neutral">{change.field}</Badge>
            <Badge tone="neutral">{change.change_kind}</Badge>
            {change.decided_action === null ? null : (
              <Badge tone="info">{change.decided_action}</Badge>
            )}
          </Cluster>
        </Stack>

        <Stack gap={2}>
          <Text size="sm" tone="secondary">
            {t('studio.research.changeBefore')} / {t('studio.research.changeAfter')}
          </Text>
          <div className="grid gap-4 sm:grid-cols-2" data-change-diff="">
            <Side label={t('studio.research.changeBefore')} value={change.before} />
            <Side label={t('studio.research.changeAfter')} value={change.after} />
          </div>
        </Stack>

        <Stack gap={1}>
          <Text size="xs" tone="secondary">
            {t('studio.research.changeSnapshots')}
          </Text>
          <Text size="xs" tone="secondary" className="break-words">
            {change.snapshot_before_key ?? 'pruned at 180 days'} →{' '}
            {change.snapshot_after_key ?? 'pruned at 180 days'}
          </Text>
        </Stack>

        {canConfirm ? (
          <Stack gap={3} data-change-actions="">
            <Cluster gap={2}>
              <ActionForm action={actions.review}>
                <input type="hidden" name="change_id" value={change.id} />
                <input type="hidden" name="product_id" value={change.research_product_id} />
                <Button type="submit" variant="quiet" size="sm" data-action="review">
                  {t('studio.research.actionReview')}
                </Button>
              </ActionForm>
              <ActionForm action={actions.shortlist}>
                <input type="hidden" name="change_id" value={change.id} />
                <input type="hidden" name="product_id" value={change.research_product_id} />
                <Button type="submit" variant="quiet" size="sm" data-action="shortlist">
                  {t('studio.research.actionShortlist')}
                </Button>
              </ActionForm>
            </Cluster>

            {/* IGNORE AND REJECT DEMAND A REASON, HERE AND AT THE ROW. Both close a row without
                another read, and a queue emptied for unrecorded reasons is a queue whose
                emptiness means nothing. The database refuses one without a reason too. */}
            <ActionForm action={actions.ignore}>
              <input type="hidden" name="change_id" value={change.id} />
              <input type="hidden" name="product_id" value={change.research_product_id} />
              <Cluster gap={2} align="end">
                <label className="flex flex-1 flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.reasonRequired')}
                  </Text>
                  <Input name="reason" required />
                </label>
                <Button type="submit" variant="quiet" size="sm" data-action="ignore">
                  {t('studio.research.actionIgnore')}
                </Button>
              </Cluster>
            </ActionForm>

            <ActionForm action={actions.reject}>
              <input type="hidden" name="change_id" value={change.id} />
              <input type="hidden" name="product_id" value={change.research_product_id} />
              <Cluster gap={2} align="end">
                <label className="flex flex-1 flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.reasonRequired')}
                  </Text>
                  <Input name="reason" required />
                </label>
                <Button type="submit" variant="quiet" size="sm" data-action="reject">
                  {t('studio.research.actionReject')}
                </Button>
              </Cluster>
            </ActionForm>

            {/* THE CONFIRM DIALOG SAYS WHAT CONFIRMING DOES NOT DO, from seeded copy. One of the
                four never-auto-import guarantees, and the one aimed at people. */}
            <ActionForm action={actions.confirm}>
              <input type="hidden" name="change_id" value={change.id} />
              <input type="hidden" name="product_id" value={change.research_product_id} />
              <Stack gap={2}>
                <Text size="xs" tone="secondary">
                  {t('studio.research.confirmMeaning')}
                </Text>
                <Button type="submit" variant="quiet" size="sm" data-action="confirm">
                  {t('studio.research.actionConfirm')}
                </Button>
              </Stack>
            </ActionForm>

            <ActionForm action={actions.note}>
              <input type="hidden" name="change_id" value={change.id} />
              <input type="hidden" name="product_id" value={change.research_product_id} />
              <Cluster gap={2} align="end">
                <label className="flex flex-1 flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.actionNote')}
                  </Text>
                  <Input name="body" required data-note-body="" />
                </label>
                <Button type="submit" variant="quiet" size="sm" data-action="note">
                  {t('studio.research.actionNote')}
                </Button>
              </Cluster>
            </ActionForm>

            {tags.length === 0 ? null : (
              <ActionForm action={actions.tag}>
                <input type="hidden" name="change_id" value={change.id} />
                <input type="hidden" name="product_id" value={change.research_product_id} />
                <Cluster gap={2} align="end">
                  <label className="flex flex-1 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.actionTag')}
                    </Text>
                    <Select name="tag_id">
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {appliedTagIds.has(tag.id) ? `${tag.label} (applied)` : tag.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button type="submit" variant="quiet" size="sm" data-action="tag">
                    {t('studio.research.actionTag')}
                  </Button>
                </Cluster>
              </ActionForm>
            )}
          </Stack>
        ) : (
          <Text size="sm" tone="secondary">
            {t('studio.research.decidedElsewhere')}
          </Text>
        )}

        {notes.length === 0 ? null : (
          <Stack gap={2} data-change-notes="">
            {notes.map((note) => (
              <Text
                key={note.id}
                size="sm"
                tone={note.superseded_by === null ? 'primary' : 'secondary'}
              >
                {note.body}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Surface>
  )
}
