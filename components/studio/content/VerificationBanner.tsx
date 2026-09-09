import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * The banner on a section the owner has to sign off, naming the claim rather than the rule.
 *
 * WHY A BANNER WHEN THE FORM ALREADY HAS A VERIFICATION FIELD. The field says WHAT the state is;
 * it does not say what the owner is being asked to confirm. An owner opening `/process` sees seven
 * sections all marked `OWNER_VERIFICATION_REQUIRED` and no indication that the seven are seven
 * DIFFERENT claims — that Rivya defines a brief, that it develops form, that it pours resin — each
 * of which they may be able to confirm separately. Verification is a judgement about a sentence,
 * so the sentence has to be in front of them.
 *
 * THE CLAIM IS THE SECTION'S OWN COPY, not a paraphrase written here. Whatever the heading and the
 * body say IS what publishing would assert, so quoting them cannot drift from what a visitor would
 * read. A summary written in this file could.
 *
 * THE NOTE IS SEEDED AND OPTIONAL. `STUDIO_HELP.verification.<seed key>` carries the specification's
 * own wording where it has some — SEED §16 says of step 04, verbatim, "Avoid specific production
 * claims until verified" — and nothing at all where it does not. An absent note renders nothing
 * rather than a generic sentence, because a generic sentence beside a specific claim reads as
 * boilerplate and gets skipped.
 *
 * IT RENDERS NOTHING FOR AN UNFLAGGED SECTION, including one already `VERIFIED`. A cleared claim is
 * not an outstanding task, and leaving the banner up would train an editor to ignore it.
 */

export type VerificationBannerProps = {
  readonly section: PageSection
  /** The seeded note for this section, or null when the specification gives no specific wording. */
  readonly note: string | null
}

export function VerificationBanner({
  section,
  note,
}: VerificationBannerProps): React.ReactElement | null {
  if (section.owner_verification !== 'OWNER_VERIFICATION_REQUIRED') return null

  // The heading is the claim in almost every case; a section with none (a divider, a media band)
  // falls back to its body's first line, which is the next most specific thing it asserts.
  const claim =
    section.heading ?? section.body?.split('\n').find((line) => line.trim() !== '') ?? null

  return (
    <Surface level={2} className="border-l-4 border-line-strong p-3">
      <Stack gap={1}>
        <Text size="sm">{t('studio.content.section.verificationBannerTitle')}</Text>
        {claim === null ? null : (
          <Text size="sm" tone="secondary" className="whitespace-pre-line">
            {claim}
          </Text>
        )}
        {note === null ? null : (
          <Text size="xs" tone="tertiary">
            {note}
          </Text>
        )}
        <Text size="xs" tone="tertiary">
          {t('studio.content.section.verificationHelp')}
        </Text>
      </Stack>
    </Surface>
  )
}
