import type { Route } from 'next'
import Link from 'next/link'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'

import { ExportPanel } from './panel'

/**
 * /studio/operations/exports — CSV of products, media and enquiries.
 *
 * THE ENQUIRY PANEL IS ABSENT FOR A ROLE WITHOUT `inquiries.export`, not disabled. That is the
 * opposite of the bulk surface's choice and the difference is what the control would tell the
 * reader: an unavailable "Archive" teaches a merchandiser who to ask, whereas an unavailable
 * "Export enquiries" would tell somebody without the permission that there are enquiries and how
 * many. The action re-checks regardless.
 */
export const metadata = studioMetadata('/studio/operations/exports')

export default async function Page() {
  const session = await requirePermission('bulk.execute')
  const canExportInquiries = roleHasPermission(session.role, 'inquiries.export')

  return (
    <StudioPage path="/studio/operations/exports">
      <Stack gap={8}>
        <Surface level={1} className="p-6">
          <PageHeader
            level={2}
            title={t('studio.exports.heading')}
            description={t('studio.exports.body')}
          />
          <div className="mt-6">
            <ExportPanel canExportInquiries={canExportInquiries} />
          </div>
        </Surface>

        {/* PHASE 36 CROSS-LINKS RATHER THAN GROWING A SECOND EXPORTER. Sheets is a one-way
            scheduled export with its own definitions and history; CSV stays here. */}
        <Surface level={1} className="p-6" data-sheets-cross-link="">
          <Text size="sm" tone="secondary">
            <Link
              href={'/studio/research/sheets' as Route}
              className="underline underline-offset-4"
            >
              {t('studio.sheets.exportsLink')}
            </Link>
          </Text>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
