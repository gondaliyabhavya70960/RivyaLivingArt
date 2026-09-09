'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Textarea } from '@/components/primitives/Textarea'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { interpolate } from '@/lib/cms/strings'

import type { InquiryCopy, InquiryFormKind } from './types'

/**
 * The enquiry form, and the only place on the public site that writes to the database.
 *
 * THE ORDER OF EVENTS IS THE BUSINESS RULE, AND THIS COMPONENT CANNOT GET IT WRONG. It calls the
 * Server Action and then NARROWS on `ok`; the failure member of that union has no `whatsappUrl`
 * property at all, so there is no way to write a redirect that runs before a successful save — not
 * a discipline, a type error. D1 and SEED §49.
 *
 * THE HANDOFF IS A LINK THE VISITOR PRESSES, and the auto-forward is a courtesy on top of it. A
 * bare `window.location = …` would leave somebody with a pop-up blocker, a slow connection or a
 * screen reader on a page that appears to have done nothing. So the success state shows the
 * reference code first, offers the link, and forwards after a second — which the visitor can stop
 * simply by not being interrupted, because the link is already there and already focused.
 *
 * THE HONEYPOT IS HIDDEN FROM EVERYBODY, INCLUDING ASSISTIVE TECHNOLOGY. `VisuallyHidden` alone
 * would leave a screen-reader user tabbing into a field with no explanation; `aria-hidden` alone
 * would leave it visible. Both, plus `tabIndex={-1}` and `autoComplete="off"`, mean no human meets
 * it and no password manager is invited to fill it.
 *
 * NOTHING HERE IS A LITERAL SENTENCE. Every word comes from `copy`, resolved server-side from
 * `global_content`; `scripts/cms/check-section-copy.ts` fails the build on a string in JSX.
 */

export type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'sending' }
  | { readonly status: 'error'; readonly message: string; readonly fields: readonly string[] }
  | {
      readonly status: 'sent'
      readonly referenceCode: string
      readonly whatsappUrl: string | null
    }

export interface InquiryFormProps {
  readonly kind: InquiryFormKind
  readonly copy: InquiryCopy
  /** SEED §22's list, from the section payload. Empty hides the control rather than showing none. */
  readonly enquiryTypes: readonly string[]
  /** Set on a product page, so the enquiry is filed against the piece it is about. */
  readonly productId?: string
  /**
   * The action itself, injected rather than imported.
   *
   * A CLIENT COMPONENT MAY IMPORT A SERVER ACTION DIRECTLY, and doing so here would bind this
   * component to one write path. It is mounted by three surfaces — the contact page, a product
   * page and, in Phase 20's second half, the configurator's review step — and taking the action as
   * a prop is what lets a test drive it without a server.
   */
  readonly action: (
    payload: unknown,
  ) => Promise<
    | { ok: true; referenceCode: string; whatsappUrl: string | null; attachments: number }
    | { ok: false; code: 'invalid' | 'rate_limited' | 'save_failed'; fields?: readonly string[] }
  >
}

export function InquiryForm({ kind, copy, enquiryTypes, productId, action }: InquiryFormProps) {
  const [state, setState] = React.useState<SubmitState>({ status: 'idle' })
  const openedAt = React.useRef<number>(0)
  const continueRef = React.useRef<HTMLAnchorElement | null>(null)

  // WHEN THE FORM WAS RENDERED, not when the module loaded. `Date.now()` at module scope would be
  // the moment the bundle was evaluated, which on a client-side navigation is minutes earlier.
  React.useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  /*
   * THE AUTO-FORWARD, AND IT IS DELIBERATELY LAZY. One second is long enough for the reference code
   * to be read and for anybody who does not want WhatsApp to look away; `assign` rather than
   * `replace` so Back returns to the saved-enquiry state rather than to an empty form.
   */
  React.useEffect(() => {
    if (state.status !== 'sent' || state.whatsappUrl === null) return
    continueRef.current?.focus()
    const url = state.whatsappUrl
    const timer = window.setTimeout(() => {
      window.location.assign(url)
    }, 1000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [state])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState({ status: 'sending' })

    const text = (name: string): string => {
      const value = form.get(name)
      return typeof value === 'string' ? value.trim() : ''
    }

    const base = {
      name: text('name'),
      phone: text('phone'),
      email: text('email'),
      city: text('city'),
      message: text('message'),
      // WHICH PAGE THIS CAME FROM, read here rather than passed in. A section renderer is given its
      // section and its media, not the route it is being rendered on — and the browser's own
      // pathname is the honest answer anyway, including for a form mounted in a `final-cta` band
      // on a page nobody planned to put it on.
      sourcePath: window.location.pathname,
      website: text('website'),
      elapsedMs: openedAt.current === 0 ? undefined : Date.now() - openedAt.current,
    }

    const payload =
      kind === 'PRODUCT'
        ? { kind, productId: productId ?? '', ...base }
        : kind === 'QUOTE'
          ? { kind, productId: productId ?? null, ...base }
          : kind === 'GENERAL'
            ? { kind, enquiryType: text('enquiry_type'), ...base }
            : { kind, ...base }

    const result = await action(payload)

    // THE NARROWING IS THE GUARANTEE. There is no URL to read on the failure branch.
    if (result.ok) {
      setState({
        status: 'sent',
        referenceCode: result.referenceCode,
        whatsappUrl: result.whatsappUrl,
      })
      return
    }

    setState({
      status: 'error',
      message:
        result.code === 'rate_limited'
          ? copy.errorTooMany
          : result.code === 'save_failed'
            ? copy.errorSave
            : copy.errorGeneric,
      fields: result.fields ?? [],
    })
  }

  if (state.status === 'sent') {
    return (
      <Stack gap={4} data-inquiry-state="sent">
        <Heading level={3}>{copy.successHeading}</Heading>
        {state.referenceCode === '' ? null : (
          <Text data-inquiry-reference={state.referenceCode}>
            {interpolate(copy.reference, { code: state.referenceCode })}
          </Text>
        )}
        {state.whatsappUrl === null ? (
          <Text tone="secondary">{copy.savedWithoutWhatsApp}</Text>
        ) : (
          <>
            <Text tone="secondary">{copy.successBody}</Text>
            <a
              ref={continueRef}
              href={state.whatsappUrl}
              className="underline underline-offset-4"
              data-inquiry-continue
            >
              {copy.continueToWhatsApp}
            </a>
          </>
        )}
      </Stack>
    )
  }

  const invalid = (name: string): string | undefined =>
    state.status === 'error' && state.fields.includes(name) ? copy.errorGeneric : undefined

  return (
    <form onSubmit={onSubmit} noValidate data-inquiry-form={kind}>
      <Stack gap={5}>
        {state.status === 'error' ? (
          <div role="alert">
            <ErrorText>{state.message}</ErrorText>
          </div>
        ) : null}

        <Field label={copy.name} required requiredLabel={copy.required} error={invalid('name')}>
          <Input name="name" autoComplete="name" />
        </Field>
        <Field label={copy.phone} required requiredLabel={copy.required} error={invalid('phone')}>
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label={copy.email} error={invalid('email')}>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label={copy.city} error={invalid('city')}>
          <Input name="city" autoComplete="address-level2" />
        </Field>

        {kind === 'GENERAL' && enquiryTypes.length > 0 ? (
          <Field label={copy.enquiryType}>
            <Select name="enquiry_type" defaultValue="">
              <option value="" />
              {enquiryTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label={copy.message} error={invalid('message')}>
          <Textarea name="message" rows={5} />
        </Field>

        {/*
          THE HONEYPOT. Hidden from sight AND from assistive technology, out of the tab order, and
          declined by autofill. A script that fills every input it finds fills this one; nobody else
          meets it. See the header for why both hiding mechanisms are needed.
        */}
        <VisuallyHidden>
          <label aria-hidden="true">
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </VisuallyHidden>

        <div>
          <Button type="submit" disabled={state.status === 'sending'}>
            {state.status === 'sending' ? copy.sending : copy.submit}
          </Button>
        </div>
      </Stack>
    </form>
  )
}
