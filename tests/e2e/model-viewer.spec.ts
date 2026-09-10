import { expect, test, type Page } from '@playwright/test'

/**
 * The viewer as the visitor meets it (FEAT §12, §14).
 *
 * ZERO MODELS TODAY, AND THE SUITE KNOWS IT. The manifest holds no GLB and none is generated, so
 * on a fresh database every product page has no mount. Every test below therefore has two branches:
 * with no mount, it proves the absence is clean (nothing three-dimensional is requested, no empty
 * slot); with a mount, it drives the poster, the intent control, the viewer and the keyboard
 * routes. The second branch runs the day the owner supplies a model and switches the flag on.
 */

const ENGINE = /three|react-three|meshopt|draco|basis_transcoder|ModelViewer|ViewerCanvas/i

async function firstProductPath(page: Page): Promise<string | null> {
  const response = await page.goto('/collection')
  if (response?.status() !== 200) return null
  return page.locator('[data-product-card] a[href^="/product/"]').first().getAttribute('href')
}

async function openProduct(page: Page): Promise<{ requested: string[] } | null> {
  const requested: string[] = []
  page.on('request', (request) => {
    requested.push(request.url())
  })
  const path = await firstProductPath(page)
  if (path === null) return null
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  return { requested }
}

test.describe('the 3D mount', () => {
  test('is absent without a model or with the flag off, and requests nothing three-dimensional', async ({
    page,
  }) => {
    const opened = await openProduct(page)
    test.skip(opened === null, 'no published products in this database')
    const mounts = await page.locator('[data-model-mount]').count()
    test.skip(mounts > 0, 'a model is mounted here — the poster-first test covers this page')

    expect(opened?.requested.filter((url) => ENGINE.test(url))).toEqual([])
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.locator('[data-model-poster]')).toHaveCount(0)
  })

  test('shows the poster first, loads the viewer on intent, and answers every key', async ({
    page,
  }) => {
    const opened = await openProduct(page)
    test.skip(opened === null, 'no published products in this database')
    const mount = page.locator('[data-model-mount]').first()
    test.skip((await mount.count()) === 0, 'no model is mounted on this product')

    // The poster is there before anything else is; nothing three-dimensional has been requested.
    await expect(mount.locator('[data-model-poster] img').first()).toBeVisible()
    const island = mount.locator('[data-model-island]')
    await expect(island).toHaveAttribute('data-model-capability', /offered|declined/)
    if ((await island.getAttribute('data-model-capability')) === 'declined') {
      await expect(mount.locator('[data-model-inspect]')).toHaveCount(0)
      expect(opened?.requested.filter((url) => ENGINE.test(url))).toEqual([])
      return
    }

    const control = mount.locator('[data-model-inspect]')
    if ((await island.getAttribute('data-model-autoload')) === null) {
      expect(opened?.requested.filter((url) => ENGINE.test(url))).toEqual([])
      await control.click()
    }

    const viewer = mount.locator('[data-model-viewer]')
    await expect(viewer).toBeVisible({ timeout: 30_000 })
    await expect(mount.locator('[data-viewer-progress]')).toHaveCount(1)
    await expect(viewer).toHaveAttribute('data-ready', '', { timeout: 60_000 })
    await expect(mount.locator('[data-viewer-progress]')).toHaveCount(0)

    // The canvas is named and described.
    const stage = viewer.locator('[data-viewer-canvas]')
    await expect(stage).toHaveAttribute('role', 'img')
    await expect(stage).toHaveAttribute('aria-label', /.+/)
    await expect(stage).toHaveAttribute('aria-describedby', /.+/)

    // Keyboard routes: fullscreen, escape, material inspection, reset.
    await stage.focus()
    await page.keyboard.press('f')
    await expect(viewer).toHaveAttribute('data-fullscreen', '')
    await page.keyboard.press('Escape')
    await expect(viewer).not.toHaveAttribute('data-fullscreen', '')
    await page.keyboard.press('m')
    await expect(viewer.locator('[data-viewer-material-panel]')).toHaveCount(1)
    await page.keyboard.press('m')
    await expect(viewer.locator('[data-viewer-material-panel]')).toHaveCount(0)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('+')
    await page.keyboard.press('r')

    // The controls are buttons with names, 44px tall.
    for (const selector of [
      '[data-viewer-reset]',
      '[data-viewer-material]',
      '[data-viewer-fullscreen]',
      '[data-viewer-close]',
    ]) {
      const button = viewer.locator(selector)
      await expect(button).toHaveAttribute('aria-label', /.+/)
      const box = await button.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    // Close returns to the poster.
    await viewer.locator('[data-viewer-close]').click()
    await expect(mount.locator('[data-model-viewer]')).toHaveCount(0)
    await expect(mount.locator('[data-model-poster] img').first()).toBeVisible()
  })
})

test.describe('under prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' })

  test('never loads on intersection; the poster and the control are the whole experience', async ({
    page,
  }) => {
    const opened = await openProduct(page)
    test.skip(opened === null, 'no published products in this database')
    const island = page.locator('[data-model-mount] [data-model-island]').first()
    test.skip((await island.count()) === 0, 'no model is mounted on this product')

    await island.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await expect(island).not.toHaveAttribute('data-model-autoload', '')
    expect(opened?.requested.filter((url) => ENGINE.test(url))).toEqual([])
    await expect(island.locator('[data-model-viewer]')).toHaveCount(0)
  })
})

test.describe('below 768px', () => {
  test('is opt-in only and opens fullscreen', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0
    test.skip(width >= 768, 'a wide viewport — the auto-load rules differ')
    const opened = await openProduct(page)
    test.skip(opened === null, 'no published products in this database')
    const mount = page.locator('[data-model-mount]').first()
    test.skip((await mount.count()) === 0, 'no model is mounted on this product')
    const island = mount.locator('[data-model-island]')
    if ((await island.getAttribute('data-model-capability')) !== 'offered') return

    await expect(island).not.toHaveAttribute('data-model-autoload', '')
    await mount.locator('[data-model-inspect]').click()
    const viewer = mount.locator('[data-model-viewer]')
    await expect(viewer).toBeVisible({ timeout: 30_000 })
    await expect(viewer).toHaveAttribute('data-fullscreen', '')
    await page.keyboard.press('Escape')
    await expect(mount.locator('[data-model-viewer]')).toHaveCount(0)
  })
})
