import type { Page } from '@playwright/test'

/**
 * The routes the accessibility sweep covers, and the helper that skips one that is not published.
 *
 * EVERY CMS-BACKED ROUTE 404s UNTIL AN EDITOR PUBLISHES ITS SECTIONS, so a spec pinned to a path
 * would pass or fail on the contents of whichever database it ran against. Each test establishes
 * reachability first and skips with a reason, so a red run means something broke rather than
 * something was never published.
 */

/** Every public route a visitor can reach without an account. */
export const PUBLIC_ROUTES = [
  '/',
  '/collection',
  '/large-format',
  '/custom-commissions',
  '/portfolio',
  '/process',
  '/about',
  '/journal',
  '/faq',
  '/contact',
  '/search',
  '/privacy',
  '/terms',
] as const

/**
 * Studio routes an unauthenticated visitor reaches: the login page, and nothing else.
 *
 * The rest of the Studio is asserted by `tests/e2e/studio-access.spec.ts` (it redirects) and would
 * need `STUDIO_STORAGE_STATE` to sweep, which no environment in this repository can currently
 * produce — the local harness is PostgREST alone, with no auth server to sign in against.
 */
export const STUDIO_ROUTES = ['/login'] as const

export async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}
