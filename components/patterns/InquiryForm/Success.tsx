'use client'

import * as React from 'react'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { interpolate } from '@/lib/cms/strings'

import type { InquiryCopy } from './types'

/**
 * What a visitor sees once the enquiry is SAVED — the same state whichever form produced it.
 *
 * SHARED BETWEEN THE CONTACT FORM AND THE CONFIGURATOR, deliberately. Two copies of this would be
 * two places for the reference sentence to drift, and the reference code is the one thing a visitor
 * must be able to quote back. The sentence is `SEED §48` plus the code, both from the CMS.
 *
 * THE AUTO-FORWARD LIVES HERE TOO, so both surfaces behave identically. One second is long enough
 * for the code to be read; the link is focused first, so somebody who does not want WhatsApp is
 * already on the control that says so rather than being moved without warning.
 */
export function InquirySuccess({
  copy,
  referenceCode,
  whatsappUrl,
}: {
  readonly copy: InquiryCopy
  readonly referenceCode: string
  readonly whatsappUrl: string | null
}) {
  const continueRef = React.useRef<HTMLAnchorElement | null>(null)

  React.useEffect(() => {
    if (whatsappUrl === null) return
    continueRef.current?.focus()
    const timer = window.setTimeout(() => {
      window.location.assign(whatsappUrl)
    }, 1000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [whatsappUrl])

  return (
    <Stack gap={4} data-inquiry-state="sent">
      <Heading level={3}>{copy.successHeading}</Heading>
      {/*
        NO CODE, NO SENTENCE. The reference lookup can fail after a successful write — a clock far
        enough out to miss the ten-minute window — and a sentence reading "Your reference is ." is
        worse than none. The enquiry is still saved, which is what the heading says.
      */}
      {referenceCode === '' ? null : (
        <Text data-inquiry-reference={referenceCode}>
          {interpolate(copy.reference, { code: referenceCode })}
        </Text>
      )}
      {whatsappUrl === null ? (
        <Text tone="secondary">{copy.savedWithoutWhatsApp}</Text>
      ) : (
        <>
          <Text tone="secondary">{copy.successBody}</Text>
          <a
            ref={continueRef}
            href={whatsappUrl}
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
