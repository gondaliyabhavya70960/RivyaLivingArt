'use client'

import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

import {
  exportMediaAction,
  exportProductsAction,
  fetchInquiryExport,
  type ExportResult,
} from './actions'

/**
 * The export controls.
 *
 * THE DOWNLOAD IS A BLOB, NOT A LINK, because a Server Action returns a value rather than a
 * response — see the actions module. The file therefore never exists on the server, which has the
 * side effect of being the right answer for the enquiry export: a temporary file of customer
 * details is a thing that gets left behind.
 *
 * THE MESSAGE-BODIES CHECKBOX DEFAULTS TO UNTICKED AND ITS LABEL SAYS WHAT IT MEANS. "Include what
 * customers wrote" rather than "include message field": the operator is deciding whether to carry
 * somebody's words out of the system in a spreadsheet, and the label should say so.
 */

function download(result: ExportResult, setError: (message: string | null) => void): void {
  if (!result.ok) {
    setError(result.message)
    return
  }
  setError(null)
  const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ExportPanel({
  canExportInquiries,
}: {
  readonly canExportInquiries: boolean
}): React.ReactElement {
  const [pending, setPending] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [includeMessages, setIncludeMessages] = React.useState(false)

  const run = async (name: string, action: () => Promise<ExportResult>): Promise<void> => {
    setPending(name)
    try {
      download(await action(), setError)
    } finally {
      setPending(null)
    }
  }

  return (
    <Stack gap={5}>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void run('products', exportProductsAction)}
          className="border border-line px-4 py-2 text-sm uppercase tracking-technical"
          data-export="products"
        >
          Products
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void run('media', exportMediaAction)}
          className="border border-line px-4 py-2 text-sm uppercase tracking-technical"
          data-export="media"
        >
          Media
        </button>
      </div>

      {canExportInquiries ? (
        <Stack gap={3}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeMessages}
              onChange={(event) => setIncludeMessages(event.target.checked)}
              data-export-include-messages
            />
            {t('studio.exports.includeMessages')}
          </label>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void run('inquiries', () => fetchInquiryExport(includeMessages))}
            className="self-start border border-line px-4 py-2 text-sm uppercase tracking-technical"
            data-export="inquiries"
          >
            Enquiries
          </button>
        </Stack>
      ) : null}

      {error === null ? null : (
        <Text tone="secondary" data-export-error>
          {error}
        </Text>
      )}
    </Stack>
  )
}
