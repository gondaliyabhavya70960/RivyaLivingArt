'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { ErrorText } from '@/components/primitives/ErrorText'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { interpolate } from '@/lib/cms/strings'
import type { UploadedReference } from '@/lib/cms/forms'

import type { ConfiguratorCopy, UploadLimits } from './types'

/**
 * The reference-upload control.
 *
 * THE BYTES GO STRAIGHT TO THE PROVIDER AND NEVER TOUCH THE RIVYA SERVER. `POST
 * /api/inquiries/upload-sign` returns a credential scoped to one server-minted folder; the browser
 * then posts the file to Cloudinary with it. That is why a 10 MB reference does not cost a serverless
 * function 10 MB of memory, and why the endpoint can be rate-limited on signatures rather than on
 * bandwidth.
 *
 * WHAT IT KEEPS IS A `publicId` AND A FILENAME, not a `media_assets` id. No row exists yet: the
 * signature cannot know the public_id the upload will produce, so Phase 20 creates the rows when it
 * persists the inquiry, after checking each public_id really is under `rivya/inquiries/incoming/`.
 *
 * `submissionId` IS THE THREAD BETWEEN FILES. The first signature mints a uuid and the control
 * holds it, so the second and third files land in the same folder. It is passed back to the
 * endpoint, which validates it as a uuid and assembles the path itself — a client naming a folder
 * it was already given is not a client choosing one.
 *
 * A FAILED UPLOAD IS NOT A FAILED BRIEF. References are optional on every seeded template, and SEED
 * §49 says so in the copy: *This file could not be uploaded. Try another file or continue without
 * it.* The control surfaces that sentence and leaves the step passable.
 */

export interface ReferenceUploadProps {
  readonly fieldKey: string
  readonly value: readonly UploadedReference[]
  readonly onChange: (next: readonly UploadedReference[]) => void
  readonly limits: UploadLimits
  readonly copy: ConfiguratorCopy
  readonly describedBy?: string
}

interface Signature {
  readonly signature: string
  readonly timestamp: number
  readonly apiKey: string
  readonly folder: string
  readonly uploadUrl: string
  readonly submissionId: string
}

/** Bytes, as a person reads them. Not a seeded string: a unit symbol is not editorial copy. */
function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function ReferenceUpload({
  fieldKey,
  value,
  onChange,
  limits,
  copy,
  describedBy,
}: ReferenceUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const submissionId = React.useRef<string | null>(null)
  const inputId = `${fieldKey}-file`

  const atLimit = value.length >= limits.maxFiles

  async function upload(file: File): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const signResponse = await fetch('/api/inquiries/upload-sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mime: file.type,
          bytes: file.size,
          ...(submissionId.current !== null ? { submissionId: submissionId.current } : {}),
        }),
      })

      if (!signResponse.ok) {
        // Every refusal from that endpoint carries `copyKey`, never a sentence: D2 keeps
        // visitor-readable strings in `global_content`, and the server has no business deciding the
        // wording. The one string this control needs is already resolved into `copy`.
        setError(copy.uploadError)
        return
      }

      const signed = (await signResponse.json()) as Signature
      submissionId.current = signed.submissionId

      const body = new FormData()
      body.append('file', file)
      body.append('api_key', signed.apiKey)
      body.append('timestamp', String(signed.timestamp))
      body.append('signature', signed.signature)
      body.append('folder', signed.folder)
      // Signed by the server and therefore not the client's to change: sending a different value
      // produces a signature mismatch rather than an overwrite.
      body.append('overwrite', 'false')
      body.append('context', `uploaded_by=${signed.submissionId}`)

      const upload = await fetch(signed.uploadUrl, { method: 'POST', body })
      if (!upload.ok) {
        setError(copy.uploadError)
        return
      }

      const result = (await upload.json()) as { public_id?: string }
      if (typeof result.public_id !== 'string') {
        setError(copy.uploadError)
        return
      }

      onChange([...value, { publicId: result.public_id, filename: file.name }])
    } catch {
      setError(copy.uploadError)
    } finally {
      setBusy(false)
      // Cleared so choosing the same file twice fires `change` again — otherwise a visitor who
      // removed a file and re-picked it would get no response at all.
      if (inputRef.current !== null) inputRef.current.value = ''
    }
  }

  return (
    <Stack gap={3}>
      <Stack gap={2}>
        <label htmlFor={inputId} className="text-sm">
          {copy.uploadChoose}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          // The endpoint enforces this list; `accept` is the courtesy that stops a visitor picking
          // a file it will refuse. Never the control — a file picker's filter is advisory.
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          disabled={busy || atLimit}
          aria-describedby={describedBy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file !== undefined) void upload(file)
          }}
        />
        {copy.uploadHint === '' ? null : (
          <HelpText>
            {interpolate(copy.uploadHint, {
              count: String(limits.maxFiles),
              size: megabytes(limits.maxBytes),
            })}
          </HelpText>
        )}
      </Stack>

      {busy ? (
        <Text size="sm" tone="secondary" aria-live="polite">
          {copy.uploading}
        </Text>
      ) : null}

      {error !== null ? <ErrorText>{error}</ErrorText> : null}

      {value.length > 0 ? (
        <ul role="list" className="grid gap-2">
          {value.map((file) => (
            <li key={file.publicId}>
              <Cluster gap={3} align="center">
                <Text size="sm">{file.filename}</Text>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  // The accessible name carries the filename: a column of identical "Remove"
                  // buttons cannot be used by keyboard or screen reader.
                  aria-label={interpolate(copy.uploadRemove, { filename: file.filename })}
                  onClick={() => {
                    onChange(value.filter((item) => item.publicId !== file.publicId))
                  }}
                >
                  ×
                </Button>
              </Cluster>
            </li>
          ))}
        </ul>
      ) : null}
    </Stack>
  )
}
