'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { ALLOWED_FOLDERS } from '@/lib/media/folders'
import { UPLOAD_LIMITS, type UploadKind } from '@/lib/media/upload-limits'

/**
 * Direct-to-Cloudinary upload from the Studio.
 *
 * THE BYTES NEVER TOUCH OUR SERVER. `POST /api/media/sign` returns a signature; the browser then
 * posts the file straight to Cloudinary. A Vercel function has a body limit and a duration limit
 * that a 200 MB video would exceed on both counts, and proxying it would mean paying for the same
 * bytes twice.
 *
 * ALT TEXT IS REQUIRED BEFORE THE UPLOAD, NOT AFTER, and that ordering is the point rather than a
 * detail. `media_assets.alt_text` is `not null` and non-empty (0005, SEED §43), so an asset saved
 * without one cannot exist — but the reason to demand it HERE is different: an uploader that
 * accepts the file first and asks afterwards produces a library full of rows somebody meant to
 * come back to. The upload is cheap to postpone by ten seconds; chasing alt text across two
 * hundred assets later is not.
 *
 * IT CHECKS THE LIMITS TWICE, AND NEITHER CHECK IS THE REAL ONE. The client check below refuses an
 * over-large or wrong-typed file before spending the upload — a courtesy to whoever is on a slow
 * connection. The sign endpoint applies the same table server-side, and that is the control:
 * everything here can be bypassed by anyone willing to open a console, so nothing here is trusted.
 *
 * XHR, NOT `fetch`. `fetch` has no upload progress event — a 200 MB video would sit at "Uploading…"
 * for minutes with nothing moving, which reads as a hang. `XMLHttpRequest.upload.onprogress` is the
 * only way to report it, and a determinate bar is worth the older API.
 */

export type MediaUploaderProps = {
  /** The kind this surface uploads. Fixes the MIME allowlist, the ceiling and the namespace. */
  kind: UploadKind
  /** Folders offered. Defaults to the whole allowlist; a section may narrow it. */
  folders?: readonly string[]
  /** Called with the new asset's id once the row is saved, so the page can refresh. */
  onUploaded?: (assetId: string) => void
  /** Saves the row after Cloudinary accepts the file. A Server Action, passed in by the page. */
  saveAction: (input: {
    publicId: string
    folder: string
    kind: UploadKind
    source: string
    altText: string
    filename: string
    mimeType: string
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
}

/** D6's ladder, in D6's order. `REAL` first because it is the one an editor should reach for. */
const SOURCES = ['REAL', 'USER_UPLOAD', 'RENDER', 'FALLBACK'] as const

type Phase = 'idle' | 'signing' | 'uploading' | 'saving' | 'done'

export function MediaUploader({
  kind,
  folders = ALLOWED_FOLDERS,
  onUploaded,
  saveAction,
}: MediaUploaderProps): React.ReactElement {
  const limits = UPLOAD_LIMITS[kind]

  const [file, setFile] = React.useState<File | null>(null)
  const [altText, setAltText] = React.useState('')
  const [folder, setFolder] = React.useState(folders[0] ?? '')
  // No default. The database column has none either, for the same reason: an unstated source
  // would become a provenance claim nobody made.
  const [source, setSource] = React.useState('')
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [progress, setProgress] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const busy = phase === 'signing' || phase === 'uploading' || phase === 'saving'

  async function upload(): Promise<void> {
    setError(null)

    if (file === null) return setError(t('studio.media.upload.needFile'))
    if (altText.trim() === '') return setError(t('studio.media.upload.needAlt'))
    if (source === '') return setError(t('studio.media.upload.sourceHelp'))
    if (!limits.mimeTypes.includes(file.type)) {
      return setError(t('studio.media.upload.wrongType'))
    }
    if (file.size > limits.maxBytes) return setError(t('studio.media.upload.tooLarge'))

    setPhase('signing')
    const signResponse = await fetch('/api/media/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ folder, kind, mimeType: file.type, bytes: file.size }),
    })

    if (!signResponse.ok) {
      setPhase('idle')
      return setError(t('studio.media.upload.refused'))
    }
    const signed = (await signResponse.json()) as {
      signature: string
      timestamp: number
      apiKey: string
      folder: string
      uploadUrl: string
    }

    setPhase('uploading')
    setProgress(0)

    // Every field here must match what the server signed, exactly. Cloudinary recomputes the
    // signature over what it receives, so one extra or missing parameter is a rejected upload —
    // which is why `overwrite` and `context` are sent even though the browser sets neither.
    const body = new FormData()
    body.append('file', file)
    body.append('api_key', signed.apiKey)
    body.append('timestamp', String(signed.timestamp))
    body.append('signature', signed.signature)
    body.append('folder', signed.folder)
    body.append('overwrite', 'false')

    const uploaded = await new Promise<{ public_id: string } | null>((resolve) => {
      const request = new XMLHttpRequest()
      request.open('POST', signed.uploadUrl)
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100))
      }
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(JSON.parse(request.responseText) as { public_id: string })
        } else {
          resolve(null)
        }
      }
      // A network failure and a rejection are the same outcome to the person watching: nothing
      // was saved. Distinguishing them here would only produce a message they cannot act on.
      request.onerror = () => resolve(null)
      request.onabort = () => resolve(null)
      request.send(body)
    })

    if (uploaded === null) {
      setPhase('idle')
      return setError(t('studio.media.upload.failed'))
    }

    // The row is written only after Cloudinary has the bytes. The other order would leave a row
    // pointing at an asset that does not exist — and a broken image in a Studio table is harder to
    // notice than a missing one.
    setPhase('saving')
    const saved = await saveAction({
      publicId: uploaded.public_id,
      folder: signed.folder,
      kind,
      source,
      altText: altText.trim(),
      filename: file.name,
      mimeType: file.type,
    })

    if (!saved.ok) {
      setPhase('idle')
      return setError(saved.error)
    }

    setPhase('done')
    setProgress(100)
    onUploaded?.(saved.id)
  }

  return (
    <Stack gap={4}>
      <Field
        label={t('studio.media.upload.fileLabel')}
        controlId="media-file"
        required
        requiredLabel={t('studio.media.requiredLabel')}
      >
        <Input
          id="media-file"
          type="file"
          accept={limits.mimeTypes.join(',')}
          disabled={busy}
          onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
        />
      </Field>

      <Field
        label={t('studio.media.upload.altLabel')}
        controlId="media-alt"
        help={t('studio.media.upload.altHelp')}
        required
        requiredLabel={t('studio.media.requiredLabel')}
      >
        <Input
          id="media-alt"
          value={altText}
          disabled={busy}
          onChange={(event) => setAltText(event.currentTarget.value)}
        />
      </Field>

      <Field
        label={t('studio.media.upload.folderLabel')}
        controlId="media-folder"
        required
        requiredLabel={t('studio.media.requiredLabel')}
      >
        <Select
          id="media-folder"
          value={folder}
          disabled={busy}
          onChange={(event) => setFolder(event.currentTarget.value)}
        >
          {folders.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={t('studio.media.upload.sourceLabel')}
        controlId="media-source"
        help={t('studio.media.upload.sourceHelp')}
        required
        requiredLabel={t('studio.media.requiredLabel')}
      >
        <Select
          id="media-source"
          value={source}
          disabled={busy}
          onChange={(event) => setSource(event.currentTarget.value)}
        >
          {/* An empty first option rather than a preselected `REAL`: a select that arrives with an
              answer already in it is answered by inattention. `HIGGSFIELD` is absent because it is
              not something an uploader chooses — Phase 07's importer sets it. */}
          <option value="">—</option>
          {SOURCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      {error !== null && <ErrorText>{error}</ErrorText>}

      {phase === 'uploading' && (
        <Stack gap={1}>
          {/* A real <progress>, so a screen reader announces the value and the browser draws a
              determinate bar. A div with a width percentage says nothing to anyone not looking. */}
          <progress
            className="w-full"
            max={100}
            value={progress}
            aria-label={t('studio.media.upload.progress')}
          />
          <Text size="sm" tone="tertiary">
            {progress}%
          </Text>
        </Stack>
      )}

      {phase === 'done' && <Text tone="secondary">{t('studio.media.upload.done')}</Text>}

      <Button type="button" disabled={busy} onClick={() => void upload()}>
        {busy ? t('studio.media.upload.busy') : t('studio.media.upload.action')}
      </Button>
    </Stack>
  )
}
