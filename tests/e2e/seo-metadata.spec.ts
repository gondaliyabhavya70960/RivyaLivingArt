import { expect, test } from '@playwright/test'

/**
 * Phase 39 on the public site — verification 2, 3, 5, 12: the title template, the canonical
 * rule, the sitemap index and its six children, robots.txt and the X-Robots-Tag on /studio and
 * /api, and no forbidden key in any structured-data block. Every assertion tolerates the seeded
 * state (most pages unpublished) and says so.
 */

const FORBIDDEN =
  /"(aggregateRating|review|award|foundingDate|shippingDetails|returnPolicy|priceRange|openingHours)"/

test('robots.txt disallows the Studio and the API, and names the sitemap index when it can', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  const text = await robots.text()
  expect(text).toContain('Disallow: /studio')
  expect(text).toContain('Disallow: /api')
  if (text.includes('Sitemap:')) expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/)
})

test('the sitemap is an index over exactly six children, none of them images', async ({
  request,
}) => {
  const index = await request.get('/sitemap.xml')
  test.skip(index.status() === 404, 'no NEXT_PUBLIC_SITE_URL, so no sitemap in this environment')
  const xml = await index.text()
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '')
  expect(locs).toHaveLength(6)
  expect(locs.some((loc) => loc.includes('images'))).toBe(false)
  for (const loc of locs) {
    const child = await request.get(new URL(loc).pathname)
    expect(child.status(), loc).toBe(200)
    const body = await child.text()
    expect(body).toContain('<urlset')
    expect(body).not.toContain('priority')
    expect(body).not.toContain('changefreq')
  }
  expect((await request.get('/sitemaps/images.xml')).status()).toBe(404)
})

test('/studio and /api carry X-Robots-Tag: noindex, nofollow', async ({ request }) => {
  for (const path of ['/studio', '/api/revalidate']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.headers()['x-robots-tag'], path).toMatch(/noindex.*nofollow/)
  }
})

test('/search is noindex, follow with no canonical', async ({ page }) => {
  await page.goto('/search')
  const robots = await page.locator('meta[name="robots"]').getAttribute('content')
  expect(robots).toMatch(/noindex/)
  expect(robots).toMatch(/follow/)
  expect(await page.locator('link[rel="canonical"]').count()).toBe(0)
})

test('every reachable page carries at most one structured-data block with no forbidden key', async ({
  page,
}) => {
  for (const path of ['/', '/about', '/faq', '/contact', '/collection', '/journal', '/portfolio']) {
    await page.goto(path)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks.length, path).toBeLessThanOrEqual(1)
    for (const block of blocks) {
      expect(block, path).not.toMatch(FORBIDDEN)
      expect(() => JSON.parse(block)).not.toThrow()
    }
  }
})

test('a published page has a templated title and a canonical to itself', async ({ page }) => {
  const response = await page.goto('/about')
  test.skip(response?.status() !== 200, '/about is not published in this database')
  const title = await page.title()
  expect(title).toMatch(/\|/)
  expect(title).not.toMatch(/Rivya Living Art \| Rivya Living Art/)
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toMatch(/\/about$/)
})

test('the home page title is absolute, never the brand twice', async ({ page }) => {
  const response = await page.goto('/')
  test.skip(response?.status() !== 200, '/ is not published in this database')
  expect(await page.title()).not.toMatch(/\|.*\|/)
})
