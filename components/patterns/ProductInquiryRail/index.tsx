import * as React from 'react'

import { Cluster } from '@/components/primitives/Cluster'
import { siteString, type SiteStrings } from '@/lib/cms/strings'

/**
 * The conversion rail — exactly three actions, chosen by name, and no others.
 *
 * THE ALLOWLIST IS THE FEATURE. The obvious implementation reads the `ACTION_LABEL` group and
 * renders what it finds, and that implementation would put `Place Order` on the page the day
 * somebody enables the row. This one names the three keys it will render and cannot render a
 * fourth: a new label added to the group appears in the Studio and nowhere else until a human edits
 * this array. Iterating the group would make the CMS able to add a checkout button to a business
 * that has no checkout.
 *
 * `Place Order` IS NOT RENDERED IN ANY FORM — not as a button, not as a disabled control, not as a
 * greyed affordance. A disabled checkout reads as a checkout that is temporarily unavailable, which
 * is the opposite of what D1 says about this business: there is no online checkout and there will
 * not be one. Phase 09 seeded the row `is_enabled = false`, so `siteStrings` already drops it from
 * the map, but that is the second lock. The first is that its key is not in the list below.
 *
 * NO WHATSAPP LINK ON THIS ROUTE, AND NOT BECAUSE OF STYLE. D1 requires an inquiry to be PERSISTED
 * before any WhatsApp redirect, and persistence does not exist until Phase 20. A `wa.me` link here
 * would hand a visitor to WhatsApp with nothing saved, which is precisely the failure the rule
 * exists to prevent. `scripts/site/check-whatsapp-usage.mjs` fails the build if one appears.
 *
 * NO CART, NO WISHLIST, NO STOCK COUNTER, NO "ONLY 2 LEFT". None of those has a data source, and
 * each would be a fabricated business fact (D10).
 */

/**
 * The three keys, in the order they are rendered. `ACTION_LABEL.` is prepended on lookup.
 *
 * Order is intent: the least committing action first. Someone who is unsure asks a question;
 * someone who knows what they want asks for a quote; someone who wants something else entirely
 * starts a commission.
 */
const RAIL_KEYS = ['ask_about_this_piece', 'request_a_quote', 'customize_this_piece'] as const

type RailKey = (typeof RAIL_KEYS)[number]

export interface ProductInquiryRailProps {
  readonly slug: string
  /**
   * Whether `Customize This Piece` renders at all.
   *
   * THREE FACTS, RESOLVED BY THE CALLER, NOT ONE READ HERE. `products.is_customizable` says the
   * piece can be commissioned differently; the caller ANDs it with "a customization form is bound to
   * this product or its category" and "the `commission_configurator` flag is on". The link goes to
   * `/custom-commissions?product=<slug>`, so any of the three being false makes it an invitation to
   * a page that will not answer — and an action a visitor presses and gets nothing from is worse
   * than one that was never offered.
   *
   * Resolved by the caller rather than here because this component is synchronous and reads no
   * database: see the note at the top of `components/sections/types.ts` on why that matters.
   */
  readonly isCustomizable: boolean
  readonly strings: SiteStrings
}

/**
 * Where each action goes.
 *
 * Every target carries `product=<slug>`, and that parameter is a CONTRACT rather than a
 * convenience: Phase 19's configurator and Phase 20's inquiry form both read it to know which piece
 * the visitor was looking at.
 *
 * `type` IS NOW A CONTRACT TOO, AND THE EDITORIAL REDESIGN IS WHY. Phase 15 wrote the parameter and
 * nothing read it, so "Ask About This Piece" and "Request a Quote" returned the identical URL and
 * both filed `kind = 'PRODUCT'` — two labelled affordances, one destination, and FEAT §49 question
 * 6 recorded a `FAIL` for it. `QUOTE` was a real enum value with a real schema, a real WhatsApp
 * template and a Studio inbox view that could never receive a row.
 *
 * The map is separate from the labels on purpose: a label is copy and lives in `global_content`,
 * while the enquiry kind a button files is a business fact and belongs in the code that routes it.
 * `InquiryForm` reads the value back through its own closed allowlist — this end writing a string
 * the other end does not accept would be a silent downgrade to the general form.
 */
const TYPE_BY_KEY: Readonly<Record<Exclude<RailKey, 'customize_this_piece'>, string>> = {
  ask_about_this_piece: 'product',
  request_a_quote: 'quote',
}

function hrefFor(key: RailKey, slug: string): string {
  const product = encodeURIComponent(slug)
  if (key === 'customize_this_piece') return `/custom-commissions?product=${product}`
  return `/contact?product=${product}&type=${TYPE_BY_KEY[key]}`
}

export function ProductInquiryRail({
  slug,
  isCustomizable,
  strings,
}: ProductInquiryRailProps): React.ReactElement | null {
  const actions = RAIL_KEYS.flatMap((key) => {
    if (key === 'customize_this_piece' && !isCustomizable) return []
    // A label the CMS does not have is an action that does not render. Never the key, never a
    // hard-coded English fallback — a visitor must not be shown an internal identifier, and copy
    // baked into JSX is what D2 forbids.
    const label = siteString(strings, `ACTION_LABEL.${key}`)
    if (label === null) return []
    return [{ key, label, href: hrefFor(key, slug) }]
  })

  // No actions means no rail. An empty <nav> with an accessible name is a promise of controls.
  if (actions.length === 0) return null

  return (
    <Cluster gap={3} data-inquiry-rail="">
      {actions.map((action, index) => (
        // The same two class strings SectionActions uses, so a CTA looks like a CTA wherever it is.
        // No `target="_blank"`: every destination here is this site's own.
        <a
          key={action.key}
          href={action.href}
          data-inquiry-action={action.key}
          className={
            index === 0
              ? 'inline-flex h-11 items-center rounded-(--rv-radius-sm) bg-surface-accent px-6 text-base text-ink-on-accent hover:brightness-110'
              : 'inline-flex h-11 items-center rounded-(--rv-radius-sm) border border-line-strong px-6 text-base text-ink hover:bg-surface-raised'
          }
        >
          {action.label}
        </a>
      ))}
    </Cluster>
  )
}
