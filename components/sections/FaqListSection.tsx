import * as React from 'react'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { Faq } from '@/lib/supabase/schemas'

import { SectionActions } from './SectionActions'
import { cardHeadingLevel, hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Questions and answers from the `faqs` table.
 *
 * `<details>` RATHER THAN THE `Disclosure` PATTERN (RC-206), and it is a budget decision with an
 * accessibility dividend. `components/sections/registry.ts` imports every renderer, so one static
 * Client Component here is an island on all sixteen CMS routes — the lesson `HeroMotion` and
 * `MaterialSequence` taught in this same phase, where moving two of them to `next/dynamic` took the
 * public budget from seven islands to five. A native `<details>` costs zero: it is open to
 * find-in-page, to the keyboard and to assistive technology on arrival, it prints expanded, and it
 * works before any JavaScript has run. What it gives up is the animated collapse, which is the
 * cheapest thing on the page to give up.
 *
 * THE FIRST QUESTION IS OPEN. A page of ten closed rows looks like a page with no content on it,
 * and a visitor who has never used a disclosure list has nothing to tell them the rows expand. One
 * open row shows the shape of the thing.
 *
 * `<dl>` IS NOT USED, deliberately, though a question and an answer look like a description list.
 * A `<dt>` may not contain interactive content, so a `<summary>` inside one is invalid — and the
 * summary is what makes each row reachable. The list semantics come from `<ul>` instead.
 *
 * AN EMPTY BAND IS THE SEEDED STATE AND IS NOT AN ERROR. All ten answers are DRAFT until the owner
 * verifies them, so this renders its heading and nothing beneath it until they do. Returning null
 * would hide the heading too, and an editor looking at `/faq` should see the band they placed.
 *
 * STRUCTURED DATA IS THE ROUTE'S BUSINESS, NOT THIS BAND'S. `/faq` emits `FAQPage` from the
 * VERIFIED rows only (Phase 39) while this renders every row the database returns. The two rules
 * differ on purpose: a rich result is quoted out of context and carries none of the page's caveats.
 */
function FaqRow({ faq, open }: { readonly faq: Faq; readonly open: boolean }): React.ReactElement {
  return (
    <li data-entry-key={faq.id} className="border-b border-line">
      <details open={open} className="group">
        <summary
          className={[
            'flex cursor-pointer list-none items-center justify-between gap-4 py-4',
            'font-display text-md leading-heading text-ink',
            'transition-[color] duration-(--rv-duration-fast) ease-standard',
            'hover:text-ink-accent focus-visible:text-ink-accent',
          ].join(' ')}
        >
          {faq.question}
          {/* Decorative: the `<summary>` already carries the expanded state for a screen reader. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 shrink-0 transition-transform duration-(--rv-duration-fast) ease-standard group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="M5 7.5 10 12.5 15 7.5" />
          </svg>
        </summary>
        <Text size="base" tone="secondary" className="whitespace-pre-line pb-5">
          {faq.answer}
        </Text>
      </details>
    </li>
  )
}

/** `faqs.category` is the group's own heading. A row with none falls into an untitled last group. */
function groupsOf(faqs: readonly Faq[]): readonly (readonly [string | null, readonly Faq[]])[] {
  const byCategory = new Map<string | null, Faq[]>()
  for (const faq of faqs) {
    const key = faq.category === null || faq.category.trim() === '' ? null : faq.category
    const group = byCategory.get(key)
    if (group === undefined) byCategory.set(key, [faq])
    else group.push(faq)
  }
  // Named groups keep the order the rows arrived in; the untitled one goes last wherever it began.
  const named = [...byCategory].filter(([key]) => key !== null)
  const untitled = [...byCategory].filter(([key]) => key === null)
  return [...named, ...untitled]
}

export function FaqListSection({
  section,
  reference,
  livePaths,
  isFirst,
}: SectionRenderProps): React.ReactElement | null {
  const faqs = reference?.faqs ?? []
  if (faqs.length === 0 && !hasSectionCopy(section)) return null

  const byCategory = (section.layout_variant ?? 'flat') === 'by-category'

  return (
    <SectionShell section={section} container="prose">
      <Stack gap={8}>
        {/*
         * `level` IS PASSED, AND `/faq` IS THE REASON.
         *
         * `SectionCopy` defaults to `level = 2`, which is right for a band beneath a hero and
         * wrong for the only band on a page. `/faq` has exactly one section, so before this the
         * route rendered five h2s and NO h1 — `tests/e2e/a11y/headings.spec.ts` had never caught
         * it because the spec skips an unpublished route and `/faq` 404'd until Phase 45 seeded
         * this band. The moment it served 200, E2E went red on `main`.
         *
         * `content/seed/faq.ts` anticipated the gap but prescribed the wrong remedy — it says
         * "`SectionList` gives the FIRST section level 1, so typing a heading on this band is
         * enough". `SectionList` assigns no levels at all; only a renderer that passes one gets
         * anything but an h2, and this renderer passed none. A heading alone still produced an h2.
         * Measured, not reasoned: with the heading set and this prop absent, `/faq` served
         * 5 × h2 and 0 × h1.
         *
         * EVERY OTHER BLOCK ON THE SITE OPENS UNDER A `hero`, which is why no other renderer needs
         * this. `isFirst` is already threaded to every renderer for the eager-loading rule, so the
         * page's own opener is a fact this component already had.
         */}
        <SectionCopy section={section} size="display-sm" maxWidth="none" level={isFirst ? 1 : 2} />

        {faqs.length === 0 ? null : byCategory ? (
          <Stack gap={10}>
            {groupsOf(faqs).map(([category, rows], groupIndex) => (
              <Stack key={category ?? '—'} gap={2}>
                {category === null ? null : (
                  <Heading level={cardHeadingLevel(section)} size="display-xs">
                    {category}
                  </Heading>
                )}
                <ul className="list-none border-t border-line">
                  {rows.map((faq, index) => (
                    <FaqRow key={faq.id} faq={faq} open={groupIndex === 0 && index === 0} />
                  ))}
                </ul>
              </Stack>
            ))}
          </Stack>
        ) : (
          <ul className="list-none border-t border-line">
            {faqs.map((faq, index) => (
              <FaqRow key={faq.id} faq={faq} open={index === 0} />
            ))}
          </ul>
        )}

        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
