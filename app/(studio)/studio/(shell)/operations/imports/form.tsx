'use client'

import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { t } from '@/components/studio/strings'

import { applyImportAction, dryRunImportAction } from './actions'

/**
 * The upload form and the dry-run table.
 *
 * THE COLUMN MAP IS SENT AS JSON FROM A TEXT FIELD, and that is a deliberate first cut rather than
 * a finished mapping UI. The pipeline supports a per-column picker — `suggestColumnMap` proposes
 * one from the headers — and the picker is the part this phase did not build. An operator whose
 * headers already match the field names leaves it empty and the mapping is by name; anyone else
 * pastes a map. Stated here rather than implied, and recorded in STUDIO_GUIDE §12.
 */

export function ImportForm(): React.ReactElement {
  return (
    <ActionForm action={dryRunImportAction}>
      <Stack gap={4}>
        <label className="text-sm">
          <span className="mb-1 block">CSV or TSV</span>
          <input
            type="file"
            name="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            required
            className="block text-sm"
            data-import-file
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block">Column map (optional JSON)</span>
          <textarea
            name="column_map"
            rows={3}
            placeholder='{"Product Name":"title"}'
            className="w-full border border-line bg-surface p-2 font-mono text-xs"
            data-import-column-map
          />
        </label>

        <button
          type="submit"
          className="self-start border border-ink px-4 py-2 text-sm uppercase tracking-technical"
          data-import-dry-run
        >
          {t('studio.bulk.preview')}
        </button>
      </Stack>
    </ActionForm>
  )
}

export interface ImportPreviewRow {
  readonly id: string
  readonly rowNumber: number
  readonly action: string
  readonly applied: boolean
  readonly issues: ReadonlyArray<{ rule?: string; message?: string }>
}

export function ImportPreview({
  importId,
  rows,
}: {
  readonly importId: string
  readonly rows: readonly ImportPreviewRow[]
}): React.ReactElement {
  const applicable = rows.filter((row) => row.action !== 'SKIP' && !row.applied).length
  const invalid = rows.filter((row) => row.issues.length > 0).length

  return (
    <Stack gap={4}>
      <div className="mt-4 flex flex-wrap gap-3">
        <Badge tone="neutral">{`${applicable} ${t('studio.bulk.willApply')}`}</Badge>
        <Badge tone={invalid > 0 ? 'danger' : 'neutral'}>
          {`${invalid} ${t('studio.bulk.willFail')}`}
        </Badge>
      </div>

      <div className="max-h-96 overflow-y-auto border border-line">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('studio.bulk.previewCaption')}</caption>
          <thead className="sticky top-0 bg-surface-raised">
            <tr>
              <th scope="col" className="p-2 text-left">
                {t('studio.bulk.columnRow')}
              </th>
              <th scope="col" className="p-2 text-left">
                {t('studio.bulk.columnOutcome')}
              </th>
              <th scope="col" className="p-2 text-left">
                {t('studio.bulk.columnReason')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line" data-import-row={row.rowNumber}>
                {/* THE OPERATOR'S OWN LINE NUMBER, so an error names something they can find in
                    the file they uploaded rather than a database id. */}
                <td className="p-2">{row.rowNumber}</td>
                <td className="p-2">
                  <Badge tone={row.issues.length > 0 ? 'danger' : 'neutral'}>{row.action}</Badge>
                </td>
                <td className="p-2 text-ink-secondary">
                  {row.issues.map((issue, index) => (
                    <span key={`${row.id}-${index}`} className="mr-3">
                      {issue.message}
                      {issue.rule === undefined ? null : (
                        <span className="ml-1 text-xs uppercase tracking-technical">
                          {issue.rule}
                        </span>
                      )}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {applicable === 0 ? (
        <Text tone="secondary">{t('studio.bulk.noSelectionBody')}</Text>
      ) : (
        <ActionForm action={applyImportAction}>
          <input type="hidden" name="import_id" value={importId} />
          <button
            type="submit"
            className="border border-ink px-4 py-2 text-sm uppercase tracking-technical"
            data-import-apply
          >
            {t('studio.bulk.apply')}
          </button>
        </ActionForm>
      )}
    </Stack>
  )
}
