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

Asserted by Lighthouse CI against a production build. "First-load JS" is gzipped and excludes any
dynamically imported chunk that is not requested on load. "Islands" counts distinct client-component
roots.

| Route | LCP | First-load JS | Islands | Notes |
|---|---|---|---|---|
| `/` | 2.5 s | 180 kB | 3 | Video hero, merchandised selections |
| `/about`, `/process`, `/large-format` | 2.5 s | 150 kB | 2 | Media-heavy, low interactivity |
| `/collection`, `/collection/[category]` | 2.5 s | 175 kB | 3 | Filters, sort, mobile filter drawer |
| `/product/[slug]` | 2.5 s | 190 kB | 4 | Gallery, lightbox, inquiry launcher, viewer mount |
| `/collections/[slug]` | 2.5 s | 165 kB | 3 | Exhibition composition |
| `/portfolio`, `/portfolio/[slug]` | 2.5 s | 150 kB | 2 | |
| `/journal`, `/journal/[slug]`, `/journal/category/[slug]` | 2.0 s | 140 kB | 2 | Text-led |
| `/custom-commissions` | 2.5 s | 200 kB | 4 | The configurator is the heaviest public client code |
| `/contact` | 2.0 s | 160 kB | 2 | |
| `/faq`, `/privacy`, `/terms` | 2.0 s | 120 kB | 1 | |
| `/search` | 2.0 s | 170 kB | 3 | |
| 3D viewer chunk | — | 350 kB | — | Measured separately; **never** in a first load |
| `/studio/**` | — | 320 kB | — | Authenticated, not indexed; INP ≤ 300 ms, CLS ≤ 0.1 |

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
| Measured by | `check-bundle.mjs`, `tests/e2e/model-viewer.spec.ts` with the flag **on and off**, and a manual mid-range-device check recorded in §8.3 |

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

## 5. The caching contract

Written down once so it is not re-decided per route. `ARCHITECTURE.md` §6 owns the tag taxonomy.

| Surface | Strategy | Invalidation |
|---|---|---|
| CMS pages (13 static paths) | ISR, `revalidate = 3600` | `revalidateTag('page:<path>')` from the publish service |
| `/product/[slug]` | ISR, `revalidate = 3600`, `generateStaticParams` over published products | `product:<slug>`, `category:<slug>` |
| `/collection/[category]` unfiltered | ISR, `revalidate = 3600` | `category:<slug>` |
| `/collection/[category]` filtered | Dynamic; the list is an `unstable_cache` read keyed by the filter tuple, TTL 300 s | `category:<slug>` |
| `/collections/[slug]`, `/portfolio/**`, `/journal/**` | ISR, `revalidate = 3600` | Per-entity tags |
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

Retention 90 days. Surfaced in `/studio` and the analytics panel as p75 per metric per route pattern
over 28 days, **always captioned "sampled at 10 %; lab targets are measured separately"** so nobody
reads it as complete data (FEAT §28: do not manufacture unavailable analytics).

`tests/unit/vitals-payload.test.ts` asserts the Zod schema rejects `ip`, `userAgent`, `sessionId`,
`userId` and `url`, and rejects any extra key.

### 7.3 Bundle

`perf/bundle-baseline.json` is committed. `scripts/perf/check-bundle.mjs` diffs the production build
against it. Growth over 5 % on any route, or any new dependency entering a first-load graph, fails
until the baseline is regenerated in the same PR with a stated reason a reviewer can see.
`@next/bundle-analyzer` is wired behind `ANALYZE=1` for investigation.

### 7.4 Headers and third parties

`scripts/perf/check-cache-headers.mjs` and `scripts/perf/check-third-party.mjs` run against a running
production build (`npm start`), asserting §5 row by row and the zero-external-origin rule.

---

## 8. Measurement log

The record of what was actually measured, per route, with a date. **An empty cell is not a pass.**
This table is updated by the phase that ships or changes a route; a release that changes a route
without updating its row is incomplete.

### 8.1 Public routes

| Route | LCP (lab, p75) | CLS | INP | First-load JS | Islands | Date | Commit |
|---|---|---|---|---|---|---|---|
| `/` | NOT YET MEASURED | NOT YET MEASURED | NOT YET MEASURED | 171.7 kB gz | 5 | 2026-09-08 | Phase 11 |
| `/about` | NOT YET MEASURED | — | — | — | — | — | — |
| `/process` | NOT YET MEASURED | — | — | — | — | — | — |
| `/large-format` | NOT YET MEASURED | — | — | — | — | — | — |
| `/collection` | NOT YET MEASURED | — | — | — | — | — | — |
| `/collection/[category]` | NOT YET MEASURED | — | — | — | — | — | — |
| `/product/[slug]` | NOT YET MEASURED | — | — | — | — | — | — |
| `/collections/[slug]` | NOT YET MEASURED | — | — | — | — | — | — |
| `/custom-commissions` | NOT YET MEASURED | — | — | — | — | — | — |
| `/portfolio` | NOT YET MEASURED | — | — | — | — | — | — |
| `/portfolio/[slug]` | NOT YET MEASURED | — | — | — | — | — | — |
| `/journal` | NOT YET MEASURED | — | — | — | — | — | — |
| `/journal/[slug]` | NOT YET MEASURED | — | — | — | — | — | — |
| `/journal/category/[slug]` | NOT YET MEASURED | — | — | — | — | — | — |
| `/contact` | NOT YET MEASURED | — | — | — | — | — | — |
| `/faq` | NOT YET MEASURED | — | — | — | — | — | — |
| `/search` | NOT YET MEASURED | — | — | — | — | — | — |
| `/privacy` | NOT YET MEASURED | — | — | — | — | — | — |
| `/terms` | NOT YET MEASURED | — | — | — | — | — | — |

**What the `/` row is and is not.** The two filled cells were measured, not estimated. **First-load
JS** is the sum of every `/_next/static/**/*.js` the served HTML references, fetched with gzip from
a production `next start`: 171.7 kB compressed, 556.6 kB raw — inside Phase 11's 180 kB budget with
8 kB to spare. **Islands** is `scripts/site/check-island-budget.mjs`'s own count, which is the
number the gate enforces rather than a reading of a bundle report.

LCP, CLS and INP still read NOT YET MEASURED, and saying so is the point of an empty cell. Running
Lighthouse against this build would measure a page whose every image is the SEED §47 "media
unavailable" well — `media_assets` is empty until `npm run media:migrate:higgsfield` runs — so its
LCP would be a text node and its CLS would be whatever a page with no images does. That number
would be wrong in the flattering direction, which is worse than no number. The measurement belongs
to the first deployment with media bound, and the workflow is there for it.

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
| 3D viewer chunk | Gzipped size including decoders | NOT YET MEASURED | — |
| 3D viewer on a mid-range device | Time to first interactive frame, manual | NOT YET MEASURED | — |
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
