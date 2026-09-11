import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { Textarea } from '@/components/primitives/Textarea'
import { ActionForm } from '@/components/studio/ActionForm'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { EVIDENCE_TYPES, type EvidenceType } from '@/lib/scraper/analytics/direction/capture'

/**
 * RC-331 `EvidenceRail` — what is attached, why, and whether it has moved.
 *
 * Every row shows its type, a label built from the captured value, the rationale the person
 * wrote, when it was attached, and — for a volatile kind — a "changed since attachment" marker
 * beside the current value. Attaching takes a rationale, always: the table refuses an empty one
 * and so does the action. Nothing here renders a competitor image; a research row is a link and
 * a label, never a picture.
 */

export interface EvidenceView {
  readonly id: string
  readonly type: EvidenceType
  readonly label: string
  readonly rationale: string
  readonly capturedAt: string
  readonly drift: { readonly changed: boolean; readonly current: string | null } | null
}

export interface AttachOption {
  readonly value: string
  readonly label: string
}

export interface AttachGroup {
  readonly type: EvidenceType
  readonly label: string
  readonly options: readonly AttachOption[]
}

export function EvidenceRail({
  briefId,
  evidence,
  groups,
  canWrite,
  actions,
}: {
  readonly briefId: string
  readonly evidence: readonly EvidenceView[]
  readonly groups: readonly AttachGroup[]
  readonly canWrite: boolean
  readonly actions: {
    readonly attach: StudioFormAction
    readonly detach: (form: FormData) => Promise<void>
  }
}) {
  return (
    <Surface level={1} className="p-6" data-evidence-rail="">
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2} size="display-xs">
            {t('studio.research.dirEvidenceHeading')}
          </Heading>
          <Text size="xs" tone="secondary">
            {t('studio.research.dirEvidenceHelp')}
          </Text>
        </Stack>

        {evidence.length === 0 ? (
          <Text size="sm" tone="secondary" data-evidence-empty="">
            {t('studio.research.dirEvidenceEmpty')}
          </Text>
        ) : (
          <ul className="m-0 list-none p-0">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="border-line border-t py-3"
                data-evidence-row={item.type}
                data-evidence-id={item.id}
              >
                <Stack gap={1}>
                  <Cluster gap={2}>
                    <Badge tone="neutral">{item.type}</Badge>
                    <Text size="sm" as="span" data-evidence-label="">
                      {item.label}
                    </Text>
                    {item.drift?.changed === true ? (
                      <Badge tone="warning" data-evidence-drift="">
                        {t('studio.research.dirDrift')}
                      </Badge>
                    ) : null}
                  </Cluster>
                  {item.drift?.changed === true && item.drift.current !== null ? (
                    <Text size="xs" tone="secondary" data-evidence-current="">
                      {`${t('studio.research.dirNow')}: ${item.drift.current}`}
                    </Text>
                  ) : null}
                  <Text size="sm" tone="secondary" data-evidence-rationale="">
                    {item.rationale}
                  </Text>
                  <Cluster gap={2}>
                    <Text size="xs" tone="secondary" as="span">
                      {`${t('studio.research.dirCapturedAt')} ${item.capturedAt.slice(0, 10)}`}
                    </Text>
                    {canWrite ? (
                      <form action={actions.detach} className="contents">
                        <input type="hidden" name="brief_id" value={briefId} />
                        <input type="hidden" name="evidence_row_id" value={item.id} />
                        <Button type="submit" variant="secondary" size="sm" data-evidence-detach="">
                          {t('studio.research.dirDetach')}
                        </Button>
                      </form>
                    ) : null}
                  </Cluster>
                </Stack>
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <Stack gap={4} data-evidence-attach="">
            <ActionForm action={actions.attach}>
              <input type="hidden" name="brief_id" value={briefId} />
              <Stack gap={2}>
                <Text size="sm" as="span">
                  {`${t('studio.research.dirAttach')} — ${t('studio.research.dirAttachFromLists')}`}
                </Text>
                <label className="flex flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.dirAttachItem')}
                  </Text>
                  <Select name="evidence_ref" defaultValue="" required>
                    <option value="" disabled>
                      —
                    </option>
                    {groups.map((group) => (
                      <optgroup key={group.type} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option.value} value={`${group.type}:${option.value}`}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.dirRationale')}
                  </Text>
                  <Textarea name="rationale" rows={2} required />
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.dirRationaleHelp')}
                  </Text>
                </label>
                <div>
                  <Button type="submit" variant="secondary" size="sm" data-evidence-attach-lists="">
                    {t('studio.research.dirAttach')}
                  </Button>
                </div>
              </Stack>
            </ActionForm>

            <ActionForm action={actions.attach}>
              <input type="hidden" name="brief_id" value={briefId} />
              <Stack gap={2}>
                <Text size="sm" as="span">
                  {`${t('studio.research.dirAttach')} — ${t('studio.research.dirAttachById')}`}
                </Text>
                <Cluster gap={2} align="end">
                  <label className="flex min-w-48 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.dirAttachType')}
                    </Text>
                    <Select name="evidence_type" defaultValue="RESEARCH_PRODUCT">
                      {EVIDENCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex min-w-72 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.dirAttachId')}
                    </Text>
                    <Input name="evidence_id" required />
                  </label>
                </Cluster>
                <label className="flex flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.dirRationale')}
                  </Text>
                  <Textarea name="rationale" rows={2} required />
                </label>
                <div>
                  <Button type="submit" variant="secondary" size="sm" data-evidence-attach-id="">
                    {t('studio.research.dirAttach')}
                  </Button>
                </div>
              </Stack>
            </ActionForm>
          </Stack>
        ) : null}
      </Stack>
    </Surface>
  )
}
