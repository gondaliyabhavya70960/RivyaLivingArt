import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataRequestPanel } from '@/components/studio/inquiries/DataRequestPanel'
import { InquiryInbox } from '@/components/studio/inquiries/InquiryInbox'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listProductsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listInquiriesForStudio } from '@/lib/supabase/repositories/inquiries'
import { createClient } from '@/lib/supabase/server'

import { eraseDataRequestAction, previewDataRequestAction } from '../actions'

/**
 * /studio/inquiries/all
 *
 * Every enquiry, whatever produced it — including the GENERAL ones the contact form sends, which have no view of their own.
 *
 * ONE SHARED TABLE, FIVE ROUTES. D4 names the five and they differ by a filter; the component is
 * `components/studio/inquiries/InquiryInbox.tsx`.
 */
export const metadata = studioMetadata('/studio/inquiries/all')

export default async function Page() {
  const session = await requirePermission('inquiries.read')
  const client = await createClient()
  const [rows, products] = await Promise.all([
    listInquiriesForStudio(client),
    listProductsForStudio(client, {}),
  ])

  const titles = new Map(
    products.flatMap((product) => (product.title === null ? [] : [[product.id, product.title]])),
  )

  return (
    <StudioPage path="/studio/inquiries/all">
      <Stack gap={8}>
        <InquiryInbox rows={rows} productTitles={titles} />

        {/*
          THE EXPORT IS ON THIS VIEW AND NOT THE OTHER FOUR, because it exports EVERY enquiry rather
          than the filtered set — a "Export as CSV" button on the Commission view that quietly
          included the product enquiries would be a lie about what it did. It is absent for a role
          without `inquiries.export`, not disabled: the editor holds `inquiries.read` and is not
          being asked to request permission, they are being told this is not their decision.
        */}
        {roleHasPermission(session.role, 'inquiries.export') ? (
          <Stack gap={2}>
            <HelpText>{t('studio.inquiries.exportNote')}</HelpText>
            <a
              href="/api/studio/inquiries/export"
              className="underline underline-offset-4"
              data-inquiries-export
            >
              <Text size="sm" as="span">
                {t('studio.inquiries.export')}
              </Text>
            </a>
          </Stack>
        ) : null}

        {/*
          THE DATA REQUEST SITS BESIDE THE EXPORT AND BEHIND THE SAME PERMISSION — Phase 41. Both
          answer "give me the customer data", and putting them on one screen is what stops somebody
          reaching for the CSV when what they were asked for was one person's own record. Erasure
          needs more than this page can grant: the panel shows the control to the owner and a
          sentence naming them to everybody else, and the action re-decides regardless.
        */}
        {roleHasPermission(session.role, 'inquiries.export') ? (
          <DataRequestPanel
            canErase={session.role === 'owner'}
            onPreview={previewDataRequestAction}
            onErase={eraseDataRequestAction}
          />
        ) : null}
      </Stack>
    </StudioPage>
  )
}
