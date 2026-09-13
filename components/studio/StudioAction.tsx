import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

import { Text } from '@/components/primitives/Text'
import { cn } from '@/lib/ui/cn'

/**
 * A control you can hit with a thumb, in Studio's register rather than the showroom's.
 *
 * WHY NOT `primitives/Button`. It is a PILL — amendment A46 made every pressable thing on the
 * public site `rounded-full`, because confining roundness to what you press is what makes a
 * pressable thing legible on a cinematic page. A dense bench is the opposite brief: §4 of the
 * implementation guide asks Studio to be "quieter, faster" and its surfaces are `rounded-sm`
 * throughout. A pill beside a data table reads as marketing, which is precisely the
 * "public-cinematic" mismatch §7 anticipated when it listed `StudioButton` as *only if* needed.
 *
 * WHAT IT REPLACES, AND WHY IT IS THE SAME FIX IN SEVEN PLACES. §3.6: "touch targets on
 * underline-text buttons are below 44px". Studio's actions were `underline underline-offset-4` text
 * — the pin control, the filter bar's apply, the products search submit and its New link, the
 * inquiries export. Each is about 20px tall on the owner's phone, and each had its own markup. This
 * is one control, so the next screen does not invent an eighth.
 *
 * IT IS ALSO PHASE A's `TOP_BAR_CONTROL`, PROMOTED. That was a const string inside
 * `StudioTopBar.tsx` and it was already the right shape; leaving it there would have meant the
 * chrome and the lists drifting apart by exactly the amount nobody checks. §13 of the guide is
 * blunt about the stakes: "If every screen invents its own header, the rest of the redesign will
 * rot."
 *
 * SERVER-SAFE, deliberately. No `'use client'`, no handler prop: a link is a link and a button is a
 * `type="submit"` inside somebody's form. Studio's pages are Server Components and its forms work
 * before hydration — `StudioPage`'s pin control and `FilterBar`'s apply both say so — and a
 * control that needed an island would quietly take that away.
 */

export type StudioActionTone = 'default' | 'primary'

const TONE: Record<StudioActionTone, string> = {
  /** The ordinary control: a bordered surface that gains the accent on hover. */
  default: 'border-line bg-surface hover:border-(--rv-ink-accent)',
  /**
   * ONE PER SCREEN, and the guide's §8 checklist is why: "Primary action visible without scroll".
   * A page with two primary actions has none. The inverse fill is the same device the public
   * pill uses, without the pill.
   */
  primary: 'border-transparent bg-surface-inverse text-ink-inverse hover:brightness-125',
}

const BASE = cn(
  // `min-h-11` is 44px and the row IS the target — no `rv-hit-44` overlay, because these sit in
  // wrapping flex rows beside each other where an overlay would reach into its neighbour.
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4',
  'transition-colors duration-(--rv-duration-fast) ease-standard motion-reduce:transition-none',
)

type CommonProps = {
  /** Resolved copy, from `components/studio/strings.ts`. Never a literal at the call site. */
  readonly label: string
  readonly tone?: StudioActionTone
  readonly className?: string
}

/**
 * A destination. `href` is a Studio path from `lib/auth/studio-nav.ts` or a route the manifest
 * already covers — this component adds no route and resolves none.
 */
export function StudioActionLink({
  href,
  label,
  tone = 'default',
  className,
  ...rest
}: CommonProps & {
  readonly href: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'>): React.ReactElement {
  return (
    <Link href={href as Route} className={cn(BASE, TONE[tone], className)} {...rest}>
      <Text as="span" size="sm">
        {label}
      </Text>
    </Link>
  )
}

/**
 * A submit. It carries no `onClick`: every Studio mutation goes through a server action or a plain
 * `GET` form, which is what keeps these pages working before hydration.
 */
export function StudioActionButton({
  label,
  tone = 'default',
  className,
  type = 'submit',
  ...rest
}: CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>): React.ReactElement {
  return (
    <button type={type} className={cn(BASE, TONE[tone], className)} {...rest}>
      <Text as="span" size="sm">
        {label}
      </Text>
    </button>
  )
}

/**
 * An external destination — the CSV export, a WhatsApp deep link.
 *
 * A PLAIN `<a>` RATHER THAN `Link`, because these are not app routes: `/api/studio/inquiries/export`
 * is a response to download, and `next/link` would prefetch it. `@next/next/no-html-link-for-pages`
 * only complains about paths that ARE pages, so this stays clean.
 */
export function StudioActionAnchor({
  href,
  label,
  tone = 'default',
  className,
  ...rest
}: CommonProps & {
  readonly href: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'>): React.ReactElement {
  return (
    <a href={href} className={cn(BASE, TONE[tone], className)} {...rest}>
      <Text as="span" size="sm">
        {label}
      </Text>
    </a>
  )
}
