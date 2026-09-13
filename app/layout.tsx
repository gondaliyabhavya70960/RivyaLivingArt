import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'

/*
 * Three loaded families, latin subset, self-hosted by next/font (§3.1, amendment A46).
 * Only the display face is preloaded — ops/PERFORMANCE.md §2.2 permits exactly one,
 * and it belongs to the face that sets the first heading.
 */

/*
 * INSTRUMENT SERIF REPLACES NEWSREADER, and the two differences that matter are not stylistic.
 *
 * IT SHIPS ONE WEIGHT. `next/font/google`'s metadata for this family is
 * `{"weights": ["400"], "styles": ["normal", "italic"]}` — so `weight` is REQUIRED here (a
 * single-weight family has no variable axis to infer from) and 400 is the only legal value.
 * Newsreader's seven-weight array would not merely be ignored, it fails the build. The knock-on
 * is in tokens.css: `--rv-weight-display-strong` was 500 and is now 400, because a 500 of this
 * face is a browser-synthesised smear rather than a cut.
 *
 * ITALIC IS LOADED ON PURPOSE, and it is the only reason a second style is here. `Heading`'s
 * highlight run needs a non-colour marking to satisfy WCAG 1.4.1 and used to get it from the
 * 500 weight. Instrument Serif's italic is a real cut, so the highlight keeps a genuine
 * distinction instead of a fake one.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--rv-font-display-src',
  adjustFontFallback: true,
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--rv-font-body-src',
  adjustFontFallback: true,
})

/*
 * THE THIRD FACE, AND WHY THE TWO-FAMILY CEILING IS NOT BREACHED BY IT.
 *
 * ops/PERFORMANCE.md §2.2 caps LOADED families at two, and `--rv-font-mono` was written to
 * respect that by shipping no file at all — a device-resident stack. That stack was fine while
 * mono was a developer affordance (an id, a checksum, a public_id in Studio). It is not fine now
 * that the eyebrow above every section heading is set in it: a device stack resolves to SF Mono,
 * Consolas or Liberation Mono depending on the visitor's machine, so the one typographic detail
 * that repeats on every band of every page would have looked different on every platform.
 *
 * The budget is paid for rather than ignored: this is `weight: '400'`, latin only, NOT preloaded,
 * and the display face's preload is still the only one. §2.2 is amended alongside this (A46)
 * rather than quietly exceeded.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: '400',
  variable: '--rv-font-mono-src',
  adjustFontFallback: true,
})

export const metadata: Metadata = {
  // Real site metadata is CMS-driven and arrives in Phase 39. This is the build-time
  // fallback only, and deliberately asserts nothing about the business.
  title: 'Rivya Living Art',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

/*
 * No `themeColor` here on purpose. It has to be a literal at build time, which would put a
 * colour outside the token layer and break the check-tokens gate — and metadata is Phase 39's
 * scope, not Phase 02's. When Phase 39 adds it, it must read the DEEP ground from tokens.css
 * rather than retyping the hex.
 */

/*
 * The root layout renders no chrome — `app/(site)/layout.tsx` is the public shell and
 * `app/(studio)/layout.tsx` is the Studio's. This file exists because Next renders no route at
 * all without a root layout. The default ground is DEEP (§2.4); the Studio layout sets
 * .rv-scheme-bone.
 *
 * `lang="en-GB"` AND NOT `en`. It is what a screen reader uses to choose a voice and a
 * pronunciation dictionary, and the seeded copy is British-leaning throughout — "Customise",
 * "Colour", "Enquiry". Announced in an American voice those are not wrong so much as subtly
 * mispronounced, and the fix is one attribute rather than a note in a style guide.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="rv-scheme-deep">{children}</body>
    </html>
  )
}
