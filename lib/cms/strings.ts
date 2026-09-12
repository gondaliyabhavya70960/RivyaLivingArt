import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * Site-wide strings, by `group_key.key`.
 *
 * SEED §1 and D2 put every visitor-readable string in the database. That includes the ones that
 * are not marketing copy — `ERROR.media_unavailable.label`, the empty-state messages, the
 * WhatsApp button's words — because "it's only chrome" is how a literal gets into JSX and how the
 * owner loses the ability to change it without a deploy.
 *
 * THERE IS NO FALLBACK, AND THAT IS THE POINT. A missing key returns null and the caller renders
 * nothing. A default here would put a sentence on the public site that nobody wrote, which is the
 * SEED §55 failure exactly — and it would do it invisibly, because the page would look finished.
 * `components/studio/strings.ts` deliberately does the opposite: Studio chrome must render before
 * any content exists, so it carries literals. The public site has no such excuse.
 */
export type SiteStrings = ReadonlyMap<string, string>

/** Only enabled rows. A disabled row is the owner saying "do not show this", not "show the old one". */
export function siteStrings(rows: readonly GlobalContent[]): SiteStrings {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!row.is_enabled) continue
    map.set(`${row.group_key}.${row.key}`, row.value)
  }
  return map
}

/** The string for a dotted key, or null. Blank values count as missing. */
export function siteString(strings: SiteStrings, key: string): string | null {
  const value = strings.get(key)
  return value === undefined || value.trim() === '' ? null : value
}

/**
 * The same, but never null — for a prop whose type demands a string.
 *
 * Returns `''`, which renders as nothing. Not a placeholder, not the key name: a visitor must
 * never be shown an internal identifier, and an editor chasing a blank label will find it in
 * Studio's global content screen, which lists the keys the site asked for and did not get.
 */
export function siteStringOrEmpty(strings: SiteStrings, key: string): string {
  return siteString(strings, key) ?? ''
}

/**
 * `{{token}}` substitution, for the handful of strings that must contain a number.
 *
 * ALMOST NO STRING NEEDS THIS, and that is why it is a separate function rather than something
 * `siteString` does. A sentence built out of fragments cannot be translated, reordered or even
 * reworded properly — "Page 2 of 7" is not "Seite 2 von 7" with the words swapped — so the whole
 * sentence lives in the row and the row names its own holes.
 *
 * The convention is `{{token}}`, matching `lib/whatsapp/templates.ts` exactly rather than
 * inventing a second spelling for the same idea. A token with no value is replaced by the empty
 * string: a missing number must never leave `{{page}}` visible to a visitor.
 */
const TOKEN = /\{\{([a-z_]+)\}\}/g

export function interpolate(value: string, tokens: Readonly<Record<string, string>>): string {
  return value.replace(TOKEN, (_match, token: string) => tokens[token] ?? '')
}

/**
 * The two media keys, named once.
 *
 * THREE COMPONENTS ASK FOR THE PLAY LABEL — `BlockVideo`, `HeroSection` and anything Phase 12 adds
 * — and a key spelled out at each call site is a key that gets misspelled at one of them. A
 * missing string renders as nothing at all rather than as an error, so the typo would ship as a
 * silently unlabelled control.
 */
export const MEDIA_FALLBACK_LABEL_KEY = 'ERROR.media_unavailable.label'
export const MEDIA_PLAY_LABEL_KEY = 'ACTION_LABEL.media.play'

/**
 * The four names `ContentCarousel` (RC-222) reads aloud, named once for the reason above.
 *
 * NOT IN `REQUIRED_SITE_STRINGS`, deliberately. That list is what a renderer cannot do without —
 * a media fallback and a play label, both of which leave a control unlabelled if absent. A carousel
 * degrades instead: no role description is an ordinary group, no arrow labels are no arrows, and
 * the row still scrolls with a finger, a trackpad and the arrow keys. Listing them as required
 * would make a missing label look like a defect rather than a smaller carousel.
 */
export const CAROUSEL_ROLE_KEY = 'UI_LABEL.carousel.roledescription'
export const CAROUSEL_POSITION_KEY = 'UI_LABEL.carousel.item_position'
export const CAROUSEL_PREVIOUS_KEY = 'ACTION_LABEL.carousel.previous'
export const CAROUSEL_NEXT_KEY = 'ACTION_LABEL.carousel.next'

/**
 * The four carousel names, resolved together.
 *
 * TWO CALLERS AND COUNTING — `CardLayout` (six blocks) and `PortfolioCardGrid` (RC-219, which draws
 * its own cards rather than `ReferenceCards`') — and four `siteString` calls at each is four chances
 * to mistype a key into a silently unlabelled control. Same reasoning as `MEDIA_PLAY_LABEL_KEY`
 * being a constant rather than a literal at three call sites.
 */
export function carouselLabels(strings: SiteStrings): {
  readonly roleDescription: string | null
  readonly itemPosition: string | null
  readonly previousLabel: string | null
  readonly nextLabel: string | null
} {
  return {
    roleDescription: siteString(strings, CAROUSEL_ROLE_KEY),
    itemPosition: siteString(strings, CAROUSEL_POSITION_KEY),
    previousLabel: siteString(strings, CAROUSEL_PREVIOUS_KEY),
    nextLabel: siteString(strings, CAROUSEL_NEXT_KEY),
  }
}

/** The `global_content` keys the section renderers ask for. Studio lists these as expected keys. */
export const REQUIRED_SITE_STRINGS = [MEDIA_FALLBACK_LABEL_KEY, MEDIA_PLAY_LABEL_KEY] as const
