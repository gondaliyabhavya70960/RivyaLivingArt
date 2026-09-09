import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Textarea } from '@/components/primitives/Textarea'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { summariseAnswers } from '@/lib/cms/forms'
import { getFormById } from '@/lib/supabase/repositories/customization-forms'
import {
  getInquiryForStudio,
  listInquiryAttachments,
  listInquiryEvents,
} from '@/lib/supabase/repositories/inquiries'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

import { addInquiryNoteAction, assignInquiryAction, setInquiryStatusAction } from './actions'

/**
 * /studio/inquiries/all/[inquiryId] — one enquiry, in full.
 *
 * THE PATH IS BENEATH `all/` AND THE PHASE DOCUMENT SAYS `/studio/inquiries/[inquiryId]`. D4 names
 * five leaves under `/studio/inquiries` and no leaf of that name, so a detail route directly beneath
 * the GROUP would sit under a prefix the navigation manifest does not name — and
 * `tests/unit/studio-nav.test.ts` refuses that by design: its exemption is "a dynamic segment must
 * sit directly beneath a route the manifest NAMES", which is what stops an ungoverned surface being
 * added by putting brackets in its name. `all` is the view that contains every enquiry, so it is
 * the honest parent, and the rule did not have to be weakened to accommodate the route.
 *
 * THE ANSWERS ARE RENDERED AGAINST THE FORM THAT PRODUCED THEM, not as raw JSON. `answers` is a
 * map of field keys to stored values — `{"project_type":"console_table"}` — and a studio reading
 * that learns nothing. `summariseAnswers` turns it back into the questions as they were asked and
 * the answers as a person chose them, using the form definition the enquiry names. If the form has
 * since been deleted, the raw map is shown rather than nothing: a brief nobody can read is still
 * better than a brief nobody can see.
 *
 * THE HASHED ADDRESS AND THE BROWSER STRING ARE NOT ON THIS PAGE. They exist to catch abuse and are
 * readable in the database by the two roles that need them; putting them on the screen would make
 * them ordinary, and the export omits them for the same reason.
 *
 * NOTHING HERE DELETES. `SPAM` and `ARCHIVED` are statuses, so a judgement can be reversed.
 */
export const metadata = studioMetadata('/studio/inquiries/all')

const STATUSES = [
  'NEW',
  'READ',
  'IN_CONVERSATION',
  'QUOTED',
  'WON',
  'LOST',
  'SPAM',
  'ARCHIVED',
] as const

export default async function Page({
  params,
}: {
  readonly params: Promise<{ inquiryId: string }>
}) {
  const session = await requirePermission('inquiries.read')
  const { inquiryId } = await params

  const client = await createClient()
  const inquiry = await getInquiryForStudio(client, inquiryId)
  if (inquiry === null) notFound()

  const [attachments, events] = await Promise.all([
    listInquiryAttachments(client, inquiry.id),
    listInquiryEvents(client, inquiry.id),
  ])

  const assets = await listMediaAssetsByIds(
    client,
    attachments.map((attachment) => attachment.media_asset_id),
  )

  const form =
    inquiry.customization_form_id === null
      ? null
      : await getFormById(client, inquiry.customization_form_id).catch(() => null)

  const answers =
    inquiry.answers !== null &&
    typeof inquiry.answers === 'object' &&
    !Array.isArray(inquiry.answers)
      ? (inquiry.answers as Record<string, unknown>)
      : {}

  const brief = form === null ? [] : summariseAnswers(form, answers)
  const canWrite = roleHasPermission(session.role, 'inquiries.write')

  return (
    <StudioPage path="/studio/inquiries/all">
      <Stack gap={8}>
        <PageHeader
          level={1}
          title={inquiry.reference_code}
          description={`${inquiry.kind} · ${inquiry.pipeline_status}`}
        />

        <Link href={'/studio/inquiries/all' as Route} className="underline underline-offset-4">
          <Text size="sm" as="span">
            {t('studio.inquiry.back')}
          </Text>
        </Link>

        <Divider />

        <PageHeader level={2} title={t('studio.inquiry.contactHeading')} />
        <Stack gap={2}>
          <Text size="sm">{inquiry.name}</Text>
          <Text size="sm">
            {t('studio.inquiry.phone')}: {inquiry.phone}
          </Text>
          {inquiry.email === null ? null : (
            <Text size="sm">
              {t('studio.inquiry.email')}: {inquiry.email}
            </Text>
          )}
          {inquiry.city === null ? null : (
            <Text size="sm">
              {t('studio.inquiry.city')}: {inquiry.city}
            </Text>
          )}
          {inquiry.enquiry_type === null ? null : (
            <Text size="sm">
              {t('studio.inquiry.enquiryType')}: {inquiry.enquiry_type}
            </Text>
          )}
          <Text size="xs" tone="secondary">
            {t('studio.inquiry.received')}: <RelativeTime value={inquiry.created_at} />
          </Text>
          {inquiry.source_path === null ? null : (
            <Text size="xs" tone="secondary">
              {t('studio.inquiry.sourcePath')}: {inquiry.source_path}
            </Text>
          )}
          <Text size="xs" tone="secondary" data-whatsapp-state={inquiry.whatsapp_state}>
            {t('studio.inquiry.whatsapp')}: {inquiry.whatsapp_state}
            {inquiry.whatsapp_shortened_at_level === null
              ? ''
              : ` (${inquiry.whatsapp_shortened_at_level})`}
          </Text>
        </Stack>

        {inquiry.message === null ? null : (
          <>
            <Divider />
            <PageHeader level={2} title={t('studio.inquiry.messageHeading')} />
            <Text size="sm">{inquiry.message}</Text>
          </>
        )}

        <Divider />

        <PageHeader level={2} title={t('studio.inquiry.answersHeading')} />
        {brief.length === 0 ? (
          Object.keys(answers).length === 0 ? (
            <Text size="sm" tone="secondary">
              {t('studio.inquiry.answersEmpty')}
            </Text>
          ) : (
            /*
             * THE RAW MAP, WHEN THE FORM IS GONE. A brief nobody can read is still better than a
             * brief nobody can see — the studio can work out what was meant, and could not work out
             * anything from an empty panel.
             */
            <pre className="overflow-x-auto text-xs" data-inquiry-answers-raw>
              {JSON.stringify(answers, null, 2)}
            </pre>
          )
        ) : (
          <Stack gap={2}>
            {brief.map((line) => (
              <Text key={line.fieldKey} size="sm" data-inquiry-answer={line.fieldKey}>
                {line.label}: {line.value}
              </Text>
            ))}
          </Stack>
        )}

        <Divider />

        <PageHeader level={2} title={t('studio.inquiry.attachmentsHeading')} />
        {attachments.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.inquiry.attachmentsEmpty')}
          </Text>
        ) : (
          <Stack gap={2}>
            {attachments.map((attachment) => (
              <Text key={attachment.media_asset_id} size="sm" data-inquiry-attachment>
                {assets.get(attachment.media_asset_id)?.filename ?? attachment.media_asset_id}
              </Text>
            ))}
          </Stack>
        )}

        <Divider />

        <PageHeader level={2} title={t('studio.inquiry.timelineHeading')} />
        <HelpText>{t('studio.inquiry.timelineNote')}</HelpText>
        <Stack gap={2}>
          {events.map((event) => (
            <Text key={event.id} size="sm" data-inquiry-event={event.event}>
              <RelativeTime value={event.occurred_at} /> — {event.event}
              {event.to_status === null ? '' : ` → ${event.to_status}`}
              {event.note === null ? '' : ` — ${event.note}`}
            </Text>
          ))}
        </Stack>

        {canWrite ? (
          <>
            <Divider />
            <PageHeader level={2} title={t('studio.inquiry.pipelineHeading')} />
            <ActionForm action={setInquiryStatusAction} className="grid max-w-sm gap-4">
              <input type="hidden" name="id" value={inquiry.id} />
              <SelectField
                name="pipeline_status"
                label={t('studio.inquiry.status')}
                defaultValue={inquiry.pipeline_status}
                options={STATUSES.map((status) => ({ value: status, label: status }))}
              />
              <div>
                <Button type="submit">{t('studio.inquiry.statusSave')}</Button>
              </div>
            </ActionForm>

            <Divider />
            <PageHeader level={2} title={t('studio.inquiry.assignHeading')} />
            <ActionForm action={assignInquiryAction} className="grid max-w-sm gap-4">
              <input type="hidden" name="id" value={inquiry.id} />
              {/*
                THE ASSIGNEE IS A UUID TYPED IN, NOT A PICKER, and that is honest rather than lazy:
                `staff_profiles` is readable only by the roles that hold `users.read`, and a
                merchandiser triaging an enquiry does not hold it. A picker that showed nothing to
                the person most likely to use it would be worse than a field they can paste into.
              */}
              <label className="grid gap-2">
                <Text size="sm" as="span">
                  {t('studio.inquiry.assignee')}
                </Text>
                <input
                  name="assigned_to"
                  defaultValue={inquiry.assigned_to ?? ''}
                  className="h-11 rounded-(--rv-radius-sm) border border-line px-3"
                />
              </label>
              <div>
                <Button type="submit">{t('studio.inquiry.assignSave')}</Button>
              </div>
            </ActionForm>

            <Divider />
            <PageHeader level={2} title={t('studio.inquiry.noteHeading')} />
            <ActionForm action={addInquiryNoteAction} className="grid max-w-2xl gap-4">
              <input type="hidden" name="id" value={inquiry.id} />
              <label className="grid gap-2">
                <Text size="sm" as="span">
                  {t('studio.inquiry.note')}
                </Text>
                <Textarea name="note" rows={3} />
              </label>
              <div>
                <Button type="submit">{t('studio.inquiry.noteAdd')}</Button>
              </div>
            </ActionForm>
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
