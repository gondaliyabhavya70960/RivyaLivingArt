import type { Route } from 'next'
import Link from 'next/link'

import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { t } from '@/components/studio/strings'
import type { Inquiry } from '@/lib/supabase/schemas'

/**
 * The enquiry list, shared by all five D4 views.
 *
 * ONE COMPONENT AND FIVE ROUTES, because the five differ by a `kind` filter and nothing else. Five
 * copies of this table would be five places for a column to drift, and the column that drifts is
 * always the one nobody looks at until they need it.
 *
 * THE REFERENCE CODE IS THE WAY IN, not the name. A studio answering the phone is told a code, and
 * the code is unique; two enquiries from the same person in a week are not distinguishable by name.
 *
 * NO PRICE, NO QUOTE, NO ORDER — there is no such column to show. `QUOTED` is a pipeline status,
 * which is a note about a conversation the studio had, and not a number this product computed.
 */
export function InquiryInbox({
  rows,
  productTitles,
}: {
  readonly rows: readonly Inquiry[]
  /** Titles by product id, so a row names the piece rather than a uuid. */
  readonly productTitles: ReadonlyMap<string, string>
}) {
  return (
    <Stack gap={6}>
      <HelpText>{t('studio.inquiries.help')}</HelpText>

      <DataTable<Inquiry>
        caption={t('studio.inquiries.caption')}
        rows={rows}
        rowKey={(row) => row.id}
        empty={{
          reason: 'empty',
          heading: t('studio.inquiries.emptyHeading'),
          body: t('studio.inquiries.emptyBody'),
        }}
        columns={[
          {
            id: 'reference',
            header: t('studio.inquiries.colReference'),
            cell: (row) => (
              <Link
                href={`/studio/inquiries/all/${row.id}` as Route}
                className="underline underline-offset-4"
                data-inquiry-reference={row.reference_code}
              >
                {row.reference_code}
              </Link>
            ),
          },
          { id: 'kind', header: t('studio.inquiries.colKind'), cell: (row) => row.kind },
          {
            id: 'name',
            header: t('studio.inquiries.colName'),
            cell: (row) => (
              <Stack gap={0}>
                <Text size="sm" as="span">
                  {row.name}
                </Text>
                {/* The number is on the row because it is what the studio does next with it. */}
                <Text size="xs" tone="secondary" as="span">
                  {row.phone}
                </Text>
              </Stack>
            ),
          },
          {
            id: 'city',
            header: t('studio.inquiries.colCity'),
            cell: (row) =>
              row.product_id === null
                ? (row.city ?? '')
                : `${row.city ?? ''} · ${productTitles.get(row.product_id) ?? ''}`.trim(),
          },
          {
            id: 'status',
            header: t('studio.inquiries.colStatus'),
            cell: (row) => row.pipeline_status,
          },
          {
            id: 'whatsapp',
            header: t('studio.inquiries.colWhatsapp'),
            cell: (row) => row.whatsapp_state,
          },
          {
            id: 'received',
            header: t('studio.inquiries.colReceived'),
            cell: (row) => <RelativeTime value={row.created_at} />,
          },
        ]}
      />
    </Stack>
  )
}
