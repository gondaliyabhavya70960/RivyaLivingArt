import { expect, test } from '@playwright/test'

import { PUBLIC_ROUTES, reachable } from './routes'

/**
 * NOTHING MOVES WHEN SOMEBODY HAS ASKED FOR STILLNESS — WCAG 2.3.3, run in Phase 42.
 *
 * `prefers-reduced-motion` is not a preference about taste. For somebody with a vestibular
 * disorder, a parallax hero or a long autoplaying pan is nausea, and they have set the switch in
 * their operating system precisely so a site does not do it to them.
 *
 * TWO THINGS ARE CHECKED, and the second is the one that gets missed:
 *
 *   CSS — no element carries a running animation or a transition long enough to read as motion.
 *   MEDIA — no `<video autoplay>` is playing. A muted background video honours no CSS media query;
 *           it has to be paused in code, and almost nobody does it.
 *
 * IT RUNS IN ITS OWN FILE because `test.use({ reducedMotion })` is per-file context state, and a
 * preference that leaked into a neighbouring spec would make that spec assert the opposite of what
 * it says.
 */

test.describe('with prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' })
  test.skip(({ viewport }) => viewport?.width !== 1440, 'the preference does not vary by width')

  for (const route of PUBLIC_ROUTES) {
    test(`${route} runs no animation`, async ({ page }) => {
      test.skip(!(await reachable(page, route)), `${route} is not published in this database`)

      // Let anything that was going to start, start.
      await page.waitForTimeout(600)

      const moving = await page.evaluate(() => {
        const found: string[] = []
        for (const node of Array.from(document.querySelectorAll('*'))) {
          const element = node as HTMLElement
          const style = window.getComputedStyle(element)
          if (style.display === 'none' || style.visibility === 'hidden') continue

          const durations = `${style.animationDuration} ${style.transitionDuration}`
            .split(/[\s,]+/)
            .map((value) => {
              if (value.endsWith('ms')) return Number.parseFloat(value)
              if (value.endsWith('s')) return Number.parseFloat(value) * 1000
              return 0
            })
          /*
           * A THRESHOLD OF 100ms RATHER THAN ZERO. The standard exempts motion that is "essential"
           * and, in practice, a sub-100ms state change — a focus ring fading in, a hover colour — is
           * not what makes anybody ill. Demanding zero would fail on a correct design system and
           * teach people to disable this test.
           */
          if (durations.some((duration) => duration > 100)) {
            found.push(
              `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(' ')[0]}` : ''} ${style.animationDuration}/${style.transitionDuration}`,
            )
          }
          if (found.length >= 5) break
        }
        return found
      })

      expect(moving, `${route}: still animating with reduced motion requested`).toEqual([])
    })
  }

  test('no video plays by itself', async ({ page }) => {
    test.skip(!(await reachable(page, '/')), 'the home page is not published in this database')
    await page.waitForTimeout(800)

    const playing = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video'))
        .filter((video) => !video.paused)
        .map((video) => video.currentSrc || video.getAttribute('src') || '(no source)'),
    )
    expect(playing, 'a video is playing with reduced motion requested').toEqual([])
  })
})
