import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * The announcement bar's row set (SEED §9), reduced to what the bar renders.
 *
 * IT IS NULL FOR THE WHOLE OF PHASE 10 AS SEEDED, AND THAT IS THE DESIGNED OUTCOME. §9's message —
 * "Bespoke resin furniture, statement art and custom commissions." — asserts three services, so
 * Phase 09 seeded it `OWNER_VERIFICATION_REQUIRED` and therefore `DRAFT`. The public policy admits
 * only `PUBLISHED and is_enabled`, so the row does not arrive and the bar does not render. A
 * default message here would put an unverified claim at the top of every page on the site, which
 * is the D10 failure stated exactly.
 */
export type Announcement = {
  /**
   * The dismissal token, not a database id.
   *
   * THE PHASE DOCUMENT SAYS `rv_ann_dismissed=<row id>` AND THAT IS NOT ENOUGH, for a reason that
   * only shows up once. `global_content` is keyed by `(group_key, key)`, so there is exactly one
   * `ANNOUNCEMENT.bar.message` row and its id never changes — an editor announcing something new
   * edits that row's `value`. A cookie holding the id alone would therefore mean: a visitor who
   * dismissed the bar once never sees an announcement again, for any announcement, forever. The
   * bar would look broken to the owner and fine to everyone testing in a fresh browser.
   *
   * So the token is the id AND a hash of what the bar currently says. Dismissal stays per browser
   * and per announcement, which is what "dismissible" means; the cookie name and its per-browser
   * scope are unchanged from the phase document. Recorded as a deviation in ARCHITECTURE.md.
   */
  readonly token: string
  readonly message: string
  /** Both null or both present: a button with no destination is not rendered. */
  readonly ctaLabel: string | null
  readonly ctaHref: string | null
}

const GROUP = 'ANNOUNCEMENT'
const MESSAGE_KEY = 'bar.message'
const CTA_LABEL_KEY = 'bar.cta_label'
const CTA_HREF_KEY = 'bar.cta_href'

function enabledValue(rows: readonly GlobalContent[], key: string): GlobalContent | null {
  const row = rows.find((r) => r.group_key === GROUP && r.key === key && r.is_enabled)
  return row === undefined || row.value.trim() === '' ? null : row
}

/**
 * FNV-1a, 32-bit, hex.
 *
 * NOT A SECURITY BOUNDARY AND NOT TRYING TO BE. Nothing is authenticated by this value: a visitor
 * who forges it hides a banner from themselves. It needs to be stable across processes (so a
 * dismissal survives a deploy), cheap, and dependency-free so this module stays pure and testable.
 * `node:crypto` would satisfy the first two and cost the third.
 */
function hash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * The announcement, or null when there is nothing publishable to say.
 *
 * A CTA WITH ONLY HALF ITS PAIR IS DROPPED, not rendered with a missing destination or an unnamed
 * button. §9 supplies a label and an href as one decision, and an editor who disables one of the
 * two has said "no button", not "a button that goes nowhere".
 */
export function announcementFrom(rows: readonly GlobalContent[]): Announcement | null {
  const message = enabledValue(rows, MESSAGE_KEY)
  if (message === null) return null

  const label = enabledValue(rows, CTA_LABEL_KEY)
  const href = enabledValue(rows, CTA_HREF_KEY)
  const hasCta = label !== null && href !== null

  return {
    token: `${message.id}.${hash(message.value)}`,
    message: message.value,
    ctaLabel: hasCta ? label.value : null,
    ctaHref: hasCta ? href.value : null,
  }
}
