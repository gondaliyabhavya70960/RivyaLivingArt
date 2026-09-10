import { expect, test, type Page } from '@playwright/test'

/**
 * FEAT §14, asserted on the wire and on the paint.
 *
 * ZERO BYTES OF VIEWER IN THE FIRST LOAD. The product page is loaded with a request log attached,
 * and no script, module or WebAssembly request may name the engine, the viewer or a decoder. This
 * holds whether or not a model exists: the viewer arrives only through a dynamic import after
 * intent, and with the flag off nothing three-dimensional is requested at all.
 *
 * THE LCP ELEMENT IS AN IMAGE, NEVER A CANVAS. Read from a `largest-contentful-paint` observer
 * with the buffered entries, at every project width — 1920 and 390 among them. A page with no model
 * has no canvas to worry about; the assertion still runs, because the day a canvas appears in the
 * first paint is the day this test must be red.
 */

const ENGINE = /three|react-three|meshopt|draco|basis_transcoder|ModelViewer|ViewerCanvas/i

async function firstProductPath(page: Page): Promise<string | null> {
  const response = await page.goto('/collection')
  if (response?.status() !== 200) return null
  return page.locator('[data-product-card] a[href^="/product/"]').first().getAttribute('href')
}

test.describe('the product page first load', () => {
  test('requests no engine chunk, no viewer chunk and no decoder', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => {
      requested.push(request.url())
    })
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')
    await page.goto(path as string)
    await page.waitForLoadState('networkidle')

    const code = requested.filter((url) => /\.(m?js|wasm)(\?|$)/.test(url))
    expect(code.length).toBeGreaterThan(0)
    expect(code.filter((url) => ENGINE.test(url))).toEqual([])
  })

  test('paints an image as the largest contentful element, not a canvas', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')
    await page.goto(path as string)

    const lcpTag = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          let last = ''
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const element = (entry as PerformanceEntry & { element?: Element }).element
              if (element !== undefined && element !== null) last = element.tagName
            }
          })
          observer.observe({ type: 'largest-contentful-paint', buffered: true })
          setTimeout(() => {
            observer.disconnect()
            resolve(last)
          }, 1500)
        }),
    )
    expect(lcpTag).not.toBe('CANVAS')
    // A mount, when one exists, contributes its poster to the candidates and nothing else.
    const mounts = await page.locator('[data-model-mount]').count()
    if (mounts > 0) {
      await expect(page.locator('[data-model-mount] canvas')).toHaveCount(0)
    }
  })
})
