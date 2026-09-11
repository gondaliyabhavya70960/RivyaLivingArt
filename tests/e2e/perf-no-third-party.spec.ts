import { expect, test, type Request } from '@playwright/test'

/**
 * THE PUBLIC SITE TALKS TO NOBODY ELSE — Phase 40, watched rather than read.
 *
 * `scripts/perf/check-third-party.mjs` reads the markup of each static route and the stylesheets it
 * pulls. That catches a tag somebody added. It cannot catch the thing that actually arrives later: a
 * `fetch` a script makes after hydration, a font a stylesheet pulls at a media query the crawler did
 * not match, an image loaded by an `IntersectionObserver`. A browser sees every one of them, because
 * it is the browser making them.
 *
 * THE ALLOWLIST IS THE SAME THREE ORIGINS and the reasoning is in the script's header: ourselves,
 * `res.cloudinary.com` for the media the page is made of, and `*.supabase.co` for our own database.
 * A font CDN is not a convenience this is being pedantic about — fonts are self-hosted through
 * `next/font`, and a `fonts.googleapis.com` request would be a regression away from a decision
 * already taken.
 *
 * IT IS A PRIVACY TEST AS MUCH AS A PERFORMANCE ONE. Every origin a page contacts learns the
 * visitor's IP and the page they are on, whether or not it returns anything useful.
 */

const ALLOWED_HOSTS = ['res.cloudinary.com']
const ALLOWED_SUFFIXES = ['.supabase.co']

const PUBLIC_ROUTES = ['/', '/collection', '/journal', '/search?q=table', '/contact']

function isThirdParty(request: Request, origin: string): boolean {
  let url: URL
  try {
    url = new URL(request.url())
  } catch {
    return false
  }
  if (url.origin === origin) return false
  if (url.protocol === 'data:' || url.protocol === 'blob:') return false
  if (ALLOWED_HOSTS.includes(url.hostname)) return false
  return !ALLOWED_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
}

test.describe('third-party origins', () => {
  test('no public route contacts an origin outside the allowlist', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const offenders: string[] = []

    page.on('request', (request) => {
      if (isThirdParty(request, origin)) {
        offenders.push(`${request.resourceType()} ${request.url()}`)
      }
    })

    let rendered = 0
    for (const route of PUBLIC_ROUTES) {
      const response = await page.goto(route)
      if (response?.status() !== 200) continue
      rendered += 1
      // Give anything that fires after hydration — a deferred fetch, a lazy image — a chance to run.
      await page.waitForLoadState('networkidle')
    }

    test.skip(rendered === 0, 'no public route rendered in this fixture')
    expect(offenders, `third-party requests: ${offenders.join(', ')}`).toEqual([])
  })

  test('a product page contacts nobody either', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://127.0.0.1:3000').origin

    const listing = await page.goto('/collection')
    test.skip(listing?.status() !== 200, '/collection did not render')
    const first = page.locator('a[href^="/product/"]').first()
    test.skip((await first.count()) === 0, 'no published product in this fixture')
    const href = await first.getAttribute('href')

    const offenders: string[] = []
    page.on('request', (request) => {
      if (isThirdParty(request, origin)) offenders.push(request.url())
    })
    await page.goto(href ?? '/')
    await page.waitForLoadState('networkidle')

    expect(offenders, `third-party requests: ${offenders.join(', ')}`).toEqual([])
  })

  test('the site loads no font from a CDN', async ({ page }) => {
    const fontRequests: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url())
    })
    const response = await page.goto('/')
    test.skip(response?.status() !== 200, '/ did not render')
    await page.waitForLoadState('networkidle')

    for (const url of fontRequests) {
      expect(url, 'a font came from somewhere other than this origin').toContain(
        new URL(page.url()).origin,
      )
    }
  })
})
