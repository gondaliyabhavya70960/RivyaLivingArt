'use client'

import { usePathname } from 'next/navigation'
import * as React from 'react'

import type { VitalsMetric, VitalsRating, VitalsSampleInput } from '@/lib/supabase/schemas/vitals'

import { bucketDeviceMemory, bucketViewport, connectionType, navigationType } from './context'

/**
 * First-party Core Web Vitals reporting — Phase 40.
 *
 * The lab numbers in `perf/budgets.json` are one throttled profile in a data centre. This is the
 * other half: LCP, CLS, INP, TTFB and FCP as real browsers on real networks measured them, at a ten
 * per cent sample, beaconed to `/api/vitals`.
 *
 * IT SENDS NOTHING THAT COULD IDENTIFY ANYBODY, and the design rather than a promise is what makes
 * that true:
 *
 *   * THE ROUTE PATTERN, NEVER THE PATH. `/product/[slug]` says the product page is slow;
 *     the same path with a real slug in it says which visitor looked at which piece. `routePatternOf()` below
 *     turns the resolved pathname into its pattern, and the endpoint's Zod schema and the table's
 *     CHECK both refuse anything that still looks resolved.
 *   * NO COOKIE, NO STORAGE, NO ID. There is no session id to deduplicate with and none is
 *     invented. Two samples from the same visitor are two samples, indistinguishable from two
 *     visitors, which is the correct amount of knowledge for a performance table to have.
 *   * EVERY CONTEXT VALUE IS A BUCKET, computed here, before anything leaves the browser: the
 *     connection type the browser already named, memory as low/medium/high, viewport as
 *     mobile/tablet/desktop. `navigator.deviceMemory` and an exact viewport width are both known
 *     fingerprinting surfaces; a three-value bucket is not.
 *
 * IT REPORTS FROM PRODUCTION ONLY. `web_vitals_samples` has no environment column — deliberately,
 * because one more column is one more thing to segment by — so a preview deployment's numbers
 * would silently mix into the p75 that the team reads as "the site". The build-time constant below
 * is the gate, and it means the reporter is dead code in every other environment.
 *
 * A FAILED BEACON IS DROPPED IN SILENCE. `sendBeacon` returns false when the queue is full and the
 * `fetch` fallback can reject; neither is worth a retry, a console message or one byte of a
 * visitor's attention. The loss shows up where it should — the sample count in the Studio panel
 * stops rising.
 *
 * THE ISLAND IS THE COST, AND IT IS ONE. This is a client component in the site shell, so it is a
 * hydration boundary on every public route and is budgeted as one in `perf/budgets.json`. It
 * renders no DOM node: the whole component is an effect.
 */

/**
 * One page view in ten.
 *
 * WHY SAMPLE AT ALL when the rows are tiny. Because the endpoint is an unauthenticated write and
 * the honest way to size it is by what it must carry at peak, not by what a row costs. Ten per cent
 * is the rate the phase document fixes and the rate the Studio caption names, so anybody reading a
 * figure knows what it is a figure of.
 *
 * THE DIE IS CAST ONCE PER PAGE VIEW, not once per metric — five metrics from one page view either
 * all report or none do. Sampling per metric would give five independent p75s over five different
 * random subsets of page views, which is a subtly worse dataset for no gain.
 */
const SAMPLE_RATE = 0.1

/** Only production reports. See the header. */
const IS_PRODUCTION = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

/**
 * The resolved pathname, reduced to its route pattern.
 *
 * WHY IT IS DONE HERE AND NOT SERVER-SIDE. Next gives a Client Component the RESOLVED path through
 * `usePathname()`; the pattern is known to the server. Passing the pattern down as a prop from every
 * layout would be the direct route and would mean touching every route's props to add a performance
 * concern. Instead the shell passes the one pattern it knows — its own — and a client-side reduction
 * handles the rest.
 *
 * IT IS A DENY-LIST OF SHAPES, NOT A GUESS. Each rule below matches a real route in `app/(site)`
 * and replaces its dynamic segment with the bracket name that route uses. A path that matches
 * nothing falls through unchanged, which is exactly right for the static routes (`/about`,
 * `/faq`) — and a path that is dynamic and unrecognised would be refused by the endpoint rather
 * than stored, so a new dynamic route that forgets to add a rule here loses samples loudly instead
 * of storing a slug quietly. `tests/unit/vitals-payload.test.ts` asserts that every dynamic route
 * in the app directory has a rule.
 */
const PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/^\/product\/[^/]+$/, '/product/[slug]'],
  [/^\/collection\/[^/]+$/, '/collection/[category]'],
  [/^\/collections\/[^/]+$/, '/collections/[slug]'],
  [/^\/portfolio\/[^/]+$/, '/portfolio/[slug]'],
  [/^\/journal\/category\/[^/]+$/, '/journal/category/[slug]'],
  [/^\/journal\/[^/]+$/, '/journal/[slug]'],
]

export function routePatternOf(pathname: string): string {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const [shape, pattern] of PATTERNS) {
    if (shape.test(trimmed)) return pattern
  }
  return trimmed === '' ? '/' : trimmed
}

function send(sample: VitalsSampleInput): void {
  const body = JSON.stringify(sample)
  try {
    // A Blob with an explicit type, because `sendBeacon` otherwise sends `text/plain` and the
    // handler reads JSON. Same-origin, so the content type costs no preflight.
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon('/api/vitals', blob)) return
  } catch {
    // Fall through to fetch.
  }
  // `keepalive` is what lets the request outlive the page, which is the whole reason `sendBeacon`
  // exists; this is the fallback for browsers that have one and not the other.
  void fetch('/api/vitals', { method: 'POST', body, keepalive: true }).catch(() => undefined)
}

export function VitalsReporter(): null {
  const pathname = usePathname()
  /**
   * The pattern the metric callbacks will read, long after this render.
   *
   * IT IS SYNCED IN AN EFFECT, NOT DURING RENDER. Writing to a ref while rendering is the thing
   * React's rules of hooks forbid, and for a real reason here: under concurrent rendering a render
   * that is thrown away would still have moved the pattern, so a metric arriving in between would
   * be filed against a route the visitor never saw. An effect runs only for a commit that happened.
   */
  const patternRef = React.useRef(routePatternOf(pathname))

  React.useEffect(() => {
    patternRef.current = routePatternOf(pathname)
  }, [pathname])

  React.useEffect(() => {
    if (!IS_PRODUCTION) return
    if (Math.random() >= SAMPLE_RATE) return

    let cancelled = false

    void import('web-vitals')
      .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        if (cancelled) return
        const report = (metric: {
          name: string
          value: number
          rating: string
          navigationType?: string
        }): void => {
          send({
            route_pattern: patternRef.current,
            metric: metric.name as VitalsMetric,
            // CLS arrives as a small float; the others as milliseconds with sub-millisecond
            // precision nobody acts on. Three decimals keeps CLS meaningful and stops the column
            // storing seventeen digits of noise.
            value: Math.round(metric.value * 1000) / 1000,
            rating: metric.rating as VitalsRating,
            nav_type: navigationType(metric.navigationType),
            effective_type: connectionType(),
            device_memory_bucket: bucketDeviceMemory(),
            viewport_bucket: bucketViewport(),
          })
        }
        onCLS(report)
        onFCP(report)
        onINP(report)
        onLCP(report)
        onTTFB(report)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
    // Once per mount. The library reports per page view and handles soft navigations itself;
    // re-subscribing on every pathname change would double-report.
  }, [])

  return null
}
