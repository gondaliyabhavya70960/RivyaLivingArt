---
doc: PERFORMANCE
status: CURRENT
owning_phase: 40
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
---

# PERFORMANCE — targets, budgets and how each is measured

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/architecture/ARCHITECTURE.md` §6 (caching layers and tag taxonomy) and
> §10 (posture summary), `docs/media/CLOUDINARY.md` §5–§7 (presets, width ladder, video policy),
> `docs/design/DESIGN_SYSTEM.md` §4 (motion and the reduced-motion contract),
> `docs/ops/TESTING.md` (how these suites run in CI), `docs/ops/ACCESSIBILITY.md` (2.3.3 overlap).
> Source specification: FEAT §46. Owned by Phase 40.

**The architectural commitment, stated once and absolutely: a heavy visual feature may never be on
the critical path of a first render.** Everything below is the measurable form of that sentence.

**Implementation status.** Nothing is built, so **every measured value in §8 reads NOT YET
MEASURED.** The budgets are binding on the phase that ships each route; the numbers in §8 are filled
in by measurement, never by estimate.

---

## 1. Metric targets

Site-wide, at the **75th percentile**, on a Moto G4 / Slow 4G lab profile, and — once field data
exists — on real devices.

| Metric | Web Vitals "good" | Rivya budget | Fails the build above |
|---|---|---|---|
| LCP | ≤ 2.5 s | Per route: 2.5 s media-led, 2.0 s text-led | The route's own value in `perf/budgets.json` |
| CLS | ≤ 0.1 | ≤ 0.05 | 0.05 |
| INP | ≤ 200 ms | ≤ 200 ms public · ≤ 300 ms Studio | 200 ms (public) |
| TTFB | ≤ 800 ms | ≤ 600 ms warm ISR · ≤ 1.2 s cold render | 800 ms warm |
| FCP | — | Tracked in the field, not budgeted | — |

Transferred bytes for the initial viewport, on every public route: **≤ 1.6 MB desktop, ≤ 900 kB
mobile.**

`perf/budgets.json` is the single source for these numbers. Both Lighthouse CI and the guard scripts
read it, so a budget cannot be met in one place and missed in another.

---

## 2. The rules (FEAT §46), each with a guard

A rule with no guard is a preference. Each row's guard runs in `npm run check` or in CI.

| Rule | Guard | Failure mode |
|---|---|---|
| Server Components by default; Client Components only where interaction demands | `scripts/site/check-client-boundary.mjs` for the boundary, and `scripts/site/check-island-budget.mjs` for the count — the island counter Phase 11 shipped, at the path its phase document names. **Phase 40 must not build a second one at `scripts/perf/count-islands.mjs`**: two counters with two definitions of "island" is how a route passes one and fails the other | CI red, naming the module |
| Responsive Cloudinary transformations | `scripts/perf/check-image-props.mjs` — every `MediaImage` declares `sizes`; no raw `<img>` outside `lib/media/**`; no inline transformation string | CI red |
| AVIF/WebP where appropriate | `f_auto` is the only format directive permitted in `lib/media/transform.ts`; a unit test asserts no hard-coded `f_jpg` outside the `og` preset | Unit test |
| Optimised video, posters always | `scripts/perf/check-video-props.mjs` — every `MediaVideo` has a poster, `preload="none"`, `muted`, `playsInline`, and **no `autoplay` attribute in markup** (autoplay is a runtime decision behind gates) | CI red |
| Dynamic imports, lazy 3D | `scripts/perf/check-bundle.mjs` — no route's first-load module graph may contain `three`, `@react-three/*`, or a Draco/meshopt decoder | CI red |
| Caching and CDN delivery | `scripts/perf/check-cache-headers.mjs` against a running production build, asserting §5 | CI red |
| JavaScript growth | `perf/bundle-baseline.json` committed; > 5 % growth on any route, or any new dependency entering a first-load graph, fails until the baseline is updated **in the same PR with a stated reason** | CI red |
| No third parties | `scripts/perf/check-third-party.mjs` — zero `<script src>`, `<link href>` or `fetch` to an origin outside `{self, res.cloudinary.com, *.supabase.co}` | CI red |
| Exactly one `priority` image per route | `scripts/perf/check-priority-images.mjs` plus Lighthouse's reported LCP element selector | CI red |

### 2.1 Two rules that are absolute

**The LCP element is always an image.** Never a video, never a WebGL canvas, never a web font, never
a CSS gradient standing in for one. A hero with motion paints its still first; the video element
mounts afterwards.

**No third-party origin is contacted by any public route.** No analytics script, tag manager, chat
widget, font CDN, cookie-banner vendor, A/B tool or pixel. This is simultaneously a performance, a
privacy, a CSP and a supply-chain position — which is why it is enforced by script rather than by
intention.

### 2.2 Fonts

`next/font`, self-hosted, subset to Latin, at most two families (one display, one text),
`font-display: swap`, and **only** the display face used above the fold is preloaded.
Metric-compatible fallbacks are declared so a swap costs no layout shift.

---

## 3. Per-route budgets

**`perf/budgets.json` is the source. The table below renders it and adds nothing.** Phase 40 moved
these numbers into a file so that the Lighthouse assertions, the four guard scripts and this document
cannot disagree about them; a number typed in two places is a number that will.

"First-load JS" is gzipped and excludes any dynamically imported chunk that is not requested on load
— `scripts/perf/measure-bundles.mjs` produces exactly that figure by asking a running production
build for each page and totalling the scripts its HTML tells the browser to fetch. "Islands" counts
distinct client-component roots (`scripts/perf/island-graph.mjs`).

**Two columns, because a target and a measurement are different claims.** `Target` is what
PHASE-39-46.md fixed. `Measured` is what the site weighed on the date in §8. Where they differ the gap
is real and named in §4.5 — it is not quietly raised to whatever was measured. What stops further
drift meanwhile is `perf/bundle-baseline.json`: CI fails on growth of more than 5% from the recorded
figure.

**The island budgets are set at the measured count, deliberately.** The phase document's island
numbers (3 for `/`, 2 for `/about`, 1 for `/faq`) were written before Phase 10 gave the site a shell
and Phase 23 put search in it. Every public route now inherits five islands it did not choose —
`SiteErrorCopy`, `MegaMenu`, `MobileNav`, `SearchCombobox`, `VitalsReporter` — and a budget that was
red from the day it was written would be a budget nobody looked at.

| Route | LCP target | JS target | JS measured | Islands | LCP image |
|---|---|---|---|---|---|
| `/` | 2.5 s | 180 kB | 282.0 kB | 7 | yes |
| `/about` | 2.5 s | 150 kB | 282.0 kB | 7 | yes |
| `/process` | 2.5 s | 150 kB | 282.0 kB | 7 | yes |
| `/large-format` | 2.5 s | 150 kB | 282.0 kB | 7 | yes |
| `/collection` | 2.5 s | 175 kB | 280.8 kB | 7 | yes |
| `/collection/[category]` | 2.5 s | 175 kB | 280.8 kB | 7 | yes |
| `/product/[slug]` | 2.5 s | 190 kB | **190.5 kB** | 6 | yes |
| `/collections/[slug]` | 2.5 s | 165 kB | not measurable | 7 | yes |
| `/portfolio` | 2.5 s | 150 kB | 282.0 kB | 7 | yes |
| `/portfolio/[slug]` | 2.5 s | 150 kB | not measurable | 7 | yes |
| `/journal` | 2.0 s | 140 kB | 280.8 kB | 7 | yes |
| `/journal/[slug]` | 2.0 s | 140 kB | 282.0 kB | 7 | yes |
| `/journal/category/[slug]` | 2.0 s | 140 kB | **182.8 kB** | 5 | no — text-led |
| `/custom-commissions` | 2.5 s | 200 kB | 280.8 kB | 7 | yes |
| `/contact` | 2.0 s | 160 kB | 282.0 kB | 7 | yes |
| `/faq` | 2.0 s | 120 kB | not measurable | 7 | yes |
| `/privacy` | 2.0 s | 120 kB | not measurable | 7 | yes |
| `/terms` | 2.0 s | 120 kB | not measurable | 7 | yes |
| `/search` | 2.0 s | 170 kB | **182.8 kB** | 5 | no — text-led |
| 3D viewer chunk | — | 350 kB | not in any first load | — | — |
| `/studio/**` | — | 320 kB | not yet measured | ≤ 8 | — |

Transferred bytes for the initial viewport: ≤ 1.6 MB desktop, ≤ 900 kB mobile, every public route.

"Not measurable" means the local content fixture has no live row of that shape, so no page rendered
to measure: the six seeded sections of `/faq`, `/privacy` and `/terms` are all
`OWNER_VERIFICATION_REQUIRED` and stay unpublished, and no collection or portfolio project is
published yet. Phase 42's `scripts/test/seed-fixture.ts` is chartered to produce a complete published
fixture, and the baseline gains those rows when it exists. `node scripts/perf/check-bundle.mjs --base
<url>` names every route it could not measure on every run, so the gap cannot go quiet.

---

## 4. Per-surface budgets

The four surfaces where performance is hardest, with their own contracts.

### 4.1 Homepage video hero

| Property | Rule |
|---|---|
| LCP element | The **poster still**, delivered through the `hero-xl` preset with `priority` and `sizes` |
| Video mount | After the still has painted, by `HeroMotion`, and only when **all** gates pass: `muted`, `playsInline`, duration ≤ 12 s, `prefers-reduced-motion: no-preference`, viewport ≥ 768 px, `navigator.connection.saveData` unset |
| When a gate fails | **No `<video>` element mounts at all.** The poster renders with a visible play control |
| `preload` | `none`, always |
| Delivery | `f_auto:video,q_auto,vc_auto`; progressive MP4. No HLS — 5–10 s clips do not justify packaging |
| Layout | The media box reserves its aspect ratio from the CMS slot, so mounting the video contributes **zero** CLS |
| Byte ceiling | Poster ≤ 250 kB; the first 3 s of video ≤ 1.2 MB on desktop. The video is not counted in the mobile initial-viewport budget because it does not mount below 768 px |
| Measured by | Lighthouse LCP element assertion, `check-video-props.mjs`, `tests/e2e/homepage-motion.spec.ts` (no `<video>` under reduced motion), and a CLS assertion across the mount |

### 4.2 Product gallery

| Property | Rule |
|---|---|
| Above the fold | Exactly one image is `priority` — the first gallery frame. Every other frame is lazy |
| Thumbnails | `thumb` preset (`w_160`, `q_auto:eco`) |
| Full frames | `grid` at 768 px, `hero` at 1600 px, chosen by `sizes`; the width ladder is `320 · 480 · 640 · 768 · 1024 · 1280 · 1536 · 1920 · 2560` |
| Lightbox | Dynamically imported on first open; its chunk may not appear in the route's first load |
| Layout | Every frame renders inside a reserved aspect box; navigating frames must produce **zero** CLS |
| Interaction | Frame change ≤ 100 ms to first paint of the new frame's placeholder; INP ≤ 200 ms including swipe |
| Byte ceiling | Initial gallery payload ≤ 500 kB mobile, ≤ 900 kB desktop, counting only what loads before interaction |
| Measured by | `check-image-props.mjs`, Lighthouse on `/product/[slug]`, `tests/e2e/touch.spec.ts`, a CLS assertion across three frame changes |

### 4.3 3D viewer

| Property | Rule |
|---|---|
| First load | **Zero bytes.** `three`, `@react-three/fiber`, `drei`, Draco and meshopt may not appear in any route's first-load module graph — asserted on the graph, not by eye |
| Mount | `next/dynamic` with `ssr: false`, behind `components/patterns/ModelViewerMount.tsx` and an **explicit intent gate** (a user action), plus the `feature_flags` entry |
| Chunk budget | ≤ 350 kB gzipped including decoders |
| Model budget | ≤ 8 MB per GLB after Draco/meshopt compression; texture set ≤ 4 MB; poly count recorded on the `media_assets` row so a regression is visible in data |
| Poster | Always present; it is what the route renders until the viewer is requested |
| Fallbacks | Reduced motion: no auto-rotate, no intro, no idle motion. `deviceMemory < 4`: the viewer is not offered. `saveData`: not offered |
| Progress | A loading state with real progress, not an indefinite spinner |
| Measured by | `scripts/perf/check-bundle.mjs` — a static walk of every route's CLIENT import graph that fails on any `three`, `@react-three/*` or `meshoptimizer` specifier and on a viewer reached other than through the island's dynamic import; in `npm run check` and CI since Phase 21. `tests/e2e/model-performance.spec.ts` (no engine, viewer or decoder request in the first load; LCP element never a canvas, at every QA width), `tests/e2e/model-viewer.spec.ts` with the flag **on and off**, and a manual mid-range-device check recorded in §8.3 |

### 4.4 Studio data grids

| Property | Rule |
|---|---|
| Rendering | Server Components render the page and the first page of rows; the client island owns selection, filters and the drawer |
| Pagination | Server-side, default 50 rows, hard maximum 200. **No unbounded list exists anywhere in the Studio** |
| Virtualisation | Only above 200 visible rows, and only where pagination cannot serve the task |
| First-load JS | ≤ 320 kB for any `/studio/**` route |
| INP | ≤ 300 ms for sort, filter, selection and drawer open |
| Query budget | ≤ 6 database round trips per Studio list page (public routes: ≤ 4) |
| Images | `thumb` preset only; a Studio table never requests a `hero` derivative |
| Caching | `private, no-store` on every response — cached authenticated output is a data-leak class of bug, not a performance opportunity |
| Measured by | `count-islands.mjs`, the request-scoped query counter, `tests/visual/studio.visual.spec.ts`, and an INP assertion on `/studio/catalog/products` with the fixture's full row set |

---

### 4.5 The three findings Phase 40's measurement produced

Publishing a budget is only worth doing if somebody then reads the number. These are what the first
reading found, both dated 2026-09-11 against a local production build.

#### Finding 1 — every hero on the site was fetched at default priority. FIXED in this phase.

`MediaImage` had a `loading` prop and no priority hint, and `MediaSlot` threaded `eager={isFirst}`
through to it. So the largest image on every page was correctly un-deferred and then queued behind
every stylesheet and script the parser had already found. `loading="eager"` stops the browser
DEFERRING a request; it does nothing about its position in the queue.

The fix is a `priority` prop on `MediaImage` that sets `fetchpriority="high"` as well as eager, and
`priority={isFirst}` beside the existing `eager={isFirst}` in `HeroSection`, `SignatureMediaSection`
and the product gallery's first frame. `ResponsiveMedia` passes it to the MOBILE half of a
desktop/mobile pair only — two high-priority images demote each other, and the constrained device is
the one the hint is for.

`scripts/perf/check-priority-images.mjs` crawls the built site and fails on a route with none or with
two. It found ten routes with none before the fix, which is how the defect was found in the first
place.

#### Finding 2 — the section registry puts ~98 kB gzipped on every CMS route. NOT fixed. Tracked here.

The numbers in §3 fall into two clean groups: routes that render CMS sections weigh 280.8–282.0 kB,
and routes that do not weigh 182.8–190.5 kB. `/product/[slug]` — a page with a gallery, a lightbox
and an inquiry launcher — is 90 kB LIGHTER than `/privacy` would be. The one structural difference is
`components/sections/registry.tsx`, which statically imports all twenty-nine section renderers so
that any page rendering any section reaches all of them.

The single largest component of the difference is **83.5 kB gzipped (374 kB raw) of Zod**, arriving as
an eagerly-executed `<script>` on every CMS route and absent from `/product/[slug]`. It is reachable
only through `lib/cms/forms.ts`, which the configurator and the enquiry form import for client-side
field validation — and both of those are LAZY islands. Turbopack hoists the shared dependency of a
lazy module into an eagerly-loaded chunk, so the `import()` boundary does not buy what it looks like
it buys.

**Why it is not fixed in Phase 40.** Both candidate fixes are architecture rather than tuning, which
the phase document puts out of scope: making the registry's renderers dynamic changes how every CMS
page streams, and removing Zod from the client means rewriting the validation of a
conversion-critical form. Either deserves its own change, measured before and after with the harness
this phase just built — which is the honest order to do them in.

**What holds the line meanwhile.** `perf/bundle-baseline.json` records 282.0 kB, so nothing may add
to it beyond 5% without a deliberate, reviewed edit; and `check-bundle.mjs` prints the over-target
list on every run rather than staying quiet about it.

#### Finding 3 — Studio answered with no `Cache-Control` at all. FIXED in this phase.

The contract asks for `private, no-store` on every Studio response and none was set. An absent header
does not mean "do not cache": every intermediary applies its own heuristic, and the heuristic for a
200 with a `Last-Modified` is to keep a copy. A Studio page carries enquirer names, draft copy and the
research corpus. `next.config.ts` now sets it alongside the Phase 39 `X-Robots-Tag`, and
`scripts/perf/check-cache-headers.mjs` asserts it.

---

## 5. The caching contract

Written down once so it is not re-decided per route. `ARCHITECTURE.md` §6 owns the tag taxonomy.

| Surface | Strategy | Invalidation |
|---|---|---|
| CMS pages (13 static paths) | ISR, `revalidate = 3600` | `revalidateTag('page:<path>')` from the publish service |
| `/product/[slug]` | ISR, `revalidate = 3600`, `generateStaticParams` over published products | `product:<slug>`, `category:<slug>` |
| `/collection/[category]` unfiltered | **Dynamic, `no-store` — deviation, see below** | `category:<slug>` |
| `/collection/[category]` filtered | Dynamic; the list is an `unstable_cache` read keyed by the filter tuple, TTL 300 s | `category:<slug>` |
| `/collection`, `/journal` (listings) | **Dynamic, `no-store` — deviation, see below** | Per-entity tags |
| `/collections/[slug]`, `/portfolio/**`, `/journal/[slug]` | ISR, `revalidate = 3600` | Per-entity tags |
| `/privacy`, `/terms` | ISR, `revalidate = 86400` | `page:<path>` |
| `/search` | Dynamic, `no-store` | — |
| `/api/search/suggest` | `public, s-maxage=60, stale-while-revalidate=300` | — |
| `/api/vitals`, `/api/inquiries/upload-sign`, `/api/media/sign`, `/api/revalidate`, `/api/preview`, `/api/studio/**`, every cron route | `no-store` | — |
| `/studio/**` | `private, no-store` | — |
| Cloudinary delivery | `public, max-age=31536000, immutable` | Never — public IDs are immutable; a replacement is a new public ID |
| `/_next/static` | Vercel default immutable | Build hash |

**There is no `/api/inquiries` route and this table must never grow one.** Inquiry submission is the
server action `app/(site)/_actions/submit-inquiry.ts` — the only public write path — so it has no cache
header of its own; a server action response is never cached. The public API surface that exists is
exactly the routes named above plus `app/api/search/suggest` and `app/api/auth/sign-out`
(`ARCHITECTURE.md` §3, `SECURITY.md` §3).

**Three listing routes are dynamic where this table asks for ISR, for one reason.** `/collection`,
`/collection/[category]` and `/journal` each read `searchParams` — a page number, a filter tuple, a
sort — and in Next 16 awaiting `searchParams` opts the whole route into dynamic rendering, including
the request that carries none of them. Serving the unfiltered case from ISR would need a second route
or a parallel route, which is an architecture change rather than tuning. Verified on 2026-09-11 with
`scripts/perf/check-cache-headers.mjs`, which encodes what the site actually does — with the `why` on
the row — so that a change to it is still caught rather than assumed.

**The invalidation rule:** a mutation invalidates the narrowest tags that describe it, plus `chrome`
only when chrome actually changed. Blanket `revalidatePath('/', 'layout')` is not used — it is how
cache strategies decay into "everything is dynamic".

**The designed failure mode:** if revalidation fails, publication has still happened and the page is
stale for at most its `revalidate` window. The failure is written to `system_logs` at `WARNING` on
channel `CONTENT` with the tags it could not clear, so a stuck cache is visible rather than
mysterious.

---

## 6. Server-side latency

| Control | Rule |
|---|---|
| Query budget | Public route ≤ 4 database round trips; Studio list page ≤ 6. Counted request-scoped in development; a `WARNING` system log in preview; a hard failure in the e2e suite for covered routes |
| Deduplication | `React.cache` on every shared loader (`getSiteChrome()`, `getStaffSession()`, per-request row lookups) |
| Concurrency | No sequential `await` where `Promise.all` is correct |
| Indexes | Every list query has a covering index named in `DATA_MODEL.md`; a new list surface without one is incomplete |
| Payload | A repository returns the columns the surface renders. `select *` on a wide table in a list path is a defect |

---

## 7. Measurement

### 7.1 Lab — Lighthouse CI

| Property | Value |
|---|---|
| Where | `.github/workflows/lighthouse.yml`, **manual dispatch only**, against a deployed URL |
| Matrix | One URL per run, given as an input. Phase 40 widens it to every route in §3 |
| Profile | The `desktop` preset in `lighthouserc.json` today; Phase 40 adds the Moto G4 / Slow 4G mobile pass |
| Runs | Three per URL, median taken |
| Assertions | `lighthouserc.json` — LCP ≤ 2.5 s, CLS ≤ 0.05, TBT ≤ 200 ms, script transfer ≤ 180 kB. Phase 40 moves them into `perf/budgets.json` so the guard scripts read the same numbers |
| Why manual | Actions minutes. The owner's standing instruction is to stay inside the free tier and be asked before anything spends beyond it, and three Chrome runs per route per push is the most expensive thing this repository could add. It runs when somebody asks for it. Locally it needs no CI at all: `npx lhci autorun --collect.url=…` reads the same config |
| Why a deployed URL and not a build in the runner | A Lighthouse number from a cold `next start` on a shared runner, against a database in another region, measures the runner |
| Why median-of-three | Lighthouse variance produces flaky reds. A genuine regression shows on all three runs **and** in the bundle diff, which is deterministic |

### 7.2 Field — first-party, identifier-free

`web-vitals` reports LCP, CLS, INP, TTFB and FCP through `navigator.sendBeacon` to
`app/api/vitals/route.ts`, **sampled at 10 %**.

| Carried | Never carried |
|---|---|
| Route **pattern** (`/product/[slug]`) | The resolved URL, slug or query string |
| Metric, value, rating | Any cookie, IP, user agent or session id |
| `connection.effectiveType` | Any identifier of any kind |
| `deviceMemory` bucket, coarse viewport bucket, nav type | Anything that could become a customer account by accident (D1) |

Retention 90 days, pruned by the Phase 38 cron at 04:15 UTC. Surfaced on the `/studio` Analytics tab
(`components/studio/analytics/VitalsCard.tsx`) as p75 per metric per route pattern over 28 days, with
n beside every figure, **always captioned with the sample rate and the window** so nobody reads it as
complete data (FEAT §28: do not manufacture unavailable analytics). A route with no samples is absent
rather than shown as zero.

**The reporter runs in production only.** `web_vitals_samples` has no environment column — one more
column is one more thing to segment by — so a preview deployment's numbers would mix silently into the
p75 the team reads as "the site". The gate is a build-time constant (`NEXT_PUBLIC_VERCEL_ENV`), which
makes the reporter dead code everywhere else.

`tests/unit/vitals-payload.test.ts` asserts the Zod schema rejects `ip`, `userAgent`, `sessionId`,
`userId` and `url`, and rejects any extra key.

### 7.5 Traffic analytics — not connected (owner decision)

No web-analytics provider is in the approved stack (D1), none is instrumented, and none may be
estimated. The Studio's `content_performance` metric (Phase 37, STUDIO_GUIDE §5.4) is therefore
**database-derived content health** — published versus draft pages, sections per page, days since
update, enquiries attributed by `source_path` — and the Analytics tab says in one sentence that
traffic analytics are not connected. Page views, sessions, bounce rate, funnels, referrers and
heatmaps do not exist anywhere in the repository. Connecting a provider has privacy consequences
(FEAT §46, §7.2 above) and is the owner's call: **OWNER_VERIFICATION_REQUIRED**, raised in
PHASE-31-38 §Phase 37's open questions and left open here.

### 7.3 Bundle

`perf/bundle-baseline.json` is committed. `scripts/perf/check-bundle.mjs --base <url>` measures each
budgeted route against a running production build and diffs it. Growth over 5 % on any route fails
until the baseline is regenerated in the same change with a stated reason a reviewer can see
(`npm run perf:baseline`). Without `--base` the same script runs its module-graph half only — the 3D
exclusion — which needs no build and so belongs in `npm run check`.

**`@next/bundle-analyzer` is deliberately NOT wired, and the phase document's deliverable is recorded
as a substitution rather than as done.** The analyzer is a webpack plugin; this project builds with
Turbopack, which has no webpack plugin pipeline, so installing it would add a dependency that cannot
run and a sentence here that is not true. What replaces it is
`node scripts/perf/check-bundle.mjs --base <url> --explain <route>`: every chunk the page asks for,
fetched, gzipped and labelled by marker heuristic, largest first. That is the command that produced
Finding 2 in §4.5, and it is reproducible by anybody with the site running.

### 7.4 Headers and third parties

`scripts/perf/check-cache-headers.mjs` and `scripts/perf/check-third-party.mjs` run against a running
production build (`npm start`), asserting §5 row by row and the zero-external-origin rule.

---

## 8. Measurement log

The record of what was actually measured, per route, with a date. **An empty cell is not a pass.**
This table is updated by the phase that ships or changes a route; a release that changes a route
without updating its row is incomplete.

### 8.1 Public routes

**First measured 2026-09-11, Phase 40**, against a local production build (`next start`, seeded
content, PostgREST shim) with `node scripts/perf/check-bundle.mjs --base http://127.0.0.1:3000`. The
figures are gzipped bytes of every script the served HTML asks the browser to fetch, which is the
definition in §3. `perf/bundle-baseline.json` holds the same numbers as data.

**LCP, CLS and INP are still NOT YET MEASURED, and that is a cost decision rather than an oversight.**
Lighthouse is `workflow_dispatch` only — three Chrome runs per route per push is the most expensive
thing this repository could add, and the owner's standing instruction is to stay inside the free
Actions tier. The run is one command against a deployed URL when somebody asks for it
(`.github/workflows/lighthouse.yml`), and the field data in §7.2 is the other half of the answer.

| Route | LCP (lab, p75) | CLS | INP | First-load JS | Islands | Date | Phase |
|---|---|---|---|---|---|---|---|
| `/` | NOT YET MEASURED | NOT YET MEASURED | NOT YET MEASURED | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/about` | NOT YET MEASURED | — | — | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/process` | NOT YET MEASURED | — | — | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/large-format` | NOT YET MEASURED | — | — | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/collection` | NOT YET MEASURED | — | — | 280.8 kB gz | 7 | 2026-09-11 | 40 |
| `/collection/[category]` | NOT YET MEASURED | — | — | 280.8 kB gz | 7 | 2026-09-11 | 40 |
| `/product/[slug]` | NOT YET MEASURED | — | — | 190.5 kB gz | 6 | 2026-09-11 | 40 |
| `/collections/[slug]` | NOT YET MEASURED | — | — | no published row to measure | 7 | 2026-09-11 | 40 |
| `/custom-commissions` | NOT YET MEASURED | — | — | 280.8 kB gz | 7 | 2026-09-11 | 40 |
| `/portfolio` | NOT YET MEASURED | — | — | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/portfolio/[slug]` | NOT YET MEASURED | — | — | no published row to measure | 7 | 2026-09-11 | 40 |
| `/journal` | NOT YET MEASURED | — | — | 280.8 kB gz | 7 | 2026-09-11 | 40 |
| `/journal/[slug]` | NOT YET MEASURED | — | — | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/journal/category/[slug]` | NOT YET MEASURED | — | — | 182.8 kB gz | 5 | 2026-09-11 | 40 |
| `/contact` | NOT YET MEASURED | — | — | 282.0 kB gz | 7 | 2026-09-11 | 40 |
| `/faq` | NOT YET MEASURED | — | — | no live section to render | 7 | 2026-09-11 | 40 |
| `/privacy` | NOT YET MEASURED | — | — | no live section to render | 7 | 2026-09-11 | 40 |
| `/terms` | NOT YET MEASURED | — | — | no live section to render | 7 | 2026-09-11 | 40 |
| `/search` | NOT YET MEASURED | — | — | 182.8 kB gz | 5 | 2026-09-11 | 40 |

The Phase 11 row for `/` recorded 171.7 kB against 5 islands on 2026-09-08. The difference is not a
regression in the same code: that figure was taken a different way (Next 15's build table) before
Phase 23 added the header search box, Phase 39 added structured data and Phase 40 added the vitals
reporter, and before this repository had a reproducible definition of the number. The 2026-09-11
figure is the first one produced by a method anybody can re-run.

### 8.2 Studio routes

| Route | INP | First-load JS | Query count | Date |
|---|---|---|---|---|
| `/studio` | NOT YET MEASURED | — | — | — |
| `/studio/catalog/products` | NOT YET MEASURED | — | — | — |
| `/studio/content/pages` | NOT YET MEASURED | — | — | — |
| `/studio/media/all` | NOT YET MEASURED | — | — | — |
| `/studio/inquiries/all` | NOT YET MEASURED | — | — | — |
| `/studio/research/explorer` | NOT YET MEASURED | — | — | — |

### 8.3 Special surfaces

| Surface | Measurement | Value | Date |
|---|---|---|---|
| 3D viewer chunk | Gzipped size including decoders | **303.6 kB gz** (brotli 252 kB) — `components/three/ModelViewer.tsx` bundled standalone with esbuild 0.24, minified, React external: `three` 855 kB raw, `@react-three/fiber` 153 kB, the bundled meshopt decoder 26 kB, the viewer's own files 19 kB. Under the 350 kB budget. A first measurement of 391 kB found `zod` in the graph through `lib/media/model.ts`; the viewer now reads the zod-free `lib/media/viewer-settings.ts` and a unit test keeps it so | 2026-09-10 |
| 3D viewer on a mid-range device | Time to first interactive frame, manual | NOT YET MEASURED — no model exists to load (the manifest holds none and none is generated); measure with the owner's first GLB | — |
| Homepage hero | CLS across the video mount | NOT YET MEASURED | — |
| Product gallery | CLS across three frame changes | NOT YET MEASURED | — |

---

## 9. Changing a budget

A budget is a decision, not a wish. To change one:

1. Edit `perf/budgets.json` (or `perf/bundle-baseline.json`) **in the same PR** as the change that
   needs it.
2. State the reason in the PR body: what capability was added, why it cannot fit, what was tried.
3. Update the affected row in §3 or §4 and the measured value in §8.
4. A reviewer approves the budget change explicitly, separately from the code.

**A budget miss is reported and triaged; it does not authorise deleting a scoped capability**, and it
does not authorise silently raising the number.

---

## 10. Out of scope

Third-party RUM, APM or error-tracking SaaS — errors go to `system_logs` · edge-runtime migration,
streaming-SSR redesign, partial pre-rendering and any Next.js experimental flag (architecture
changes, not tuning; they would need an amendment) · re-encoding of manifest assets — Cloudinary
derives and originals are untouched (D6) · research-subsystem database tuning (Phases 25–30 own their
own budgets) · load and stress testing (no traffic model exists) · removing a scoped feature to hit a
number.

---

## 11. Risks carried

| Risk | Mitigation |
|---|---|
| The budget becomes advisory | `perf/budgets.json` is the only source for both the assertions and the guards; raising it is a visible, reviewed file change |
| Field data drifts into visitor tracking | The payload schema has no field capable of identifying anyone, and a unit test asserts extra keys are rejected |
| One slow route drags a site-wide claim | Budgets and the log are per route; there is no single "site score" anywhere in this document |
| The 3D chunk leaks into a first load | Module-graph guard plus an e2e assertion with the flag off; both required in CI |
| Cloudinary derived-asset count multiplies | The preset list is closed at six; the width ladder is fixed; inline transformation strings are rejected |
| Someone adds a cookie-banner or analytics vendor to satisfy a review | Forbidden by `check-third-party.mjs`. If consent tooling is genuinely required, it is a first-party component **and** an amendment |
| Lighthouse variance produces flaky reds | Median of three, plus a deterministic bundle diff as the corroborating signal |
