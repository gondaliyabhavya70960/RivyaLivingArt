import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader } from 'next/font/google'
import './globals.css'

/*
 * Two loaded families, latin subset, self-hosted by next/font (§3.1).
 * Only the display face is preloaded — ops/PERFORMANCE.md §2.2 permits exactly one,
 * and it belongs to the face that sets the first heading.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  weight: ['200', '300', '400', '500', '600', '700', '800'],
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
 * The root layout renders no chrome. Phase 10 adds app/(site)/layout.tsx around it;
 * this file exists because Next renders no route at all without a root layout.
 * The default ground is DEEP (§2.4); the Studio layout sets .rv-scheme-bone.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable}`}>
      <body className="rv-scheme-deep">{children}</body>
    </html>
  )
}
