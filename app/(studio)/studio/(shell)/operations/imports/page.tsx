import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listBulkImportRows } from '@/lib/supabase/repositories/bulk'
import { createClient } from '@/lib/supabase/server'

import { ImportForm, ImportPreview } from './form'

/**
 * /studio/operations/imports — CSV and TSV import, with a dry run in front of it.
 *
 * THE DRY RUN IS A SEPARATE ROUND TRIP AND ITS RESULT LIVES IN THE DATABASE. That is what makes it
 * possible to leave the page and come back, to send a colleague the URL, and — the reason that
 * matters most — to answer "why did that import do that" a fortnight later from
 * `bulk_import_rows` rather than from memory.
 *
 * EVERY IMPORTED PRODUCT LANDS AS A DRAFT. The copy says so, and the enforcement is that
 * `lib/supabase/repositories/bulk-import.ts` has no `status` in its writable set — an absence
 * rather than a rule, so there is no flag to relax.
 */
export const metadata = studioMetadata('/studio/operations/imports')

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission('bulk.execute')

  const params = await searchParams
  const rawImport = params['import']
  const importId = (Array.isArray(rawImport) ? rawImport[0] : rawImport) ?? null

  const client = await createClient()
  const rows = importId === null ? [] : await listBulkImportRows(client, importId)

  return (
    <StudioPage path="/studio/operations/imports">
      <Stack gap={8}>
        <Surface level={1} className="p-6">
          <PageHeader
            level={2}
            title={t('studio.imports.heading')}
            description={t('studio.imports.body')}
          />
          <div className="mt-6">
            <ImportForm />
          </div>
        </Surface>

        {importId === null ? null : (
          <Surface level={1} className="p-6">
            <PageHeader level={2} title={t('studio.bulk.previewCaption')} />
            {rows.length === 0 ? (
              <Text tone="secondary" className="mt-3">
                {t('studio.bulk.noSelectionBody')}
              </Text>
            ) : (
              <ImportPreview
                importId={importId}
                rows={rows.map((row) => ({
                  id: row.id,
                  rowNumber: row.row_number,
                  action: row.action,
                  applied: row.applied,
                  issues: Array.isArray(row.issues)
                    ? (row.issues as Array<{ rule?: string; message?: string }>)
                    : [],
                }))}
              />
            )}
          </Surface>
        )}
      </Stack>
    </StudioPage>
  )
}
