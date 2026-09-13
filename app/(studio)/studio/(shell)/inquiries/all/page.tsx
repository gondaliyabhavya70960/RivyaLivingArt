import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { DataRequestPanel } from '@/components/studio/inquiries/DataRequestPanel'
import { InquiryInbox } from '@/components/studio/inquiries/InquiryInbox'
import { ListPage } from '@/components/studio/ListPage'
import { StudioActionAnchor, StudioActionLink } from '@/components/studio/StudioAction'
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

  /*
   * §8's primary action: "Open latest". The list is already newest-first, so the newest enquiry is
   * the first row — and the control exists only when there IS one. A button that opens nothing on a
   * quiet inbox is worse than no button, and a quiet inbox is the state this screen is usually in.
   */
  const latest = rows[0]

  return (
    <StudioPage
      path="/studio/inquiries/all"
      actions={
        latest === undefined ? undefined : (
          <StudioActionLink
            href={`/studio/inquiries/all/${latest.id}`}
            label={t('studio.inquiries.openLatest')}
            tone="primary"
          />
        )
      }
    >
      <Stack gap={8}>
        <ListPage>
          <InquiryInbox rows={rows} productTitles={titles} />
        </ListPage>

        {/*
          §8: "Quiet inbox is success". Said once, under the table, rather than inside the empty
          state — because it is true whether the inbox holds nothing or holds three things somebody
          has already answered, and an empty state only speaks in the first case.
        */}
        {rows.length === 0 ? <HelpText>{t('studio.inquiries.quietNote')}</HelpText> : null}

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
            {/*
              A PLAIN ANCHOR AT 44px, NOT A `Link`. The href is a download rather than an app route,
              so `next/link` would prefetch a CSV of every enquiry in the database every time this
              page rendered. It was `underline underline-offset-4` — about 20px on the owner's
              phone, which is §3.6's defect and the last instance of it in Studio.
            */}
            <div>
              <StudioActionAnchor
                href="/api/studio/inquiries/export"
                label={t('studio.inquiries.export')}
                data-inquiries-export=""
              />
            </div>
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
