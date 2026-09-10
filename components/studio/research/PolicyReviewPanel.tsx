import { Select } from '@/components/primitives/Select'
import { Textarea } from '@/components/primitives/Textarea'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import { POLICY_DECISIONS } from '@/lib/scraper/core/source-schema'
import type { StudioFormAction } from '@/components/studio/form-state'

/**
 * Where somebody records that Rivya may read a website.
 *
 * THE BANNER IS NOT DECORATION AND IT IS NOT A DISCLAIMER. It is the sentence that keeps this
 * software honest about what it does not know: whether a third party's terms of use permit reading
 * their catalogue is a legal and commercial judgement, and no amount of engineering makes it one
 * this repository can answer. The panel therefore RECORDS a decision; it never suggests one, never
 * defaults one, and never shows a recommended option.
 *
 * THREE OUTCOMES, AND `RESTRICTED` IS THE INTERESTING ONE. Approved-but-limited is the honest
 * answer for a site whose terms permit some access and not all of it, and it is a distinct value
 * rather than "approved with a note" so that a later phase reading `policy_status` cannot mistake it
 * for unqualified permission. Only `APPROVED` satisfies
 * `research_sources_enabled_requires_approval`, so a RESTRICTED source cannot be switched on — that
 * is the conservative reading, and it is the row's, not this panel's.
 *
 * THE ROBOTS FILE IS RENDERED FROM THE CACHE, never fetched to fill this screen. Opening a review
 * panel is not a reason to make a request; if no file has been fetched yet, the panel says so.
 */

export function PolicyReviewPanel({
  sourceId,
  policyStatus,
  policyNotes,
  reviewedAt,
  robotsBody,
  canDecide,
  action,
}: {
  readonly sourceId: string
  readonly policyStatus: string
  readonly policyNotes: string | null
  readonly reviewedAt: string | null
  /** Straight from `research_robots_cache`. Null when nothing has been fetched for this host. */
  readonly robotsBody: string | null
  readonly canDecide: boolean
  readonly action: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader
          level={2}
          title={t('studio.research.policyHeading')}
          actions={
            <Badge tone={policyStatus === 'APPROVED' ? 'success' : 'danger'}>{policyStatus}</Badge>
          }
        />

        {/* The standing OWNER_VERIFICATION_REQUIRED statement, on the screen where somebody would
            otherwise assume the software had checked. */}
        <Text tone="secondary">{t('studio.research.policyOwnerOnlyBody')}</Text>

        <Stack gap={2}>
          <Text size="sm" tone="tertiary">
            {t('studio.research.policyRobots')}
          </Text>
          {robotsBody === null || robotsBody.trim() === '' ? (
            <Text size="sm" tone="secondary" data-robots-missing="">
              {t('studio.research.policyRobotsMissing')}
            </Text>
          ) : (
            <pre
              className="border-line bg-surface-raised max-h-64 overflow-auto border p-3 font-mono text-xs"
              data-robots-body=""
            >
              {robotsBody}
            </pre>
          )}
        </Stack>

        {policyNotes === null || policyNotes.trim() === '' ? null : (
          <Stack gap={2}>
            <Text size="sm" tone="tertiary">
              {t('studio.research.policyNotes')}
            </Text>
            <Text tone="secondary" data-policy-notes="">
              {policyNotes}
            </Text>
            {reviewedAt === null ? null : (
              <Text size="xs" tone="tertiary">
                {reviewedAt.slice(0, 16).replace('T', ' ')}
              </Text>
            )}
          </Stack>
        )}

        {canDecide ? (
          <ActionForm action={action}>
            <Stack gap={3}>
              <input type="hidden" name="id" value={sourceId} />
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.policyDecide')}
                </Text>
                <Select name="status">
                  {/* NO DEFAULT SELECTION THAT MEANS ANYTHING. The first option is the empty one so
                      that submitting without choosing is refused rather than recorded as approval. */}
                  <option value="">—</option>
                  {POLICY_DECISIONS.map((decision) => (
                    <option key={decision} value={decision}>
                      {decision}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.policyNotes')}
                </Text>
                <Text size="xs" tone="tertiary" as="span">
                  {t('studio.research.policyNotesHelp')}
                </Text>
                <Textarea name="notes" rows={5} defaultValue={policyNotes ?? ''} />
              </label>
              <div>
                <Button type="submit" variant="primary">
                  {t('studio.research.policyDecide')}
                </Button>
              </div>
            </Stack>
          </ActionForm>
        ) : null}
      </Stack>
    </Surface>
  )
}
