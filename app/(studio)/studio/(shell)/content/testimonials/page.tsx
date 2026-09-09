import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listTestimonialsForStudio } from '@/lib/supabase/repositories/testimonials'
import { createClient } from '@/lib/supabase/server'
import type { Testimonial } from '@/lib/supabase/schemas'

/**
 * /studio/content/testimonials — quotes from real people, of which there are none.
 *
 * THERE IS NO "ADD TESTIMONIAL" BUTTON ON THIS SCREEN, AND THAT IS THE POINT. D10 names
 * testimonials outright; a quote written in-house is the plainest kind of fabricated evidence, and
 * the surest way to prevent one is to give nobody a box to type it into. A testimonial reaches this
 * table the way the phase intends: a real person says something, somebody records their consent,
 * and an owner verifies both. The empty-state copy says so, so the absence reads as a rule rather
 * than as a missing feature.
 *
 * THE CONSENT COLUMN CARRIES THE SAME WEIGHT IT DOES ON A PROJECT. `consent` defaults to PENDING
 * here rather than NOT_APPLICABLE, because a quote always came from someone — consent is always a
 * live question, in a way it is not for a project with no client.
 */
export const metadata = studioMetadata('/studio/content/testimonials')

export default async function Page() {
  await requirePermission('content.read')
  const testimonials = await listTestimonialsForStudio(await createClient())

  return (
    <StudioPage path="/studio/content/testimonials">
      <Stack gap={8}>
        <Text size="sm" tone="secondary">
          {t('studio.testimonials.caption')}
        </Text>

        <DataTable<Testimonial>
          caption={t('studio.testimonials.caption')}
          rows={testimonials}
          rowKey={(row) => row.id}
          empty={{
            reason: 'empty',
            heading: t('studio.testimonials.emptyHeading'),
            body: t('studio.testimonials.emptyBody'),
          }}
          columns={[
            {
              id: 'quote',
              header: t('studio.testimonials.colQuote'),
              cell: (row) => row.quote,
            },
            {
              id: 'attribution',
              header: t('studio.testimonials.colAttribution'),
              // An unattributed quote is a choice its author made, not a blank field.
              cell: (row) => row.attributed_to ?? t('studio.testimonials.unattributed'),
            },
            {
              id: 'consent',
              header: t('studio.portfolio.colConsent'),
              cell: (row) => row.consent,
            },
            {
              id: 'status',
              header: t('studio.portfolio.colStatus'),
              cell: (row) => <StatusPill status={row.status} />,
            },
          ]}
        />
      </Stack>
    </StudioPage>
  )
}
