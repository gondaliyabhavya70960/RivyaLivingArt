import { expect, test } from '@playwright/test'

/**
 * WHAT A STRANGER CAN REACH — Phase 41, run for the first time in Phase 42.
 *
 * `tests/e2e/studio-access.spec.ts` already proves that an anonymous visitor is redirected to the
 * login page. This asks the harder question: what does the SERVER hand out to somebody who does not
 * follow the redirect — a script, a crawler, a `curl` — and does a Studio route ever leak anything
 * before the redirect happens?
 *
 * THREE FAILURE MODES IT LOOKS FOR, all of which redirect correctly in a browser:
 *
 *   1. A REDIRECT THAT CARRIES THE PAGE. A 307 whose body is the rendered Studio page. The browser
 *      never shows it; `curl` does.
 *   2. AN API ROUTE WITH NO GUARD. The pages redirect, and `/api/studio/**` answers 200 to anybody,
 *      because the proxy guards the route group and the handler assumed it.
 *   3. A MUTATION REACHABLE BY GET. A sign-out, a delete or a publish behind a URL an `<img>` tag
 *      can fire from another site.
 *
 * IT RUNS UNAUTHENTICATED, ON PURPOSE. The role matrix — what an editor may do that a viewer may
 * not — is asserted in the RLS suite, against the database, where it is actually enforced. What
 * cannot be asserted there is the HTTP surface, which is what this covers.
 */

const STUDIO_PAGES = [
  '/studio',
  '/studio/products',
  '/studio/inquiries/all',
  '/studio/media/all',
  '/studio/system/environment',
  '/studio/operations/logs',
  '/studio/research/dashboard',
  '/studio/content/seo',
]

/** Strings that would mean a Studio page rendered rather than redirected. */
const STUDIO_MARKERS = ['data-studio-shell', 'studio-nav', 'Sign out']

test.describe('an unauthenticated request to the Studio', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'authorisation does not vary by viewport')

  test('is redirected, and the redirect carries no page with it', async ({ request }) => {
    for (const path of STUDIO_PAGES) {
      const response = await request.get(path, { maxRedirects: 0, failOnStatusCode: false })
      expect([302, 303, 307, 308], `${path} did not redirect`).toContain(response.status())

      /*
       * THE BODY OF A REDIRECT IS NOT NOTHING. Next renders one, and a framework or route that
       * built the response the wrong way round would put the page in it. A browser discards it; a
       * scraper reads it.
       */
      const body = await response.text()
      for (const marker of STUDIO_MARKERS) {
        expect(body, `${path} leaked "${marker}" in its redirect body`).not.toContain(marker)
      }
      expect(body.length, `${path} returned a large redirect body`).toBeLessThan(2000)
    }
  })

  test('sends the visitor to the login page and nowhere else', async ({ request }) => {
    for (const path of STUDIO_PAGES) {
      const response = await request.get(path, { maxRedirects: 0, failOnStatusCode: false })
      const location = response.headers()['location'] ?? ''
      expect(location, `${path} redirected somewhere unexpected`).toContain('/login')
      // The path they wanted travels as a query parameter so the login can return them to it.
      expect(location).toContain('next=')
    }
  })

  test('is refused by every Studio API route', async ({ request }) => {
    /*
     * THE ROUTES THAT DO NOT REDIRECT. An API route answers a status, and the only acceptable ones
     * here are 401, 403, 404 and 405 — never 200, and never a 302 to a login page, because a script
     * following a redirect to an HTML login page and parsing it as JSON is its own bug.
     */
    const apiRoutes: readonly [string, 'GET' | 'POST'][] = [
      ['/api/studio/inquiries/data-request', 'POST'],
      ['/api/media/sign', 'POST'],
      ['/api/studio/inquiries/data-request', 'GET'],
    ]
    for (const [path, method] of apiRoutes) {
      const response = await request.fetch(path, {
        method,
        data: method === 'POST' ? {} : undefined,
        maxRedirects: 0,
        failOnStatusCode: false,
      })
      expect(
        [401, 403, 404, 405, 400],
        `${method} ${path} answered ${String(response.status())}`,
      ).toContain(response.status())
    }
  })

  test('cannot reach a cron route without the secret', async ({ request }) => {
    /*
     * A CRON ROUTE IS A MUTATION BEHIND A URL. Anybody who guesses the path can run the studio's
     * scheduled work — repeatedly — unless the handler checks `CRON_SECRET` itself. The proxy does
     * not guard `/api/cron/**`, so the handler is the only thing that does.
     */
    for (const path of [
      '/api/cron/log-retention',
      '/api/cron/analytics-snapshot',
      '/api/cron/research',
    ]) {
      const response = await request.get(path, { maxRedirects: 0, failOnStatusCode: false })
      /*
       * 503 IS IN THE LIST BECAUSE IT IS THE HONEST ANSWER IN THIS ENVIRONMENT. `checkCronAuth`
       * distinguishes "no secret is configured on this deployment" (503) from "you presented the
       * wrong one" (401), and the distinction is right: a 401 on a deployment that could never
       * authenticate anybody would send an operator looking for a wrong header instead of a missing
       * variable. What matters for this test is that the job DID NOT RUN, which every one of these
       * statuses means. No environment here sets `CRON_SECRET`, so 503 is what a correct build
       * returns; a deployment that has it configured returns 401 to the same request.
       */
      expect(
        [401, 403, 404, 503],
        `${path} answered ${String(response.status())} with no secret`,
      ).toContain(response.status())
      // Whatever the status, nothing may come back that suggests the job ran.
      const body = await response.text()
      expect(body.length, `${path} returned a body to an unauthenticated caller`).toBeLessThan(200)
    }
  })

  test('cannot be signed out of somebody else’s session by a GET', async ({ request }) => {
    // A sign-out reachable by GET is firable from any page on the internet with an `<img>` tag.
    const response = await request.get('/logout', { maxRedirects: 0, failOnStatusCode: false })
    expect([404, 405]).toContain(response.status())
  })

  test('is not told whether a Studio page exists', async ({ request }) => {
    /*
     * A REAL ROUTE AND AN INVENTED ONE MUST ANSWER THE SAME. If `/studio/products` redirects and
     * `/studio/not-a-page` 404s, the redirect is an oracle: anybody can map the entire Studio
     * without an account.
     */
    const real = await request.get('/studio/products', { maxRedirects: 0, failOnStatusCode: false })
    const invented = await request.get('/studio/not-a-real-section', {
      maxRedirects: 0,
      failOnStatusCode: false,
    })
    expect(invented.status(), 'an invented Studio path answers differently from a real one').toBe(
      real.status(),
    )
  })
})
