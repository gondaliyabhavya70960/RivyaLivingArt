'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import { MediaUploader } from './MediaUploader'
import { rejectionMessage, warningMessage } from './model-findings'
import { t } from './strings'
import type { SaveModelResult } from '@/app/(studio)/studio/(shell)/media/models/actions'
import { quickInspect } from '@/lib/media/inspect'
import { detectModelFormat } from '@/lib/media/model'

/**
 * The model uploader: `MediaUploader` with the inspector in front of it.
 *
 * THE FIRST INSPECTION HAPPENS IN THE BROWSER, BEFORE ANYTHING IS SIGNED. `quickInspect()` reads
 * the file's JSON chunk — no decoder, no upload — and refuses a file the ceilings already condemn,
 * with every reason named. A 20 MB uncompressed GLB never leaves the machine. The server repeats
 * the inspection on the uploaded bytes and adds what needs a decoder; `saveModelAction` is what
 * writes the row, and the metadata it writes is what it read.
 */
export function ModelUploader({
  folders,
  saveAction,
}: {
  readonly folders: readonly string[]
  readonly saveAction: (input: {
    publicId: string
    folder: string
    kind: 'MODEL_3D'
    source: string
    altText: string
    filename: string
    mimeType: string
  }) => Promise<SaveModelResult>
}): React.ReactElement {
  const router = useRouter()

  const preflight = React.useCallback(
    async (
      file: File,
    ): Promise<
      { ok: true; notes: readonly string[] } | { ok: false; reasons: readonly string[] }
    > => {
      const format = detectModelFormat({ mimeType: file.type, filename: file.name })
      if (format === null) {
        return { ok: false, reasons: [rejectionMessage({ code: 'wrong-format', detail: null })] }
      }
      const report = quickInspect(new Uint8Array(await file.arrayBuffer()), format)
      if (!report.ok) return { ok: false, reasons: report.rejections.map(rejectionMessage) }
      return { ok: true, notes: report.warnings.map(warningMessage) }
    },
    [],
  )

  return (
    <MediaUploader
      kind="MODEL_3D"
      folders={folders}
      preflight={preflight}
      doneMessage={t('studio.models.upload.done')}
      saveAction={(input) => saveAction({ ...input, kind: 'MODEL_3D' })}
      onUploaded={() => {
        router.refresh()
      }}
    />
  )
}
