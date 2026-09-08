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
 * The two media keys, named once.
 *
 * THREE COMPONENTS ASK FOR THE PLAY LABEL — `BlockVideo`, `HeroSection` and anything Phase 12 adds
 * — and a key spelled out at each call site is a key that gets misspelled at one of them. A
 * missing string renders as nothing at all rather than as an error, so the typo would ship as a
 * silently unlabelled control.
 */
export const MEDIA_FALLBACK_LABEL_KEY = 'ERROR.media_unavailable.label'
export const MEDIA_PLAY_LABEL_KEY = 'ACTION_LABEL.media.play'

/** The `global_content` keys the section renderers ask for. Studio lists these as expected keys. */
export const REQUIRED_SITE_STRINGS = [MEDIA_FALLBACK_LABEL_KEY, MEDIA_PLAY_LABEL_KEY] as const
