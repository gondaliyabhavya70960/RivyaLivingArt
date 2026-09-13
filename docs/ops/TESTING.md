---
doc: TESTING
status: CURRENT
owning_phase: 42
last_reviewed: 2026-09-12
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# TESTING — the QA system

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/ops/PERFORMANCE.md` (budgets this suite asserts),
> `docs/ops/ACCESSIBILITY.md` (the a11y standard this suite asserts),
> `docs/ops/SECURITY.md` (the security invariants this suite asserts),
> `docs/project/BUSINESS_RULES.md` (every rule here traces to one).
> Source specifications: FEAT §42 (phase completion), §45 (visual QA matrix). Owned by Phase 42;
> every phase contributes specs.

**The goal of this document is that "the tests pass" becomes a meaningful sentence.** Read it before
writing your first test.

**Implementation status (end of Phase 42, 2026-09-11).** The system is complete and every figure
below is from a run on this date rather than a projection.

| Layer | Where | Count | Runs in |
|---|---|---|---|
| Unit (offline) | `tests/unit/**`, `lib/**`, `components/**` | 193 files · 2,907 tests | `ci.yml`, every push |
| RLS (a real PostgreSQL) | `tests/unit/rls/**` | 33 files · 632 tests | `ci.yml`, every push |
| Integration (schema-wide) | `tests/integration/**` | 4 files · 29 tests | `ci.yml`, every push |
| Browser | `tests/e2e/**` | 57 spec files | `e2e.yml`, sharded four ways |
| Visual | `tests/visual/**` | 4 spec files · 33 baselines | `e2e.yml`, three widths |

**What Phase 42 found.** Running these suites for the first time produced four defects that every
existing check had passed over, and they are listed here rather than buried in a commit message
because they are the argument for the whole layer:

1. **No enquiry could be saved. At all, in any environment.** `submit-inquiry.ts` wrote `ip_hash`
   from a 32-character rate-limiter digest into a column whose CHECK demands 64. The database
   refused every insert, the action correctly declined to redirect, and the site's one
   non-negotiable rule — persist before the WhatsApp handoff — was therefore never exercised
   successfully by anybody. Found by `tests/e2e/inquiry-conversion.spec.ts`, which is the first test
   that ever looked in the table.
2. **Nothing had ever been written to `system_logs`.** `writeSystemLog` sent seven of thirteen RPC
   parameters as `undefined`; `supabase-js` drops those keys, and PostgREST could not resolve the
   function. `logSystem` caught the error and printed the error's NAME only, so the symptom was one
   word in a dev server's output and an empty log table that reads exactly like "nothing has gone
   wrong".
3. **The catalogue's product cards were not links.** `ProductCard`'s own comment said Phase 15 would
   add "the heading anchor and the `::after` overlay"; Phase 15 shipped the route and not the
   anchor, and for twenty-seven phases no test asked the only question a visitor asks — can I open
   this.
4. **Two listing pages skipped a heading level**, putting card titles at `h3` directly under the
   `h1`. `cardHeadingLevel` in `SectionCopy.tsx` now derives the level from whether the section
   rendered a heading of its own.

Two further findings were about the TESTS rather than the code, and both are worth knowing. The
first version of the touch-target check measured the painted box and reported every small button on
the site — the design system already answers that rule with the `rv-hit-44` overlay, and a naive
measurement would have led somebody to inflate controls that were correct. And `/large-format` at
390px photographed differently on consecutive runs until `settle()` forced every lazy image to
decode before the shutter opened; that was fixed at its cause rather than added to
`tests/flaky.json`.

## 1. Four layers, and what belongs in each

| Layer | Runner | Environment | Owns | Never |
|---|---|---|---|---|
| **Unit** | Vitest | `node`, no network, no database | Pure functions: validation, transforms, WhatsApp rendering, price-state logic, SEO builders, relation rules, scraper normalisation, redaction, rate-limit windows, upload validation | Rendering a page; touching Supabase |
| **Integration** | Vitest | Local Supabase via `supabase start` | Repositories, RLS policies, triggers, constraints, migration replay, seed idempotency, publish gates | Browser behaviour |
| **E2E** | Playwright | Production build + fixture database | User journeys, permissions in the real request path, keyboard models, forms, the conversion path, headers | Asserting a pixel colour |
| **Visual** | Playwright snapshots | Same, animations frozen | Layout and composition at the eight QA widths | Asserting text content |

**Placement rule.** If it can be a unit test, it is a unit test. Push a test down a layer whenever
the assertion survives the move: layers below are faster, more deterministic and cheaper to debug.
Push it **up** only when the thing under test is the integration itself.

---

## 2. The fixture

`scripts/test/seed-fixture.ts` writes the one database state every browser test runs against.
`npm run test:seed-fixture`.

| What | Count | Why that count |
|---|---|---|
| Staff users | 6 | One per role, so an authorisation test names a role rather than a person |
| Products | 4 | **One per `price_state`.** Every price branch in the product has a row |
| Collection | 1 | `OWNER_CONFIRMED`, the only state a published collection may be in |
| Portfolio project | 1 | **DRAFT, deliberately** — see below |
| Journal articles | 2 | One published with a real body page, one draft |
| FAQs | 10 | Enough that the accordion's keyboard behaviour goes past the first item |
| Inquiries | 5 | One per pipeline column the Studio list shows |
| Research source · run · products | 1 · 1 · 20 | Twenty because the analytics floor is twelve |
| Media assets | 12 | Mirroring real manifest assets, public ids and all |

**The frozen clock is `2026-01-15T12:00:00Z`.** A page showing "3 days ago" fails on the fourth day;
a coverage figure over "the last 30 days" moves every night. Four columns are excluded from the
idempotency digest because the DATABASE owns them, not the seeder — `updated_at` everywhere,
`staff_profiles.created_at` and `collections.owner_confirmed_at` — and each exclusion is argued in
`tests/integration/seed-idempotency.test.ts`.

**Every id begins `f0000000-0000-4000-8000-`,** declared once in `tests/fixtures/ids.ts`. Not one
statement in the seeder deletes by slug, by date, or by "everything in this table", so a developer
running it against a database holding a day of their own work gets the fixture written and their
work untouched. `scripts/test/check-fixture-isolation.mjs` (preflight gate 9, and part of
`npm run check`) enforces the other direction: no fixture id and no `tests/` import may appear under
`app/`, `lib/`, `components/`, `content/`, `scripts/` or `supabase/`.

**It refuses a database that is not on this machine** unless `--allow-remote` is passed, and that is
the most important line in the file. It writes invented prices, invented enquirer names and phone
numbers, and `owner_verification = 'VERIFIED'` on four products no owner has looked at. Correct for
a throwaway database; a plain breach of the house rules anywhere else.

**The portfolio project stays DRAFT and will not be published by this fixture.**
`enforce_project_evidence_gate` refuses a published project the owner has not verified, and a
portfolio project asserts that Rivya DELIVERED a piece of work for somebody. Marking a fabricated
one verified would put the shape of a false claim into the one table whose purpose is to hold true
ones — and a fixture is copied far more often than it is read. It is also the truer test: the live
site has no published projects, so `/portfolio` renders its empty state, which is what a snapshot
should capture.

### 2.1 `--publish-seeded`, and why the flag exists

`npm run seed:content` writes every section as DRAFT and never publishes one. That is its central
rule and it is right: publishing is an editor's act, and a runner that published would overwrite the
judgement it exists to protect. It also leaves a freshly seeded database where **every public route
404s**, so a browser suite against it skips every test and reports green.

`--publish-seeded` walks the seeded sections up the real ladder — DRAFT → REVIEW → APPROVED →
PUBLISHED, one step at a time, because `enforce_status_transition` refuses the jump and is right to.
It is off by default, it refuses to publish anything marked `OWNER_VERIFICATION_REQUIRED`, and
`--reset` does not unpublish, because there is no record of what was published before.

### 2.2 Order matters, and it is not obvious

The RLS suite owns the database while it runs: `tests/unit/rls/phase08.test.ts` deletes every
`page_sections` row. So a browser run after a full `vitest run` finds an unpublished site and skips
everything. The order in `.github/workflows/e2e.yml` is the correct one:

```
npm run db:reset          # migrations
npm run seed:content      # the site's copy, as DRAFT
npx tsx scripts/test/seed-fixture.ts --publish-seeded
npx playwright test
```

### 2.3 The twelve committed images

`tests/fixtures/media/` holds twelve small PNGs, generated by
`npm run test:build-fixture-media` and verified byte-for-byte by `npm run test:check-fixture-media`
(part of `npm run check`). `tests/support/media-route.ts` answers every `res.cloudinary.com`
request with one, so **no test run touches the network** and no snapshot is a promise about
somebody else's server.

They are **stand-ins, not the photographs**, and that is the design. What these snapshots are for is
layout — does the hero still fill the viewport, does the grid still reflow at 390px — and a flat
rectangle at the correct aspect ratio answers that, while a photograph answers it no better and
breaks whenever an asset is re-encoded. What is real about them is the aspect ratio, taken from the
manifest, and the public id they answer to.

The PNG encoder is hand-written rather than `sharp`, because the files are COMMITTED: libvips output
moves between versions, so regenerating them elsewhere would produce a diff of twelve binary files
and no way to tell whether anything meaningful changed. Written as indexed-colour PNGs with STORED
deflate blocks, the bytes are a pure function of the pixels.

## 3. The visual QA matrix

`tests/visual/tiers.ts` sorts the routes by what a regression on them COSTS, and the tier decides
the tolerance. A suite that covers everything equally is one whose failures nobody triages.

| Tier | Routes | Tolerance | What a difference means |
|---|---|---|---|
| A | home · catalogue · product detail · contact · large format | 0.002 | Blocks a release. A visitor who cannot read these cannot reach the studio |
| B | commissions · portfolio · process · about · journal · faq | 0.005 | Worth a look, rarely urgent |
| C | privacy · terms · search | 0.01 | Changes when the text changes and almost never otherwise |
| Studio | login | 0.002 | The only Studio surface a stranger can reach |

**33 baselines, at three widths (1440, 768, 390) — not 127 at eight.** The phase document projected
127 before these routes existed. One width per breakpoint band is what earns its keep: 1280
photographs the same layout as 1440, and each extra baseline costs a committed PNG and a reviewer's
attention on every diff. Three routes (`/faq`, `/privacy`, `/terms`) skip with a stated reason —
the seed writes no sections for them, which is a content gap and not a test failure.

**`tests/visual/stability.ts` removes the four things that make the same page photograph
differently**: motion (animations disabled rather than waited out), images (answered locally, and
every lazy image forced to decode before the shutter), time (the clock frozen by an init script, so
a component that reads it during its first render sees the frozen value) and carets.

**And a fifth, which is not on the page at all: the development server's own dev-tools indicator.**
It floats over a corner, renders collapsed or expanded depending on what it has to say and when it
is asked, and photographed both ways — which is what made `/large-format` at 390px differ from a
baseline generated one run earlier with no code in between. There was already a rule hiding it, and
the rule was doing nothing: `addStyleTag` injects into the document that is open when it runs, and
it ran before `page.goto`, so the whole stylesheet landed in `about:blank` and was discarded by the
navigation it was meant to stabilise. It is injected in `settle()` now, after the navigation and
before the shutter.

**The visual suite runs against a production build** (`npm run test:visual` builds first and sets
`E2E_PRODUCTION=1`), which is the real answer to that class of difference: no dev overlay exists
there, and a baseline of a development server is a baseline of a page no visitor is ever served.
None of the tiered routes is dev-only, so nothing is lost by it.

**A baseline is reproducible from the documented database state and no other**: `npm run db:reset`,
`npm run seed:content`, then `npx tsx scripts/test/seed-fixture.ts --publish-seeded` — the same three
steps `e2e.yml` runs. Regenerating against a database that has accumulated rows from other suites
produces baselines nobody else can reproduce, and it did: the catalogue was 673px taller in the
committed baseline than the fixture's four products can make it.

**A baseline belongs to the container that made it.** Font rasterisation differs between machines by
a pixel here and there — under the tolerance for a paragraph, over it for a page of them. The
committed baselines were produced in this repository's pinned image. To rewrite them in CI, dispatch
`e2e.yml` with `update_snapshots` and download the artefact; an ordinary run never rewrites one,
because a baseline that changed on a push would be a visual regression committing itself.

**So CI does not compare baselines — `npm run test:visual` is a local check.** An ordinary `e2e.yml`
run executes the eight behavioural width projects and skips the three visual ones, because a GitHub
runner rasterises text differently from this container by more than a page of it can absorb: every
tier-A page would fail on every push, and a gate that is always red is a gate nobody reads. What
would change that is a baseline set produced on the runner image itself — dispatch with
`update_snapshots`, commit the artefact, and the visual projects can join the ordinary run.

## 4. The tests that exist because a business rule exists

Every rule in `BUSINESS_RULES.md` that can be tested, is. These are not optional coverage; they are
the rules in executable form.

| Rule | Spec | Asserts |
|---|---|---|
| BR-A1/A2/A3 | `tests/integration/forbidden-tables.test.ts` | No cart, order, payment, customer, review, shipment or quote relation exists |
| **BR-B1** | `tests/e2e/inquiry-conversion.spec.ts` | Success: row persisted, then a WhatsApp URL carrying the persisted reference — reached **only** by activating `Continue to WhatsApp` (by click and by `Enter`), with focus on the success heading, the reference code inside the live region, and **no navigation within 10 seconds of idle** (WCAG 2.2.1 — `ACCESSIBILITY.md` §1.2). **Failure: the SEED §49 copy and no navigation to `wa.me` at all.** Run in both directions on **every** PR |
| BR-B2 | `tests/unit/whatsapp-render.test.ts` | Unknown token throws; internal fields cannot enter the message; the five-rung shorten ladder stays under 1800 decoded characters |
| BR-B3 | `tests/unit/rls/inquiries.test.ts` | `anon` inserts; `anon` cannot select; a crafted `pipeline_status`/`assigned_to` is refused |
| BR-B5 | `tests/unit/rate-limit-window.test.ts` + an e2e | Five persist, the sixth is 429 with `Retry-After`; the fixed window resets correctly at the boundary |
| BR-C1/C2/C4 | `tests/integration/publish-gates.test.ts`, `tests/unit/price-state.test.ts` | All eight invalid price combinations are refused by the constraint; every state renders its correct label |
| BR-C3 | `tests/unit/no-pricing.test.ts` | No price-shaped identifier exists in the customization-form schema |
| BR-D1 | `tests/integration/seed-idempotency.test.ts` | The seed creates zero products, specs, projects and testimonials |
| BR-D2/D5 | `tests/integration/publish-gates.test.ts` | Publishing an `OWNER_VERIFICATION_REQUIRED` row is refused by the database; consent gates hold |
| BR-D3/D4 | `tests/e2e/cms-workflow.spec.ts` | Empty states render instead of fabricated cards; a Studio heading edit reaches the public route with no deploy |
| **BR-D6** | `tests/integration/seed-idempotency.test.ts` | Run → run again → zero changed rows; a human-edited row is reported `skipped_owner_edited` and is byte-identical afterwards; `status` and `owner_verification` are never touched |
| BR-D7 | `tests/unit/alt-text-coverage.test.ts` | Every bound asset has non-empty alt text or `is_decorative = true`; the constraint refuses an empty string |
| BR-E2/E3/E6 | `manifest:verify`, `tests/integration/publish-gates.test.ts` | Manifest byte-identical; a concept asset cannot be attached to a product; a used asset cannot be deleted |
| BR-E4 | `scripts/media/check-asset-ids.py` | No gap ID reuses a manifest family prefix |
| **BR-E7** | `tests/unit/model-policy.test.ts`, `tests/unit/model-inspect.test.ts`, `tests/unit/model-mount.test.tsx`, `tests/unit/rls/phase21.test.ts` | The FEAT §14 ceilings as numbers and against the 0194 CHECKs; the Zod settings shape names exactly the keys and presets `is_valid_viewer_settings()` names; the inspector builds its own GLBs (a Draco-compressed one encoded and decoded end to end) and refuses the 20 MB uncompressed case with both reasons; `DimensionOverlay`, `PosterFallback`, `types.ts` and the mount import no engine, and the viewer and its island import no `zod`; a label is public exactly when its model is, a merchandiser cannot mark one VERIFIED, and `set_model_association()` fails as a whole for an editor |
| **BR-D10** | `tests/unit/merchandising-resolve.test.ts`, `tests/unit/merchandising-register.test.ts`, `tests/unit/rls/phase22.test.ts`, `tests/e2e/merchandising.spec.ts` | The five-step ladder against a client that answers from memory — an out-of-window entry dropped, an unpublished target dropped, the curated list in position order, a recency top-up with its rule named and a draft never counted, the caps, a DRAFT slot falling through; `HIDE_SECTION` renders nothing, `SHOW_EMPTY_STATE` the sentence, `EDITORIAL_BLOCK` tiles with no product route, no price label and a CTA only to the three allowed paths; the register level with migration `0200`, no behavioural word in the resolver or repository, no `/product/<slug>` literal in any renderer; at the table, anon reads an entry only while live in a PUBLISHED slot, the editor cannot curate and the merchandiser can, a concept collection and a wrong type are refused for the owner, and the sweep is the service role's; end to end, the fallback carries no product link and the store order warns on a SEED §56 inversion |
| **BR-F1/F2/F3/F4** | `tests/unit/rls/research.test.ts`, `check-research-isolation.mjs`, `check-data-layer.mjs`, `tests/integration/rls-policies.test.ts` | No `anon` policy on any `research_*` table; no FK to `products`; the research→public FK inventory **equals** the guard's constraint-name allowlist, so a missing entry fails as loudly as an extra one (`BUSINESS_RULES.md` BR-F2 names the entries; §M open question 7 records that `DATA_MODEL.md` disagrees on how many there are, which this assertion will surface as a red test rather than a review comment); no research term in a public search result; no image is downloaded |
| BR-G1/G2 | `tests/unit/rls/*.test.ts`, `tests/e2e/studio-authz.spec.ts` | One client per role, allow/deny per table; forbidden POSTs return 403 **and** write `DENIED` audit rows |
| BR-G4 | `tests/e2e/bulk.spec.ts` | Typed confirmation, exact preview count, undo within 24 h restores byte-identically |
| BR-I1 | `tests/unit/pii-scope.test.ts` | No inquiry personal field reaches `search_documents`, `web_vitals_samples` or an `audit_logs` blob |
| BR-J1/J2 | `tests/unit/redact.test.ts`, `env-checks-no-secrets.test.ts`, `tests/e2e/deploy-smoke.spec.ts` | The never-expose list cannot reach a bundle, a log or a rendered page |
| BR-J3 | `tests/unit/docs-allowlist.test.ts` | An unknown doc key 404s; nothing outside the ten-path allowlist is reachable |

---

## 5. Accessibility tests

Run as a separate required CI job. Standard and per-component detail: `docs/ops/ACCESSIBILITY.md`.

| Spec | Asserts |
|---|---|
| `a11y/axe-sweep.spec.ts` | Zero **critical** and zero **serious** violations on every public route and seven Studio routes, at 1440 px and 390 px |
| `a11y/landmarks.spec.ts` | One `<header>`, `<nav>`, `<main>`, `<footer>`; unique accessible names |
| `a11y/headings.spec.ts` | Exactly one `<h1>`; no skipped levels; per route |
| `a11y/forms.spec.ts` | Programmatic labels, `aria-describedby`, `aria-invalid`, `autocomplete` tokens |
| `a11y/touch-targets.spec.ts` | Every interactive hit box ≥ 44 × 44 at 390 px |
| `a11y/reduced-motion.spec.ts` | No transform/opacity transition applies; **no `<video>` element exists in the document** |
| `a11y/zoom-reflow.spec.ts` | 200 % zoom and 320 px reflow: no horizontal scroll, no lost content |
| `navigation-a11y.spec.ts` | Skip links, mega-menu keyboard model, mobile drawer focus trap, `aria-current` |
| `section-rail.spec.ts` | The page-section index (RC-245): drawn at `xl` and hidden below it, never overlapping the first heading in `<main>`, adding no horizontal scroll, every entry named beyond its digits, every `href` resolving to a band on the page |

### 5.1 The contrast failure a token matrix could not have found (amendment A48)

`check-contrast.mjs` proves every semantic PAIR in every scheme, and it proved them all the day
`/large-format` started failing axe at SERIOUS. Both were right. The band it failed on —
`category-intro`, ink on MINERAL, **17.55:1 when opaque** — was being composited at
`opacity: 0.184`, because the entrance animation faded `opacity` on a `view()` timeline and
`animation-fill-mode: both` holds a band at its `from` keyframe until it enters. **Contrast was a
function of scroll position.** On a long page exactly one band is mid-range at any moment, so
whichever one landed there failed; A47's taller hero simply changed which one. No colour choice
could have fixed it and no static check could have seen it.

Two things follow, and both are now enforced:

- The entrance is **transform-only**, and `tests/unit/motion-layer.test.ts` fails if any keyframe in
  `app/styles/motion.css` animates `opacity` again — asserted over every keyframe, because the
  hazard is the property rather than any one animation.
- **A serious axe violation that moves when the page gets taller is a composition bug, not a flaky
  test.** It reproduces only at the width and scroll offset where a band straddles the range, so it
  will look intermittent. Probe the computed `opacity` of the reported element's section before
  reaching for a re-run.

Plus **two** pre-browser guards in `npm run check`: `scripts/a11y/check-contrast.mjs` (token matrix)
and `scripts/a11y/check-focus-styles.mjs` (no unreplaced `outline: none`).

**This section claimed a third, and it does not exist.** `scripts/a11y/check-no-timed-navigation.mjs`
was described here as guarding WCAG 2.2.1 — no `router.push`/`replace`, `location.assign` or
`window.open` inside a `setTimeout`/`setInterval` under `app/(site)/**` or `components/patterns/**`.
There is no such file and no such entry in `check`; `scripts/a11y/` holds exactly two scripts. The
**rule** stands and `ACCESSIBILITY.md` §1.2 states it, but it is enforced by review rather than by a
gate, and a reader who trusted this line would have believed otherwise. Corrected 2026-09-13.

`tests/e2e/a11y/exceptions.json` ships with **zero rows**, prints in full on every run, and requires
a reason, an owner and a dated review per row. Its row count is an exit criterion.

---

## 6. Performance tests

Run as a separate required CI job. Budgets: `docs/ops/PERFORMANCE.md` — Phase 42 **executes** them,
it does not redefine them.

| Check | Asserts |
|---|---|
| `tests/e2e/model-performance.spec.ts` | No script, module or WebAssembly request in the product page's first load names the engine, the viewer or a decoder; the LCP element is never a canvas, at every QA width |
| Lighthouse CI matrix | Every route within its `perf/budgets.json` LCP, CLS, INP and JS budget; the reported LCP element is an `<img>` |
| `scripts/perf/check-bundle.mjs` | **Built in Phase 21**: a static walk of every route's CLIENT import graph — through `'use client'` files, stopping at `'use server'` and `server-only` — that fails on any `three`, `@react-three/*` or `meshoptimizer` specifier, on a missing vendored decoder, and on the viewer reached other than through the island's `import()` with `ssr: false`. Proved to fail on a planted static import. In `npm run check` and CI. The baseline + 5 % comparison is Phase 42's |
| `scripts/cms/check-section-copy.ts` (product-slug rule) | **Extended in Phase 22**: any string literal of the shape `/product/<slug>` in `components/sections/**` or `components/patterns/**` is reported — an href built from a row passes; a slug typed to make the design look full does not. In `npm run check` as `cms:check-copy` |
| `scripts/perf/count-islands.mjs` | Every route at or under its island budget |
| `scripts/perf/check-image-props.mjs` / `check-video-props.mjs` | `sizes` everywhere; one `priority` per route; posters and gates on every video |
| `scripts/perf/check-cache-headers.mjs` | Every row of the caching contract, against a running production build |
| `scripts/perf/check-third-party.mjs` | Zero external origins |
| `tests/unit/vitals-payload.test.ts` | The vitals schema rejects `ip`, `userAgent`, `sessionId`, `userId`, `url` and any extra key |

---

## 7. Coverage, and the number that is actually true

`npm run test:coverage`. The thresholds live in `vitest.config.ts` and each carries its reasoning.

| Measure | Threshold | Measured 2026-09-11 |
|---|---|---|
| `lib/**` statements | 45 | **47.9%** (5,848 / 12,201) |
| `lib/auth/permissions.ts` | 100 branches | 100% |
| `lib/media/alt-text-quality.ts` | 100 branches | 100% |
| `lib/media/crop.ts` | 100 branches | 100% |
| `lib/logging/redact.ts` | 100 branches | 100% |
| `lib/security/rate-limit.ts` | 82 branches · 74 statements | 82.4% · 74.2% |

**The phase document asked for 80% and the measurement is 47.9%.** Declaring 80 anyway would make
this gate fail on every run from the day it was written, which is how a gate stops being run at all
— the same argument `scripts/ops/check-env.ts` makes about the single-project posture. So 45 is set
as a **ratchet**: below today's figure by a small margin, so the gate fails when coverage DROPS,
which is the property that protects the code. The number is raised as it rises.

**Why the real figure is low, and why it is not 47.9% of the product being untested.** Most of
`lib/**` is repositories, Server-Component helpers and page loaders, covered by the suites that can
actually reach them — 632 RLS tests against a real database and a Playwright suite against a real
browser. Neither is visible to a `--project unit` measurement. **What it would take to reach 80**:
a database in the coverage run and a merge across three runners. Worth doing, and it is not this
phase.

**The per-file 100% is the rule that matters.** Each of those four is a pure function that decides
something irreversible: what a role may do, what a text alternative says, where a crop lands, what
is redacted from a log. `lib/security/rate-limit.ts` is held to its measured figure rather than 100
because `consume()` builds its own admin client and talks to PostgREST — the unit project cannot
enter it, and the database half is covered by `tests/unit/rls/**`, which this run does not see.

### 7.1 Flakes

`tests/flaky.json` is the only place a flaky test may be recorded, and
`npm run test:check-flaky` (part of `npm run check`) holds the register honest: at most three
entries, each naming a test that exists, each carrying a date, an observation and a reason that is
not the word "flaky", and none older than ninety days.

**It is empty, and that is a claim rather than an omission.** Nothing in this repository has been
observed to flake. The one instability found in this phase — `/large-format` at 390px — was fixed at
its cause. A retry count in `playwright.config.ts` is not an alternative to this file: it hides
every flake including the ones nobody has noticed.

## 8. CI shape

Three workflows, and they fail for different reasons.

| Workflow | Trigger | What it answers | Roughly |
|---|---|---|---|
| `ci.yml` | every push, every PR | Is the code correct? Types, lint, format, 24 gates, 2,907 unit tests, 632 RLS tests, 29 integration tests, migrations replayed from empty, a production build through the local PostgREST shim | 6 min |
| `e2e.yml` | push to `main`, PR to `main`, dispatch | Is the page correct? The browser suite against a production build, sharded four ways | 4 shards × ~8 min |
| `security.yml` | push, PR, Mondays 04:00 UTC, dispatch | Has a secret reached the history? Does a shipped dependency carry a high-severity advisory? | 2 min |

**A red `ci` means the code is wrong; a red `e2e` means the page is wrong.** They are separate
because adding a browser suite to `ci.yml` would triple a six-minute gate and make every typo fix
wait for Chromium.

**`e2e.yml` shards four ways and each shard builds its own database**, because a service container
belongs to a job rather than to a workflow. That costs a minute per shard and buys complete
isolation. Failures upload the report and traces for 14 days — after a fortnight nobody opens a
trace, and the storage is not free.

**The browser suite runs against `next start`, not `next dev` (`E2E_PRODUCTION=1`).** A development
server answers `no-cache, must-revalidate` to everything it serves and rebuilds modules as they are
requested, so four specs asserting the caching contract — `immutable` on a hashed asset, ISR on a
CMS page — could not pass in it however correct the code, and two more counted module-graph requests
the production bundle never makes. The flag switches `playwright.config.ts`'s web server and
`e2e.yml` builds before it runs. Two consequences worth knowing: `/design-system` calls `notFound()`
in a production build by design, so its spec skips under the flag with that reason stated; and a
local re-run needs `rm -rf .next` first, because `next start` will otherwise serve ISR output
generated against an earlier state of the fixture.

**A local run needs two variables in PLAYWRIGHT's environment, not just the server's**, and neither
failure reads as what it is. `DATABASE_URL` is used by the specs themselves:
`tests/support/inquiry-limiter.ts` runs in the `beforeEach` of `inquiry-flow.spec.ts` and connects
with `pg`, so without it
every test in that file — seven on `/contact` and three on the enquiry inbox — fails in about twenty
milliseconds, before a page is ever requested, and the report reads as a broken conversion path on a
site that is serving `/contact` at 200. `NEXT_PUBLIC_SITE_URL` is used by the app: `siteOrigin()`
returns null without it, by design (§Phase 39: a malformed value is null, never a guess), so the page
renders with no `<link rel="canonical">` and no publisher URL in its structured data, and three SEO
specs fail on absences that are correct for the environment they were run in.

Together with the paragraph above that is the whole of the local-versus-CI difference, measured on
2026-09-12: **eighteen failures per width project, four causes, none of them the site.** Ten are
`DATABASE_URL`, three are `NEXT_PUBLIC_SITE_URL`, three are the dev server's cache headers and two
are its module graph. `e2e.yml` sets all of it, which is why this has never been red in CI and why it
is written down here instead.

**`security.yml` runs on a schedule as well as on a push**, because an advisory is published against
code that was already merged. gitleaks reads the **whole history** rather than the diff: a key
committed on a branch and removed in the next commit is still fetchable and is still a leak. The
`npm audit` threshold is `high` and runtime dependencies are audited separately from build ones —
an advisory in a tool that never ships is a different question, and conflating them is what makes
a report unreadable.

**Dependabot is weekly and grouped.** One pull request per package is how this gets turned off;
fourteen bumps in one branch run CI once and are read once. Majors are excluded from the group and
proposed individually, because they change behaviour and each deserves its own decision.

## 9. What must pass before a phase may be called COMPLETE

D9 fixes the ten conditions. This section fixes the **evidence** for condition 2 ("relevant tests
run") so it cannot be satisfied by assertion.

### 9.1 The D9 ten, restated

1. Scope implemented · 2. Relevant tests run · 3. No known scope-breaking error · 4. Documentation
updated · 5. `CHANGELOG` updated · 6. `PROJECT_STATE` updated · 7. `SESSION-STATE` updated ·
8. Remaining issues documented · 9. Next phase identified · 10. Repository remains recoverable.

### 9.2 Baseline for every phase, without exception

- [ ] `npm run check` green (types, lint, and every guard the phase's changes touch).
- [ ] `npm run test` green — unit **and** integration, including `migrations-replay` and
      `seed-idempotency` once those exist.
- [ ] The phase's own exit-criteria checklist in `docs/project/phases/PHASE-*.md`, every box ticked
      with named evidence.
- [ ] `scripts/docs/check-doc-contract.mjs` green — every changed path has its required document
      change.
- [ ] `docs/SESSION-STATE.md` rewritten with all eighteen FEAT §40 fields, including **Tests Run** and
      **Test Results** naming the actual suites and their outcomes.

### 9.3 Additional gates by what the phase touched

| The phase changed… | It must also show green |
|---|---|
| `supabase/migrations/**` | `tests/integration/migrations-replay.test.ts` (applies from empty, in order); the RLS suite; `scripts/auth/check-rls.ts` |
| RLS, roles or `lib/auth/**` | `tests/unit/rls/*`, `tests/e2e/studio-authz.spec.ts`, and a `SECURITY.md` update |
| A public route | Its Lighthouse budget; its visual tier snapshots; the axe sweep at 1440 and 390; `PERFORMANCE.md` §8 row updated with a measured value and a date |
| A Studio route | `studio-authz.spec.ts`; the Studio visual baselines; axe on that route; `STUDIO_GUIDE.md` updated |
| A form or the conversion path | `tests/e2e/inquiry-conversion.spec.ts` **in both directions**; `whatsapp-render`; `rate-limit-window` |
| Seed modules or CMS content | `seed-idempotency` (run twice, plus an owner-edit simulation); `cms-workflow.spec.ts` |
| `lib/media/**` or the manifest | `manifest:verify` byte-identical; `check-asset-ids.py`; `alt-text-coverage`; `MEDIA_GUIDE.md` or `CLOUDINARY.md` updated |
| `lib/scraper/**` | `check-research-isolation.mjs`, `check-data-layer.mjs`, `tests/unit/rls/research.test.ts`, the fetch-guard unit test; `SCRAPER.md` updated |
| A client component or a dependency | `check-bundle.mjs` (baseline + 5 %), `count-islands.mjs`, `check-third-party.mjs` |
| Anything that ships to production | The `DEPLOYMENT.md` §7 release checklist, end to end |

### 9.4 Statements that do not constitute passing

"The tests should pass" · "It works locally" · a suite that was skipped, quarantined or `.only`-ed ·
a snapshot re-baselined from a developer machine · a budget raised in the same PR without a stated
reason · an exception added to `exceptions.json` without an owner and a date · a phase marked
COMPLETE while `tests/flaky.json` exceeds three rows.

---

## 10. Manual release checklist

Automation cannot do these. Run them per release and record the date and the person.

- [ ] Read every public page for tone and factual integrity against SEED §55 — no fabricated fact,
      no unverified superlative, no lorem ipsum, no "Coming Soon" on a primary page.
- [ ] Confirm no page presents concept media as delivered work (D6, D10, BR-E3).
- [ ] Open the site on a **real phone** and walk `/` → category → product → enquire.
- [ ] Complete one real WhatsApp handoff to a **test** number and confirm the message contains the
      reference code and no internal field.
- [ ] Confirm the Portfolio empty state (or only verified projects) — never an invented project.
- [ ] Confirm the owner-verification backlog printed by `scripts/ops/preflight.ts` matches
      `PRD.md` §11 and that nothing on it has been published.
- [ ] Re-run accessibility manual passes M1–M3 if the conversion path or navigation changed; record
      tester and date in `ACCESSIBILITY.md` §4.

---

## 11. Out of scope

Load and stress testing (no traffic model exists; a synthetic number would be theatre) ·
cross-browser beyond Chromium, WebKit and Firefox at the matrix widths · real-device cloud testing
services (a third-party dependency; the manual pass covers one real device) · mutation testing,
property-based testing and contract testing against third parties · testing the research subsystem
against live competitor sites — **fixtures only** · redefining the budgets or the a11y standard here
(this document executes them).

---

## 12. Risks carried

| Risk | Mitigation |
|---|---|
| Visual snapshots go permanently red and get bypassed | `stability.ts` removes motion, network, time and carets before the shutter; tolerance is per tier; re-baselining is a dispatch with an artefact, never a side effect of a push |
| Fixture data is mistaken for real inventory | Every id carries a reserved prefix, every title begins "Fixture", the seeder refuses a non-local database, and `check-fixture-isolation.mjs` fails if a fixture id or a `tests/` import reaches the product |
| Coverage percentage becomes the goal | The global number is a ratchet at the measured floor and is documented as such; the gate that means something is 100% branch on four named pure functions |
| The conversion path regresses unnoticed | `inquiry-conversion.spec.ts` asserts what reached the table, not what the page said. It is the test that found the path had never worked |
| Quarantined tests accumulate silently | `check-flaky.mjs` caps the register at three, requires a date, an observation and a real reason, and expires an entry at ninety days |
| A browser suite skips everything and reports green | Every skip carries a stated reason; `e2e.yml` publishes the seeded content before running, so a skip means a content gap rather than an unseeded database |

---

## 13. What this suite still cannot see

Stated plainly, because a list of what is covered is misleading without it.

**The Studio has no browser coverage beyond its login page.** Signing in needs Supabase Auth, and
the local harness (`scripts/db/local-rest.mjs`) is PostgREST alone — there is no auth server to
authenticate against, so there is no storage state to reuse. Every Studio spec in this repository is
guarded by `STUDIO_STORAGE_STATE` and skips: **156 of them at the last full run.** That is the
larger half of this product, and the owner spends their time in it. Closing it needs either a hosted
preview with a fixture account or GoTrue added to the local harness. Both are real work; neither is
this phase.

**Coverage is measured on the unit project alone**, so the figure understates what is tested. See §7.

**The static contrast gate reads token pairs, and a rendered page composites.** `check-contrast.mjs`
proves that every ink named in its matrix clears AA on every surface it is paired with, in all three
schemes — which is the right shape for a design system and cannot, by construction, see an ancestor
`opacity` blending that ink and that surface into the ground behind them. Phase 42's axe sweep found
exactly that on the home page: a stage dimmed to 40% took the media well's label from a compliant
10.42:1 to 2.77:1, and no ink would have fixed it, because pure white through the same 40% reaches
only 4.14:1. The browser sweep is what covers this class; the static gate is what covers the tokens
before a page exists to sweep. Neither replaces the other.

**Three public routes have no seeded sections** (`/faq`, `/privacy`, `/terms`), so they 404 and
every suite skips them. A content gap, not a test gap, and it is the reason the visual baseline count
is 33 rather than 45.

**Neither deployment drill has been run.** `docs/ops/DEPLOYMENT.md` §11.1 says so and says why.

**No load test, no cross-browser run beyond Chromium.** Out of scope above, and still true.

---

## 14. The unaided walkthrough

§13 lists what this suite cannot see. This section is what is done about the part of that list no
suite ever reaches: whether a person who has never been told anything can use the site, and whether
the owner can run it without us. Phase 42 owns this document; Phase 45 owns this section
(`docs/project/phases/PHASE-39-46.md` §45) and it answers FEAT §49 questions 5 and 8, whose verdict
rows live in `docs/design/DESIGN_SYSTEM.md` §19.1.

**It is one instrument used twice.** A person who has not been briefed, a fixed list of tasks read
verbatim, a completion count, a clock, and their own words written down. §14.2 points it at a
visitor and §14.3 points it at the owner. Both are recorded in the same shape in §14.4, because the
two failures they detect are the same failure: something obvious to the people who built it and
invisible to everybody else.

**Nobody who has seen this site may be a participant**, and that includes everyone who has read a
line of this repository. There are three or four such people available to this project in total and
each is usable exactly once, which is why §14.1 refuses to run a session the site cannot yet
support: a wasted participant cannot be recovered.

### 14.1 What "unaided" means, and what must be true before a session runs

**The facilitator may say four things and nothing else.** The task, read verbatim. The task again,
read verbatim, if asked. "Whatever you'd normally do." And "That's the end of that one." Any fifth
utterance — a nudge, a hint, a confirming noise at the moment the participant hovers the right
thing — ends the task as **aided**, and aided is recorded as not completed. Write down the fifth
utterance; a facilitator who cannot stop themselves is data about the task's wording.

**Think aloud, but no interview during the task.** Ask the participant to say what they are looking
for as they go. Questions come afterwards, because a question asked mid-task is a hint.

**Never change anything during a session**, including the obvious one-word copy fix that would
plainly have saved the participant. It goes on the list; the next participant meets the same site,
or the three sessions cannot be compared with each other.

**Preconditions, checked before the participant arrives.** A session run against a site that cannot
support a task measures a content gap and burns a participant.

| Must be true | Checked by |
|---|---|
| The site is the deployed one, not a development server | The absence of the dev-tools indicator; `EnvironmentRibbon` names the environment and renders nothing on production |
| The database is the real one, never the test fixture | No title beginning "Fixture"; §2 explains why the fixture's invented prices and enquirer names may not be shown to a stranger |
| At least one product is published and reachable from a page a visitor can land on | Open `/` and the site's own search; a product reachable only by typing its URL does not satisfy task W2 |
| The conversion path saves | `npx playwright test tests/e2e/inquiry-conversion.spec.ts` green in both directions on the deployed revision |
| The enquiry hygiene rules below are in place | A designated test identity and the studio's **test** WhatsApp number; a named person who will erase the rows afterwards |

**A preview deployment reads and writes production data** (`docs/ops/DEPLOYMENT.md` §1.1: there is
no technical stop). Every enquiry a participant submits is a real row in `inquiries`. So: the
participant never types their own telephone number or email, the designated test identity is written
on the task card, and the rows are erased at `/studio/inquiries/all/<id>` by the named person on the
same day. This is the rule §10's release checklist states for the WhatsApp handoff, applied to a
room with strangers in it.

**Run §14.3 before §14.2.** The owner's ten operations publish and correct the content the
walkthrough needs; running the walkthrough first tests a site the owner was about to change.

### 14.2 Question 5 — the five tasks

Each task is read to the participant **exactly as written**. A task names an intention and never a
route, a menu label or a button, because naming the thing is the instruction the task exists to
manage without. The success condition is what the facilitator watches for; the participant is never
told it.

| # | Read this, verbatim | Completed when | Cap | What it is really testing |
|---|---|---|---|---|
| W1 | "Show me the biggest thing this studio makes." | They reach the large-format surface and describe, in their own words, one thing that makes those pieces different from the rest | 3 min | Whether scale is the site's first idea or a page you have to look for |
| W2 | "Pick one piece you like, and tell me what it's made of and roughly how big it is." | They reach one piece's own page and read a material and one dimension off it without being shown where | 3 min | Whether a single piece is discoverable at all, and whether its specification is legible once found |
| W3 | "You want something made to your own brief. Start that conversation with the studio." | They submit an enquiry and the confirmation shows them a reference code. They are **not** asked to send a WhatsApp message from their own number | 5 min | The conversion path from a cold start — the one business rule this project has |
| W4 | "How would a piece like that actually get made? Tell me two of the steps, in order." | They reach the process surface and name two steps in the right order | 3 min | Whether the making is communicated or merely illustrated |
| W5 | "Has this studio made anything for anyone before? Tell me what you found." | They reach the portfolio surface **and** read its empty state as "not published yet" rather than as "they have never made anything" | 3 min | The dignity of an empty state (SEED §28) — the one place where a polish failure becomes a business claim |

**The threshold. A participant passes when four of the five tasks are completed unaided, and
question 5 passes when at least three first-time participants each pass.** This sentence is the only
place that number appears; `DESIGN_SYSTEM.md` §19.1 cites this section rather than restating it, for
the same reason a token has one home. Three participants is a floor and not a sample: it is enough
to tell a task nobody can do from a task one person found hard, and no more than that is claimed.

**Five minutes for W3 and three for the rest**, because W3 includes typing into a form and the
others are navigation. A task still running at its cap is stopped and recorded `ABANDONED`, which
counts as not completed. Stop it: letting it run to seven minutes to be kind produces a number that
means nothing and a participant who feels tested.

**One device per participant, not two.** Five tasks on a laptop and then the same five on a phone is
a second walkthrough by someone who is no longer a first-time visitor. Across the three
participants, at least one session is on a phone at 430 px or narrower and at least one on a desktop
at 1280 px or wider, and §14.4 records each session's viewport width.

**W2 is the fragile one, for a reason outside this document.** A visitor's routes into a single
piece today are the home page's own selections and the site's search, because the seven category
routes return "not found" (`DESIGN_SYSTEM.md` §19.5). If the precondition in §14.1 cannot be met the
walkthrough is not run at all, and question 5 keeps its `OWNER_VERIFICATION_REQUIRED` verdict with
the blocker named in its Evidence cell. Running four tasks and reporting "4 of 4" would be the most
flattering number in this document and the least true.

### 14.3 Question 8 — the owner's ten operations

The owner performs these alone, observed and timed, with nobody touching the keyboard and nobody
narrating. Every one is a thing the owner will actually do in a normal month; each names the Studio
path, the field it touches, how to confirm it worked on the public site, and how to put it back.
**The confirmation column is the operation.** An edit saved in the Studio that nobody checked on the
site is a Studio test, not a capability test.

Two standing warnings. **This writes to real data** — `docs/ops/DEPLOYMENT.md` §1.1 again — so the
reversal column is not optional and the owner writes down what they reversed. And a copy change made
here is subject to the same rules as any other: a new sentence asserting a capability is flagged
`OWNER_VERIFICATION_REQUIRED` and cannot publish until the owner clears it, which is itself worth
discovering during this exercise.

| # | Operation | Studio path | Field it touches | Confirm | Put it back |
|---|---|---|---|---|---|
| O1 | Change a headline and a button label on the home page, and publish them | `/studio/content/pages` → Home → the hero section | `heading`, `cta_label`, then the ladder DRAFT → REVIEW → APPROVED → PUBLISHED | The new words on `/` | Edit and publish again |
| O2 | Replace the phone image in that hero and write its alternative text | the same section | `media_mobile_id`, `media_alt_override` | `/` on a phone, or a 390 px window | Re-pick the previous asset |
| O3 | Rearrange a page: move one section above another, hide a third, then restore it | `/studio/content/pages` → Large Format → the section board | section order and `is_visible` | The order and the missing band on `/large-format` | The same two controls |
| O4 | Create a piece and publish it | `/studio/catalog/products/new`, then its Specifications, Materials and Media tabs | `title`, `slug`, `price_state`, specifications, bound media, then Publish once the readiness checklist is clear | `/product/<slug>` opens and shows what you entered | Unpublish |
| O5 | Rename a navigation item and hide another | `/studio/content/navigation` | `label`, `is_visible` | The header and the mega menu at 1440 and at 390 | The same two fields |
| O6 | Schedule a journal article for next week, then bring it forward to today | `/studio/content/journal/<id>` | `published_at` | Absent from `/journal`, then present | Set the date back |
| O7 | Change one route's search-result title and description | `/studio/content/seo` → Pages → that route | `title`, `description`, then the entry's `status` | The preview panel, then the browser tab on the live route | Clear the override |
| O8 | Answer an enquiry: set its stage, assign it, add a note, open the WhatsApp handoff | `/studio/inquiries/all/<id>` | `pipeline_status`, `assigned_to`, `note` | The enquiry has moved column in the inbox | Set the stage back; a note is permanent by design |
| O9 | Fix an image's alternative text from the queue | `/studio/media/all` → the alt-text queue → `/studio/media/all/<id>` | `alt_text`, or `is_decorative` where the image carries no meaning | The `alt` on the page that uses it | Re-edit |
| O10 | Give a hero image a phone crop | `/studio/media/all/<id>` → the crop panel | crop ratio, focal gravity, and the note saying why | The tighter crop on `/` at 390 px — **see the note below; this one is expected to fail its confirmation** | Delete the crop |

**Three things the capability table promises that are not among these ten, because no control
exists today.** They are part of question 8's verdict, not an omission from it, and ten of ten does
not mean the capability boundary is true.

| Promised | The truth today | Consequence |
|---|---|---|
| Publish a category, so its route exists | `saveCategoryAction` writes name, subtitle, description, order, hero image and the two SEO fields, and never `status`. There is no `publishCategoryAction` in the repository | All seven categories stay `DRAFT` and their routes 404 until an engineer adds the control |
| Edit FAQs, empty-state copy and form error messages | `/studio/content/faqs` is a route stub whose own comment says Phase 08 replaces it, and `faq-list` is a PLANNED block, so a published FAQ page would render nothing | `/faq` cannot be fixed by an editor |
| Change contact details, the WhatsApp number and the message templates | `/studio/system/settings` is a route stub whose own comment says Phase 20 replaces it | The WhatsApp number is an engineer change today, which is the single most surprising thing on this list for an owner |

**O10 will save and will not show.** The crop panel writes a `media_crops` row and no public
renderer reads one, so the owner will do everything right and see nothing change. It is left in the
ten deliberately: an operation that appears to work and does not is the most expensive kind of
capability gap, and question 8 should discover it rather than have it explained away beforehand.

Feature flags and staff users are absent from the ten for the opposite reason: they work, but they
change nothing a visitor can see, so they belong in the runbooks rather than in a test of whether
the site can be run without us.

### 14.4 The record

One block per session, appended below, oldest first. Nothing is summarised away and nothing is
tidied: this is the only place in the repository where a stranger's words about this site are
written down.

**No example row is provided.** An illustrative participant and an invented quote, in a record whose
whole value is that its quotes are real, become indistinguishable from a real one the moment
somebody deletes the brackets — so the form is described and the table starts empty.

**Participants.** `P1`, `P2`, `P3`, in the order they sat down. No name, no email, no telephone
number, ever — the rule the rest of this project applies to an enquirer, applied to a volunteer. One
line each: whether they have ever bought furniture of this kind, their device and its viewport width
in pixels, and the date. Nothing else about them is relevant and nothing else is recorded.

**Results.** One row per participant, one column per task, each cell exactly one of `DONE`, `AIDED`,
`ABANDONED` or `—` (not attempted), plus the seconds elapsed from the end of the task being read to
the success condition or the cap.

| Participant | Device · width | W1 | W2 | W3 | W4 | W5 | Passed (of 5) |
|---|---|---|---|---|---|---|---|

**Times.** Whole seconds. A slow success is a finding and a fast abandonment is a worse one, so the
number is kept even where the outcome is `DONE`.

**Verbatim quotes.** Transcribed as said, including the hesitations, the wrong word for the thing,
and the sentence that is unflattering. Never paraphrased, never tidied, never shortened to the half
that agrees with the reviewer. Attributed to `P1`/`P2`/`P3` and to the task they were said during. A
quote naming a person, a price, or anything identifying the participant is not recorded at all.
Where three participants said close to the same thing, all three are written down: the repetition is
the evidence.

**The owner's ten.** One block in the same place: the date, ten of ten or the count, and for each
operation not completed, precisely where it stopped and what it needed — a field that was not there,
a control that refused, a word in the Studio that meant something else to the owner than it does to
us. An operation completed only after a question was answered is recorded as needing help, with the
question written down verbatim, because the question is the documentation defect.

**Then the two verdicts go home.** `DESIGN_SYSTEM.md` §19.1 rows 5 and 8 are filled by the owner
from this record, with their name and the date, and this document's front-matter
`owner_verification` returns to `NOT_REQUIRED` only when no row here is outstanding.
