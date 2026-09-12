'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Textarea } from '@/components/primitives/Textarea'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'

import { InquirySuccess } from './Success'
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

/**
 * `?type=` → the enquiry kind it asks for. A CLOSED MAP, never a cast.
 *
 * FEAT §49 question 6 names six affordances and the audit found them resolving to ONE. Phase 15's
 * rail returned the same `/contact?product=<slug>&type=product` for "Ask About This Piece" and
 * "Request a Quote", and nothing anywhere read `type` — so `QUOTE` and `CONSULTATION` were real
 * enum values with real schemas, real WhatsApp templates and two Studio inbox views that could
 * never receive a row. This map is the missing half.
 *
 * A QUERY STRING IS UNTRUSTED INPUT, which is why it is a lookup rather than an uppercase-and-cast.
 * An unknown value falls through to the kind the section mounted with, so a mistyped or hostile
 * `?type=` gets the ordinary form rather than an error — and `submitInquiry` re-validates against
 * the Zod union regardless. The server is still the authority; this only decides which form a
 * visitor is looking at.
 */
const KIND_BY_QUERY: Readonly<Record<string, InquiryFormKind>> = {
  product: 'PRODUCT',
  quote: 'QUOTE',
  consultation: 'CONSULTATION',
  commission: 'COMMISSION',
}

export function InquiryForm({ kind, copy, enquiryTypes, action }: InquiryFormProps) {
  const [state, setState] = React.useState<SubmitState>({ status: 'idle' })
  const [productSlug, setProductSlug] = React.useState<string | null>(null)
  const [requestedKind, setRequestedKind] = React.useState<InquiryFormKind | null>(null)
  const openedAt = React.useRef<number>(0)

  // WHEN THE FORM WAS RENDERED, not when the module loaded. `Date.now()` at module scope would be
  // the moment the bundle was evaluated, which on a client-side navigation is minutes earlier.
  React.useEffect(() => {
    openedAt.current = Date.now()

    /*
     * `?product=` IS READ HERE, NOT ON THE SERVER, and for the reason `?step=` is on the
     * configurator: reading it server-side would make `/contact` a different document per query
     * string and lose the cached render for every visitor who arrives without one.
     *
     * IT IS WHAT MAKES THE PRODUCT ENQUIRY PATH WORK. Phase 15's rail links to
     * `/contact?product=<slug>&type=product`, so the piece a visitor was looking at travels in the
     * URL and the enquiry is filed against it — with no dialog, no second island on every product
     * page, and no modal a keyboard user has to escape from. Amendment A20.
     */
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('product')?.trim() ?? ''
    // `?type=` TRAVELS BESIDE `?product=` AND IS READ IN THE SAME PASS. A consultation names no
    // piece, so this cannot be nested inside the slug check the way the product read used to be —
    // that is precisely why `type` went unread: there was no branch it could have been reached on.
    const requested = KIND_BY_QUERY[params.get('type')?.trim().toLowerCase() ?? ''] ?? null
    if (slug === '' && requested === null) return

    // `startTransition` for the same reason the configurator's `?step=` read uses it: a synchronous
    // setState inside an effect is a cascading render, and the linter is right to say so. Nothing
    // here is urgent — the form is already usable, and naming the piece is an improvement to it.
    React.startTransition(() => {
      if (slug !== '') setProductSlug(slug)
      if (requested !== null) setRequestedKind(requested)
    })
  }, [])

  /*
   * WHICH ENQUIRY THIS IS, decided once and read in two places — the submitted payload and the
   * type picker below.
   *
   * THE SECTION'S OWN KIND WINS WHENEVER IT IS SPECIFIC. A band mounted as COMMISSION is a
   * commission form wherever it is linked from; only the GENERAL contact band is open to being
   * told what it is, because that is the one every rail points at. Within GENERAL the URL decides:
   * an explicit `?type=` first, then a bare `?product=` (Phase 15's original behaviour, kept), then
   * the plain contact form.
   */
  const effectiveKind: InquiryFormKind =
    kind !== 'GENERAL' ? kind : (requestedKind ?? (productSlug !== null ? 'PRODUCT' : 'GENERAL'))

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
      effectiveKind === 'PRODUCT'
        ? { kind: effectiveKind, productSlug: productSlug ?? '', ...base }
        : effectiveKind === 'QUOTE'
          ? { kind: effectiveKind, productSlug: productSlug ?? undefined, ...base }
          : effectiveKind === 'GENERAL'
            ? { kind: effectiveKind, enquiryType: text('enquiry_type'), ...base }
            : { kind: effectiveKind, ...base }

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
      <InquirySuccess
        copy={copy}
        referenceCode={state.referenceCode}
        whatsappUrl={state.whatsappUrl}
      />
    )
  }

  const invalid = (name: string): string | undefined =>
    state.status === 'error' && state.fields.includes(name) ? copy.errorGeneric : undefined

  /*
   * `data-inquiry-form` REPORTS WHAT THIS FORM WILL FILE, not what it was mounted as. Nothing
   * asserts its value — every spec uses it as a presence selector — and `effectiveKind` is the
   * honest answer now that `?type=` can change it, which also makes it the hook a conversion test
   * can read to prove the quote form is a quote form.
   */
  return (
    <form onSubmit={onSubmit} noValidate data-inquiry-form={effectiveKind}>
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

        {/*
          THE TYPE PICKER GOES WHEN THE URL HAS ALREADY ANSWERED. A visitor who arrived from a
          piece, or from a link that asked for a quote or a consultation, has already said what this
          is about — asking again invites an answer that contradicts the link they followed. Reading
          `effectiveKind` rather than `kind` is what extends that to `?type=`: before, only a named
          product removed the picker, so someone arriving at the quote form was still offered a
          dropdown that could disagree with it.
        */}
        {effectiveKind === 'GENERAL' && enquiryTypes.length > 0 ? (
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
