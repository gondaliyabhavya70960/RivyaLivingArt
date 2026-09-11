import type { OwnerVerification } from '@/lib/supabase/schemas'

import { present } from './guard'

/**
 * `FAQPage` — ONLY the FAQ rows whose `owner_verification = 'VERIFIED'`, and no block at all when
 * none are.
 *
 * STRICTER THAN `verifiedOnly()`, DELIBERATELY. An FAQ answer is where lead times, materials and
 * care claims live — the exact sentences D10 lists — so the gate here is not "nothing to verify"
 * but "the owner has read this and said it is true". Every seeded answer is
 * OWNER_VERIFICATION_REQUIRED and stays out of the graph until a click makes it VERIFIED. The
 * page renders the answers regardless; the difference is that the page carries the site's own
 * caveats and a rich result does not.
 */

export type FaqPageJsonLd = {
  readonly '@type': 'FAQPage'
  readonly mainEntity: readonly {
    readonly '@type': 'Question'
    readonly name: string
    readonly acceptedAnswer: { readonly '@type': 'Answer'; readonly text: string }
  }[]
}

export type FaqRowLike = {
  readonly question: string
  readonly answer: string
  readonly owner_verification: OwnerVerification
  readonly status: string
}

export function faqPageJsonLd(rows: readonly FaqRowLike[]): FaqPageJsonLd | null {
  const entries = rows
    .filter((row) => row.status === 'PUBLISHED' && row.owner_verification === 'VERIFIED')
    .map((row) => ({ question: present(row.question), answer: present(row.answer) }))
    .filter(
      (row): row is { question: string; answer: string } =>
        row.question !== undefined && row.answer !== undefined,
    )
  if (entries.length === 0) return null
  return {
    '@type': 'FAQPage',
    mainEntity: entries.map((row) => ({
      '@type': 'Question',
      name: row.question,
      acceptedAnswer: { '@type': 'Answer', text: row.answer },
    })),
  }
}
