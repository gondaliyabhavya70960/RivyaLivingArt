'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { HelpText } from '@/components/primitives/HelpText'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * The data request panel — Phase 41, RC-357.
 *
 * THE SHAPE ENFORCES THE ORDER: identify, preview, then act. Download and Erase stay disabled until
 * a preview has run and matched something, because both operate on a set the operator has to have
 * READ first. Matching is by the email or phone somebody typed into a form — there are no customer
 * accounts in this product, by design — so a mistyped digit finds a different person, and the
 * reference codes are the only chance anybody has to notice.
 *
 * ERASE ASKS FOR A TYPED WORD, not a second click. A confirm dialog is dismissed by muscle memory;
 * typing ERASE is a deliberate act, and it is proportionate to an operation that cannot be undone.
 *
 * IT SENDS THE CODES BACK WITH THE ERASURE. The action re-runs the dry run and refuses if the set
 * has moved since the preview — a new enquiry from the same person, or an erasure somebody else
 * already did. Without that, "I read the list" would mean nothing.
 *
 * THE DOWNLOAD GOES TO A ROUTE HANDLER AND STRAIGHT TO DISK. No enquirer's data is ever held in
 * this component's state: it knows a count and a list of reference codes, and a reference code
 * names an enquiry without naming a person.
 */

export interface DataRequestPanelProps {
  /** True when the signed-in staff member may erase. The buttons differ; the server decides. */
  readonly canErase: boolean
  readonly onPreview: (input: {
    email: string
    phone: string
  }) => Promise<
    { ok: true; matched: number; references: readonly string[] } | { ok: false; error: string }
  >
  readonly onErase: (input: {
    email: string
    phone: string
    confirmReferences: string[]
  }) => Promise<{ ok: true; erased: number } | { ok: false; error: string }>
}

type Preview = { matched: number; references: readonly string[] }

export function DataRequestPanel({
  canErase,
  onPreview,
  onErase,
}: DataRequestPanelProps): React.ReactElement {
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [erased, setErased] = React.useState(false)

  // Any edit to the identifier invalidates the preview: the codes below would otherwise describe
  // a search nobody ran.
  function identifierChanged(): void {
    setPreview(null)
    setConfirm('')
    setError(null)
    setErased(false)
  }

  async function runPreview(): Promise<void> {
    setBusy(true)
    setError(null)
    setErased(false)
    const result = await onPreview({ email, phone })
    setBusy(false)
    if (!result.ok) {
      setPreview(null)
      setError(result.error)
      return
    }
    setPreview({ matched: result.matched, references: result.references })
  }

  async function runErase(): Promise<void> {
    if (preview === null) return
    setBusy(true)
    setError(null)
    const result = await onErase({
      email,
      phone,
      confirmReferences: [...preview.references],
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setErased(true)
    setPreview(null)
    setConfirm('')
  }

  const ready = preview !== null && preview.matched > 0

  return (
    <Stack gap={4} data-data-request="">
      <Stack gap={1}>
        <Heading level={2} size="display-xs">
          {t('studio.inquiries.dataRequest.heading')}
        </Heading>
        <HelpText>{t('studio.inquiries.dataRequest.body')}</HelpText>
      </Stack>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('studio.inquiries.dataRequest.emailLabel')} controlId="data-request-email">
          <Input
            id="data-request-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              identifierChanged()
            }}
          />
        </Field>
        <Field label={t('studio.inquiries.dataRequest.phoneLabel')} controlId="data-request-phone">
          <Input
            id="data-request-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              identifierChanged()
            }}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            void runPreview()
          }}
          disabled={busy || (email.trim() === '' && phone.trim() === '')}
          data-data-request-preview=""
        >
          {t('studio.inquiries.dataRequest.preview')}
        </Button>
      </div>

      {/*
        `role="status"`: the result appears after a deliberate action and is the answer to it, so a
        screen-reader user is told without being interrupted mid-sentence.
      */}
      {error !== null ? (
        <Text size="sm" role="alert" data-data-request-error="">
          {error}
        </Text>
      ) : null}
      {erased ? (
        <Text size="sm" role="status">
          {t('studio.inquiries.dataRequest.erased')}
        </Text>
      ) : null}

      {preview === null ? null : (
        <div role="status" data-data-request-preview-result="">
          <Stack gap={2}>
            {preview.matched === 0 ? (
              <Text size="sm">{t('studio.inquiries.dataRequest.none')}</Text>
            ) : (
              <>
                <Text size="sm">
                  {`${t('studio.inquiries.dataRequest.matched')} ${String(preview.matched)}`}
                </Text>
                <ul className="m-0 list-none p-0">
                  {preview.references.map((reference) => (
                    <li key={reference}>
                      <Text size="sm" tone="secondary">
                        {reference}
                      </Text>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Stack>
        </div>
      )}

      {ready ? (
        <Stack gap={4}>
          <Stack gap={2}>
            <HelpText>{t('studio.inquiries.dataRequest.downloadNote')}</HelpText>
            <div>
              <Button
                type="button"
                onClick={() => {
                  void download(email, phone)
                }}
                data-data-request-download=""
              >
                {t('studio.inquiries.dataRequest.download')}
              </Button>
            </div>
          </Stack>

          {canErase ? (
            <Stack gap={2}>
              <HelpText>{t('studio.inquiries.dataRequest.eraseNote')}</HelpText>
              <Field
                label={t('studio.inquiries.dataRequest.confirmLabel')}
                controlId="data-request-confirm"
              >
                <Input
                  id="data-request-confirm"
                  value={confirm}
                  onChange={(event) => {
                    setConfirm(event.target.value)
                  }}
                />
              </Field>
              <div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    void runErase()
                  }}
                  disabled={busy || confirm.trim().toUpperCase() !== 'ERASE'}
                  data-data-request-erase=""
                >
                  {t('studio.inquiries.dataRequest.erase')}
                </Button>
              </div>
            </Stack>
          ) : (
            <HelpText>{t('studio.inquiries.dataRequest.ownerOnly')}</HelpText>
          )}
        </Stack>
      ) : null}
    </Stack>
  )
}

/**
 * The download, as a fetch plus an object URL.
 *
 * A PLAIN FORM SUBMIT WOULD NAVIGATE THE STUDIO AWAY on any error answer — a 403 would replace the
 * page with a JSON body. Fetching lets the error stay an error and the file stay a file. The object
 * URL is revoked immediately: the data should live in the operator's Downloads folder and nowhere
 * else, least of all in a tab's memory.
 */
async function download(email: string, phone: string): Promise<void> {
  const response = await fetch('/api/studio/inquiries/data-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone }),
  })
  if (!response.ok) return
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'data-request.json'
  anchor.click()
  URL.revokeObjectURL(url)
}
