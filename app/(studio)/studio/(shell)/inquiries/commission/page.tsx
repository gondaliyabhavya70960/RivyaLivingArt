import { Stack } from '@/components/primitives/Stack'
import { InquiryInbox } from '@/components/studio/inquiries/InquiryInbox'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { requirePermission } from '@/lib/auth/require'
import { listProductsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listInquiriesForStudio } from '@/lib/supabase/repositories/inquiries'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/inquiries/commission
 *
 * Only `COMMISSION` enquiries. The filter is a database predicate rather than a client-side one, so a role that may not read an enquiry never receives it to filter.
 *
 * ONE SHARED TABLE, FIVE ROUTES. D4 names the five and they differ by a filter; the component is
 * `components/studio/inquiries/InquiryInbox.tsx`.
 */
export const metadata = studioMetadata('/studio/inquiries/commission')

export default async function Page() {
  await requirePermission('inquiries.read')
  const client = await createClient()
  const [rows, products] = await Promise.all([
    listInquiriesForStudio(client, { kind: 'COMMISSION' }),
    listProductsForStudio(client, {}),
  ])

  const titles = new Map(
    products.flatMap((product) => (product.title === null ? [] : [[product.id, product.title]])),
  )

  return (
    <StudioPage path="/studio/inquiries/commission">
      <Stack gap={8}>
        <InquiryInbox rows={rows} productTitles={titles} />
      </Stack>
    </StudioPage>
  )
}
