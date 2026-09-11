#!/usr/bin/env node
/**
 * NO THIRD PARTIES ON THE PUBLIC SITE (Phase 40)
 *
 * No analytics script, no tag manager, no chat widget, no font CDN, no cookie-banner vendor, no A/B
 * tool, no pixel. This crawls the built site and fails on any subresource pointing at an origin
 * outside `{ self, res.cloudinary.com, *.supabase.co }`.
 *
 * IT IS A PRIVACY POSITION FIRST AND A PERFORMANCE ONE SECOND, which is why it is a hard gate
 * rather than a budget. A third-party script tag hands that party the visitor's IP, their user
 * agent, the page they are on and the ability to run code in our origin — and D1 says this site
 * has no customer accounts and collects nothing it does not need. A tag that arrives "just for a
 * fortnight, to check the launch" is a tag nobody removes.
 *
 * THE THREE PERMITTED ORIGINS AND WHY EACH IS NOT A THIRD PARTY IN THIS SENSE. `self` is us.
 * `res.cloudinary.com` is the media the page is made of, under our account, version-pinned and
 * fetched as images rather than as code. `*.supabase.co` is our own database over its REST API.
 * None of the three can run script in this origin, and none is a party the visitor did not come
 * here to talk to. Everything else — including a Google Fonts stylesheet, which is a network
 * request to Google on every cold load — is refused.
 *
 * FONTS ARE SELF-HOSTED THROUGH `next/font`, so a `fonts.googleapis.com` link is not a convenience
 * this gate is being pedantic about; it is a regression away from a decision already taken.
 *
 * WHAT IT CHECKS: every `src` and `href` in the served HTML of each budgeted route, plus every
 * `@import` and `url(` in each same-origin stylesheet the page pulls, because a font CDN usually
 * arrives one level down inside CSS rather than in the markup.
 *
 *   node scripts/perf/check-third-party.mjs --base http://127.0.0.1:3000
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

/**
 * The allowlist, as host suffixes.
 *
 * A SUFFIX AND NOT A REGEX, deliberately: `endsWith('.supabase.co')` cannot be fooled by
 * `supabase.co.evil.example`, which a careless `includes()` would wave through.
 */
const ALLOWED_SUFFIXES = ['.supabase.co']
const ALLOWED_HOSTS = ['res.cloudinary.com']

const baseArg = process.argv.find((argument) => argument.startsWith('--base='))
const baseIndex = process.argv.indexOf('--base')
const base =
  baseArg !== undefined
    ? baseArg.slice('--base='.length)
    : baseIndex !== -1
      ? process.argv[baseIndex + 1]
      : 'http://127.0.0.1:3000'

const budgets = JSON.parse(readFileSync(join(ROOT, 'perf', 'budgets.json'), 'utf8'))

function isAllowed(url, origin) {
  let parsed
  try {
    parsed = new URL(url, origin)
  } catch {
    // A relative URL that will not parse even against the origin is not a network request we can
    // attribute to anybody; leave it to the browser.
    return true
  }
  if (parsed.origin === origin) return true
  // `data:` and `blob:` carry their payload with them and reach no third party.
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return true
  if (ALLOWED_HOSTS.includes(parsed.hostname)) return true
  return ALLOWED_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix))
}

/** Every `src`/`href` in the markup, with the attribute and tag that carried it. */
function subresourcesOf(html) {
  const found = []
  for (const match of html.matchAll(/<(script|link|img|iframe|source|video|audio)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase()
    const attributes = match[2]
    for (const attribute of ['src', 'href']) {
      const value = new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i').exec(attributes)
      if (value !== null) found.push({ tag, attribute, url: value[1] })
    }
  }
  return found
}

/** `url(...)` and `@import` targets inside a stylesheet. */
function cssTargets(css) {
  const found = []
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) found.push(match[1])
  for (const match of css.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) found.push(match[1])
  return found
}

const origin = new URL(base).origin
const problems = []
let pagesChecked = 0
let subresources = 0
const skipped = []

for (const routePattern of Object.keys(budgets.routes)) {
  // Static routes only: a bracket pattern needs a live slug, and this gate's question — "does this
  // page talk to anybody else" — is answered by the shell and the section renderers, which every
  // route shares. The dynamic routes are covered by `tests/e2e/perf-no-third-party.spec.ts`, which
  // has a real page open and can watch the requests rather than reading the markup.
  if (routePattern.includes('[')) continue

  const response = await fetch(new URL(routePattern, base))
  if (!response.ok) {
    skipped.push(`${routePattern} (${String(response.status)})`)
    continue
  }
  pagesChecked += 1
  const html = await response.text()

  for (const { tag, attribute, url } of subresourcesOf(html)) {
    subresources += 1
    if (!isAllowed(url, origin)) {
      problems.push(
        `${routePattern}: <${tag} ${attribute}="${url}"> — an origin outside the allowlist`,
      )
    }
  }

  // One level down, into our own stylesheets, where a font CDN usually hides.
  for (const { tag, attribute, url } of subresourcesOf(html)) {
    if (tag !== 'link' || attribute !== 'href' || !/\.css(?:\?|$)/.test(url)) continue
    if (!url.startsWith('/')) continue
    const sheet = await fetch(new URL(url, base))
    if (!sheet.ok) continue
    for (const target of cssTargets(await sheet.text())) {
      subresources += 1
      if (!isAllowed(target, origin)) {
        problems.push(
          `${routePattern}: ${url} references ${target} — an origin outside the allowlist`,
        )
      }
    }
  }
}

if (pagesChecked === 0) {
  console.error(
    `✗ third-party gate: no budgeted static route rendered at ${base} — nothing was checked, ` +
      'which is not the same as nothing being wrong' +
      (skipped.length > 0 ? `\n    skipped: ${skipped.join(', ')}` : ''),
  )
  process.exit(1)
}

if (problems.length > 0) {
  console.error(`✗ third-party gate: ${String(problems.length)} problem(s):`)
  for (const problem of problems) console.error(`    ${problem}`)
  console.error(
    '\n  The public site contacts this origin and only this origin, plus res.cloudinary.com for\n' +
      '  media and *.supabase.co for data. Fonts are self-hosted through next/font. If consent or\n' +
      '  analytics tooling is genuinely required it is built first-party and recorded as an\n' +
      '  amendment to CANONICAL-DECISIONS.md — not added as a tag.',
  )
  process.exit(1)
}

console.log(
  `✓ third-party gate: ${String(pagesChecked)} route(s), ${String(subresources)} subresource(s), ` +
    'no origin outside { self, res.cloudinary.com, *.supabase.co }' +
    (skipped.length > 0
      ? `; ${String(skipped.length)} route(s) did not render (${skipped.join(', ')})`
      : ''),
)
