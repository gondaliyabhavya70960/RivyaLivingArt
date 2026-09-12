#!/usr/bin/env tsx
/**
 * THE CANONICAL HOST ANSWERS, AND DOES NOT REDIRECT TO SOMETHING THAT REDIRECTS BACK (Phase 45).
 *
 * WHY THIS EXISTS. On 2026-09-12 the live site was completely unreachable on both of its hosts:
 *
 *     rivyalivingart.com      → 308 → www.rivyalivingart.com
 *     www.rivyalivingart.com  → 308 → rivyalivingart.com
 *
 * ERR_TOO_MANY_REDIRECTS, every page, both addresses. Neither layer was wrong on its own. Vercel's
 * domain settings named `www` as the primary host, so the platform redirected the apex to it —
 * which is a dashboard setting this repository cannot see. `next.config.ts` redirects `www` to the
 * apex, because `NEXT_PUBLIC_SITE_URL` names the apex and D3 says the apex is the only address the
 * site has. Each rule is correct. Together they are a loop, and nothing in the repository could
 * have noticed: the build succeeds, every test passes, and the defect exists only in the
 * composition of a deployed platform setting with a compiled-in rule.
 *
 * THAT IS EXACTLY WHAT A PREFLIGHT GATE IS FOR — a check that has to run against the deployed
 * thing, because no amount of reading the source can answer it.
 *
 * WHAT IT ASSERTS. Starting at `NEXT_PUBLIC_SITE_URL`, follow redirects by hand, at most
 * MAX_HOPS of them. Three outcomes:
 *
 *   200 at the canonical host, no hops          → PASS. What D3 describes.
 *   a redirect chain that terminates elsewhere  → FAIL, naming the final host. The canonical URL
 *                                                 in every `<link rel=canonical>`, every sitemap
 *                                                 entry and every OG tag is then a URL that
 *                                                 redirects, which is a real SEO defect even
 *                                                 though the site loads.
 *   a host seen twice                           → FAIL, and print the cycle. This is the outage.
 *
 * IT IS A NETWORK CHECK AND SKIPS WITHOUT A TARGET. A local build has no apex to ask about, so an
 * unset or non-https `NEXT_PUBLIC_SITE_URL` is a skip with the reason stated, never a pass: a gate
 * that quietly passes when it did nothing is worse than no gate.
 *
 * IT NEVER FOLLOWS A REDIRECT AUTOMATICALLY. `redirect: 'manual'` is the whole mechanism — the
 * point is to see each hop, and a fetch that followed them would report the same
 * ERR_TOO_MANY_REDIRECTS a browser does, with none of the detail that makes it fixable.
 */

const MAX_HOPS = 5

interface Hop {
  readonly from: string
  readonly status: number
  readonly to: string
}

function fail(message: string): never {
  console.error(`✗ canonical host: ${message}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const site = process.env['NEXT_PUBLIC_SITE_URL']
  if (site === undefined || site === '') {
    console.log('- canonical host: SKIPPED — NEXT_PUBLIC_SITE_URL is not set')
    return
  }

  let start: URL
  try {
    start = new URL(site)
  } catch {
    fail(`NEXT_PUBLIC_SITE_URL is not a URL: ${site}`)
  }
  if (start.protocol !== 'https:') {
    console.log(
      `- canonical host: SKIPPED — ${start.origin} is not https, so this is a local build`,
    )
    return
  }

  const hops: Hop[] = []
  const seen = new Set<string>()
  let current = start.origin + '/'

  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const host = new URL(current).host
    if (seen.has(host)) {
      const cycle = [...hops.map((h) => h.from), host].join(' → ')
      fail(
        `${start.host} is in a redirect LOOP and no page on this site can load.\n` +
          `  ${cycle}\n` +
          `  Every hop above is a 30x. One of these two is redirecting in the wrong direction:\n` +
          `    · the platform's own domain setting (which host is primary), and\n` +
          `    · next.config.ts's redirects(), derived from NEXT_PUBLIC_SITE_URL.\n` +
          `  They must agree. D3 and the canonical tags name ${start.host}, so that is the host\n` +
          `  that should SERVE, and every other host should redirect to it.`,
      )
    }
    seen.add(host)

    let response: Response
    try {
      response = await fetch(current, { redirect: 'manual' })
    } catch (error) {
      fail(`could not reach ${current}: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (response.status < 300 || response.status > 399) {
      if (hops.length === 0) {
        if (response.status !== 200) {
          fail(`${start.host} answers ${String(response.status)}, not 200`)
        }
        console.log(`✓ canonical host: ${start.host} answers 200 directly, with no redirect`)
        return
      }
      fail(
        `${start.host} does not serve the site — it redirects to ${new URL(current).host}.\n` +
          `  ${[...hops.map((h) => `${h.from} →${String(h.status)}→ ${new URL(h.to).host}`)].join('\n  ')}\n` +
          `  Every canonical tag, sitemap entry and OG url names ${start.origin}, so each of them\n` +
          `  is a URL that redirects. Either make ${start.host} the primary host, or change\n` +
          `  NEXT_PUBLIC_SITE_URL to the host that actually serves.`,
      )
    }

    const location = response.headers.get('location')
    if (location === null || location === '') {
      fail(`${new URL(current).host} answered ${String(response.status)} with no Location header`)
    }
    const next = new URL(location, current).toString()
    hops.push({ from: new URL(current).host, status: response.status, to: next })
    current = next
  }

  fail(
    `more than ${String(MAX_HOPS)} redirects from ${start.host} without reaching a page.\n` +
      `  ${hops.map((h) => `${h.from} →${String(h.status)}→ ${new URL(h.to).host}`).join('\n  ')}`,
  )
}

await main()

export {}
