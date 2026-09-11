/**
 * WHAT EACH VISUAL TIER IS FOR — Phase 42.
 *
 * A snapshot suite that covers everything equally is a suite whose failures nobody can triage: the
 * legal pages and the conversion path fail with the same weight, and the reviewer with twenty red
 * snapshots reads none of them. So the routes are tiered by what a regression on them COSTS.
 *
 *   TIER A — the conversion path. A visitor who cannot read these cannot reach the studio. A
 *            difference here blocks a release.
 *   TIER B — the rest of the public site. A difference is worth a look and rarely urgent.
 *   TIER C — legal and system pages. They change when the text changes and almost never otherwise.
 *
 * THE TIER DECIDES THE TOLERANCE, and that is the point of naming them. Tier A is held to a
 * ratio that catches a two-pixel shift; Tier C is not, because a reflowed paragraph of legal copy
 * is a content change and not a regression.
 */

export interface VisualRoute {
  readonly path: string
  /** Part of the snapshot filename, so a diff names the page rather than a path with slashes. */
  readonly name: string
}

export const TIER_A: readonly VisualRoute[] = [
  { path: '/', name: 'home' },
  { path: '/collection', name: 'catalogue' },
  { path: '/product/fixture-resin-dining-table', name: 'product-detail' },
  { path: '/contact', name: 'contact' },
  { path: '/large-format', name: 'large-format' },
]

export const TIER_B: readonly VisualRoute[] = [
  { path: '/custom-commissions', name: 'commissions' },
  { path: '/portfolio', name: 'portfolio' },
  { path: '/process', name: 'process' },
  { path: '/about', name: 'about' },
  { path: '/journal', name: 'journal' },
  { path: '/faq', name: 'faq' },
]

export const TIER_C: readonly VisualRoute[] = [
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/search', name: 'search' },
]

/** Studio surfaces an unauthenticated run can reach. See the note in `studio.visual.spec.ts`. */
export const STUDIO: readonly VisualRoute[] = [{ path: '/login', name: 'login' }]

/**
 * The tolerance each tier is held to, as a fraction of the image.
 *
 * 0.002 IS ABOUT A THOUSAND PIXELS IN A 1440×900 SHOT — a moved border, a changed letter-spacing, a
 * padding token off by two. Not a re-render of the same page, which is what a stricter number would
 * catch and what makes a snapshot suite get deleted.
 */
export const TOLERANCE = {
  A: 0.002,
  B: 0.005,
  C: 0.01,
} as const
