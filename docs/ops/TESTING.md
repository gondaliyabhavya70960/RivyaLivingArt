---
doc: TESTING
status: CURRENT
owning_phase: 42
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
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

**Implementation status.** No tests exist. No `vitest.config.ts`, no `playwright.config.ts`, no CI.
This is the system Phase 00 scaffolds and Phase 42 completes; every phase between them adds specs
that must fit these layers.

**Tooling (D1, fixed):** Vitest for unit and integration, Playwright for e2e and visual. No other
runner is introduced without an amendment.

---

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

One deterministic fixture, built rather than seeded ad hoc, shared by integration, e2e and visual.

`scripts/test/seed-fixture.ts` produces a known state:

| Content | Detail |
|---|---|
| CMS | The Phase 09 content seed, **published** |
| Products | Three, entered as an owner would, covering `PRICE_ON_REQUEST`, `STARTING_FROM` and `FIXED` so every price branch is exercised |
| Catalogue | One collection, seven categories, a materials set |
| Editorial | One portfolio project, two journal articles, ten FAQs |
| Conversion | Five inquiries in different pipeline states |
| Research | One source, one run, twenty research products across the pipeline stages |
| Identity | One staff user per role (six) |

| Property | Rule |
|---|---|
| Determinism | Ids, slugs and reference codes are fixed constants in `tests/fixtures/ids.ts`; timestamps come from a frozen clock at `2026-01-15T12:00:00Z` |
| Idempotency | Re-running produces an identical state; `--reset` rebuilds from empty |
| Isolation | Nothing in the fixture is a business fact. The products are obviously fictional, exist only in the fixture database, and `scripts/test/check-fixture-isolation.mjs` **fails if a fixture id, slug or title string appears anywhere outside `tests/**`** — in particular in `app/**`, `content/**`, `lib/**` or `scripts/seed/**` |
| Provenance | The fixture database is created by the same `supabase/migrations` set production uses. That is the point |

### 2.1 Media determinism

**Cloudinary is never contacted in tests.** A Playwright route handler
(`tests/support/media-route.ts`) intercepts `res.cloudinary.com` and serves twelve committed
low-resolution derivatives from `tests/fixtures/media/` — one per D6 ratio, plus one poster and one
short video. They are produced once by `scripts/test/build-fixture-media.ts` from assets already in
the manifest, committed as small files. No asset is regenerated, no original is modified, and
`manifest:verify` still passes byte-identically (D6, BR-E2).

The suite must pass **with the network disconnected**. That is the proof that no test depends on a
CDN, a quota or an external origin.

---

## 3. The visual QA matrix (FEAT §45)

The eight widths, tiered so the matrix is exhaustive where composition is load-bearing and economical
where it is not.

| Tier | Widths | Routes | Snapshots |
|---|---|---|---|
| **A** — all eight | 1920 · 1440 · 1280 · 1024 · 768 · 430 · 390 · 360 | `/`, `/large-format`, `/collection/[category]`, `/product/[slug]` | 32 |
| **B** — five | 1920 · 1440 · 1024 · 768 · 390 | `/about`, `/process`, `/collection`, `/collections/[slug]`, `/custom-commissions`, `/portfolio`, `/journal`, `/journal/[slug]`, `/contact`, `/faq`, `/search` | 55 |
| **C** — two | 1440 · 390 | `/privacy`, `/terms`, `/portfolio/[slug]`, `/journal/category/[slug]`, 404, 500 | 12 |
| **Studio** — four | 1920 · 1440 · 1280 · 1024 | `/studio`, `/studio/catalog/products`, `/studio/content/pages`, `/studio/media/all`, `/studio/inquiries/all`, `/studio/research/dashboard`, `/studio/system/environment` | 28 |

**127 snapshots.** The Studio is not snapshotted below 1024 px: it is a desktop tool and says so.

### 3.1 Snapshot stability rules — all mandatory

`prefers-reduced-motion: reduce` forced · Playwright `animations: 'disabled'` · fonts preloaded and
`document.fonts.ready` awaited · media from the fixture interceptor · the frozen clock · dynamic
regions (relative timestamps, run durations, random ids) masked with `mask:` ·
`maxDiffPixelRatio: 0.002` · **baselines are accepted only from the pinned CI container image** — a
locally generated `.png` is rejected by a CI check comparing the image's platform metadata.

### 3.2 FEAT §45 surface checklist

Every surface §45 names has an owning spec, so "check the scraper at 768 px" is a file, not a memory.

| §45 surface | Owning spec |
|---|---|
| navigation | `tests/e2e/site-shell.spec.ts`, `navigation-a11y.spec.ts` |
| hero, typography, media crop | `tests/visual/tier-a.visual.spec.ts` |
| product cards, product galleries | `tests/e2e/catalogue.spec.ts`, `product-gallery-a11y.spec.ts` |
| 3D | `tests/e2e/model-viewer.spec.ts` (flag on and off) |
| motion | `tests/e2e/a11y/reduced-motion.spec.ts`, `homepage-motion.spec.ts` |
| forms | `tests/e2e/{contact-form,commission-configurator,inquiry-conversion}.spec.ts` |
| filters, search | `tests/e2e/{catalogue-filters,search-public,search-combobox-a11y}.spec.ts` |
| CMS-driven content | `tests/e2e/cms-workflow.spec.ts`, `tests/integration/seed-idempotency.test.ts` |
| Studio | `tests/visual/studio.visual.spec.ts`, `tests/e2e/studio-authz.spec.ts` |
| scraper | `tests/e2e/{research-dashboard,research-run-lifecycle}.spec.ts` |
| charts, tables | `tests/e2e/studio-analytics.spec.ts`, `tests/visual/studio.visual.spec.ts` |
| responsive behaviour | The matrix above |
| touch interactions | `tests/e2e/touch.spec.ts` — swipe on the gallery, tap targets, drawer drag, at 390 px with touch emulation |

---

## 4. The tests that exist because a business rule exists

Every rule in `BUSINESS_RULES.md` that can be tested, is. These are not optional coverage; they are
the rules in executable form.

| Rule | Spec | Asserts |
|---|---|---|
| BR-A1/A2/A3 | `tests/integration/forbidden-tables.test.ts` | No cart, order, payment, customer, review, shipment or quote relation exists |
| **BR-B1** | `tests/e2e/inquiry-conversion.spec.ts` | Success: row persisted, then a WhatsApp URL carrying the persisted reference. **Failure: the SEED §49 copy and no navigation to `wa.me` at all.** Run in both directions on **every** PR |
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
| **BR-F1/F2/F3/F4** | `tests/unit/rls/research.test.ts`, `check-research-isolation.mjs`, `check-data-layer.mjs` | No `anon` policy on any `research_*` table; no FK to `products`; no research term in a public search result; no image is downloaded |
| BR-G1/G2 | `tests/unit/rls/*.test.ts`, `tests/e2e/studio-authz.spec.ts` | One client per role, allow/deny per table; forbidden POSTs return 403 **and** write `DENIED` audit rows |
| BR-G4 | `tests/e2e/bulk.spec.ts` | Typed confirmation, exact preview count, undo within 24 h restores byte-identically |
| BR-I1 | `tests/unit/pii-scope.test.ts` | No inquiry personal field reaches `search_documents`, `web_vitals_samples` or an `audit_log` blob |
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

Plus two pre-browser guards in `npm run check`: `scripts/a11y/check-contrast.mjs` (token matrix) and
`scripts/a11y/check-focus-styles.mjs` (no unreplaced `outline: none`).

`tests/e2e/a11y/exceptions.json` ships with **zero rows**, prints in full on every run, and requires
a reason, an owner and a dated review per row. Its row count is an exit criterion.

---

## 6. Performance tests

Run as a separate required CI job. Budgets: `docs/ops/PERFORMANCE.md` — Phase 42 **executes** them,
it does not redefine them.

| Check | Asserts |
|---|---|
| Lighthouse CI matrix | Every route within its `perf/budgets.json` LCP, CLS, INP and JS budget; the reported LCP element is an `<img>` |
| `scripts/perf/check-bundle.mjs` | Baseline + 5 %; **no `three`, `@react-three/*`, Draco or meshopt module in any first-load graph** |
| `scripts/perf/count-islands.mjs` | Every route at or under its island budget |
| `scripts/perf/check-image-props.mjs` / `check-video-props.mjs` | `sizes` everywhere; one `priority` per route; posters and gates on every video |
| `scripts/perf/check-cache-headers.mjs` | Every row of the caching contract, against a running production build |
| `scripts/perf/check-third-party.mjs` | Zero external origins |
| `tests/unit/vitals-payload.test.ts` | The vitals schema rejects `ip`, `userAgent`, `sessionId`, `userId`, `url` and any extra key |

---

## 7. Coverage, and why it is not one percentage

A single global percentage is trivially gamed by testing getters. Two rules instead:

1. **Statements ≥ 80 % over `lib/**`.**
2. **100 % branch coverage** on a named critical list, where a missed branch is a real business
   failure:

```
lib/whatsapp/shorten.ts        lib/catalog/price-state.ts     lib/auth/permissions.ts
lib/seo/jsonld/guard.ts        lib/security/rate-limit.ts     lib/logging/redact.ts
lib/media/validate-upload.ts   lib/relations/rules.ts         lib/scraper/normalization/**
```

The list lives in `vitest.config.ts`. **Adding a file to it is easier than removing one**: removal
requires a reviewer note explaining why the branch no longer matters.

---

## 8. CI shape

| Job | Trigger | Notes |
|---|---|---|
| `check` | Every push | Types, lint, and every guard script in §4–§6 |
| `unit` + `integration` | Every push | Integration runs against `supabase start` |
| `docs-contract` | Every PR | `scripts/docs/check-doc-contract.mjs` |
| `e2e` | PRs to `main`, and `main` | Sharded four ways |
| `visual` | PRs to `main`, and `main` | 127 snapshots; baselines from the pinned container only |
| `lighthouse` | PRs to `main`, and `main` | Separate required job |
| `a11y` | PRs to `main`, and `main` | Separate required job |
| `security` | Every PR | `gitleaks`, `npm audit --audit-level=high`, licence check, secret-exposure grep |
| `migrate-staging` | Merge to `main` | Push to `rivya-staging`, then `deploy-smoke.spec.ts` |

Artefacts — traces, videos, diff images — are uploaded on failure and retained 14 days. **Wall-clock
target for the required set: ≤ 15 minutes**, itself monitored.

### 8.1 Flake policy

A test that fails twice in thirty days on `main` is **quarantined** into a `@flaky`-tagged project
that still runs and still reports, with a tracking issue naming an owner and a date. It is never
deleted and never `.skip`-ped without that issue. `tests/flaky.json` holds at most **three** rows,
each with owner, issue and date; CI prints the count on every run.

---

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
| Visual snapshots go permanently red and get bypassed | Mandatory stability rules; baselines only from the pinned CI image; `maxDiffPixelRatio` absorbs sub-pixel noise; a genuine diff is an artefact a reviewer looks at, and re-baselining is a reviewable commit |
| Fixture data is mistaken for real inventory | Fixture rows exist only in the fixture database, are obviously fictional, and `check-fixture-isolation.mjs` fails if any fixture string appears in application code or seed modules |
| A 127-snapshot matrix makes CI too slow to keep | Four-way sharding; snapshots only on PRs to `main` and on `main`; tiering reserves all eight widths for the four routes where composition matters most; the 15-minute target is monitored |
| Coverage percentage becomes the goal | No global gate beyond `lib/**` statements; the branch gate applies to a named list where a missed branch is a real business failure |
| The conversion path regresses unnoticed | It runs in the required E2E set on every PR, in both directions |
| Quarantined tests accumulate silently | `tests/flaky.json` requires owner, issue and date; CI prints the count; the cap is three and it is an exit criterion |
| Local re-baselining hides a real regression | A CI check compares the image's platform metadata and rejects developer-machine baselines |
