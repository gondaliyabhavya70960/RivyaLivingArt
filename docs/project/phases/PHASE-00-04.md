---
doc: PHASE-00-04
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
---

# PHASES 00–04 — Foundation

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Requirements of record: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` and
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` — never edited, only cited.

**How to read a phase.** Every phase below carries the same twelve blocks. *Exit criteria* is a
literal checklist: the phase is not COMPLETE until every box is ticked **and** the ten-point
completion contract in CANONICAL-DECISIONS **D9** holds (scope implemented · relevant tests run ·
no known scope-breaking error · documentation updated · CHANGELOG updated · PROJECT_STATE updated ·
SESSION-STATE updated · remaining issues documented · next phase identified · repository remains
recoverable).

**Conventions used throughout.**

| Convention | Value |
|---|---|
| Package manager | `npm` only — one committed `package-lock.json`, no pnpm/yarn lockfiles |
| Migration file names | `supabase/migrations/NNNN_snake_case_description.sql`, four digits, forward-only |
| Route notation | `/studio/...` = Studio (D4); `/...` = public (D3); `app/api/...` = route handler |
| Owner-verification marker | Any statement asserting real business capability is seeded `OWNER_VERIFICATION_REQUIRED` |
| Never invented | Product names presented as inventory, prices, dimensions, materials, lead times, delivered projects, clients, testimonials, awards, certifications, durability claims (D10, requirement §32/§38) |
| Conversion model | Persisted inquiry → WhatsApp handoff. No checkout, no payment gateway, no customer accounts |

**Amendment proposals raised by this document.** Two paths these phases must create are absent from
the fixed canonical maps. Neither is taken silently: each is recorded here as a proposal that must be
appended to `CANONICAL-DECISIONS.md` *Amendments* as **A2**, in its own amendment PR, **before** the
phase that creates the path begins. This is the procedure Phase 01 already requires — "contradictions
found are logged as amendment proposals, not silently reconciled".

| Proposal | Section it amends | Path it adds | Why the build cannot avoid it | Needed by |
|---|---|---|---|---|
| **A2·a** | D2 repository layout | `app/styles/` (`tokens.css`, `base.css`) | D2's `app/` tree enumerates route directories only and names no home for the token layer. Tokens must be a real CSS file (D1 rejects CSS-in-JS) and must sit above both route groups, since Studio and the public site share one token set (requirement §6) | Phase 02 |
| **A2·b** | D4 Studio route map | `/studio/login` | Middleware may only redirect; the redirect target must be an unauthenticated page inside the Studio group. D4's map lists authenticated surfaces only, so the sign-in surface has no listed home | Phase 04 |

The dev-only design-system gallery is deliberately **not** on this list. It lives at
`app/(site)/design-system/**`, a directory D2 already fixes, and calls `notFound()` in production —
so no route it adds exists in a production build and the D3 public route map is unchanged. See
Phase 02, *Public surface*.

---

## PHASE 00 — Repository Audit & Baseline

**Goal** — The repository stops being a documents-only folder and becomes a machine an engineer can
clone and run deterministically: one pinned Node toolchain, one package manager, one command that
type-checks, lints, formats, unit-tests and builds, and a CI job that runs exactly that command on
every push. Nothing about the product changes for a visitor — this phase changes whether any later
phase can be trusted, because from here on "it works on my machine" is falsifiable. It also fixes
the session-recovery file set, so a new session can reconstruct project state from five files
instead of from memory.

**Depends on** — None. This is the root phase.

**Audit result (already performed — recorded here, not to be repeated)**

| Fact | Value |
|---|---|
| Commits | 3 — `3e29c81` initial, `231a1c4` baseline + requirements of record + Higgsfield asset audit, `d5217ed` canonical decisions contract |
| Tracked files | 9 — `README.md`, `.gitignore`, `scripts/media/build-higgsfield-manifest.py`, `data/higgsfield/raw/{images,videos}.json`, `data/higgsfield/asset-manifest.json`, `docs/requirements/{01,02}-*.md`, `docs/architecture/CANONICAL-DECISIONS.md` |
| Application code | None. No `package.json`, no `app/`, no `lib/`, no `supabase/`, no tests, no CI |
| Media inventory | `data/higgsfield/asset-manifest.json` — manifest version `rivya-hf-v1`, 250 assets (224 image, 26 video), 24 families, 11 page buckets, 8 aspect ratios, every row `status = AVAILABLE_UNMIGRATED` and `owner_verification = OWNER_VERIFICATION_REQUIRED` |
| Media generation | **Closed.** Regenerating anything already in the manifest violates D6 / requirement §33 |
| Empty documentation directories | `docs/project`, `docs/architecture` (partial), `docs/design`, `docs/content`, `docs/media`, `docs/ops`, `docs/studio` |

**Scope**

- Pin the toolchain: `.nvmrc`, `package.json#engines`, committed `package-lock.json`.
- Scaffold `package.json` with the canonical script names (table below) — scripts may fail with
  "not implemented yet" until their phase lands, but the *names* are fixed here so CI and later
  phases never rename them.
- TypeScript in strict mode with no escape hatches: `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, path alias `@/*`.
- ESLint flat config + Prettier, both runnable and both wired into CI.
- Vitest and Playwright configs, including the visual QA viewport matrix from requirement §45.
- GitHub Actions CI running the composite `npm run check`.
- `.env.example` listing **only** the D8 variable names, with empty values and a comment that no
  value, prefix or length is ever committed or displayed.
- Create the session-recovery file set with real initial content (not stubs).
- Record the Python dependency: `scripts/media/build-higgsfield-manifest.py` requires Python 3.11+
  and is a maintenance script, deliberately outside the Node build graph.

**Out of scope**

- Any Next.js route, component, Supabase table or Cloudinary configuration.
- Regenerating, re-classifying or editing `data/higgsfield/asset-manifest.json` (Phase 07 owns it).
- Vercel project creation, environment variable provisioning, preview deployments (Phase 44).
- Writing PRD / ARCHITECTURE / DATA_MODEL prose — that is Phase 01.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Node pin | `.nvmrc` | `22.11.0` (Node 22 LTS line) |
| Engine constraint | `package.json` → `engines` | `"node": ">=22.11 <23"`, `"npm": ">=10"` |
| Scripts + deps | `package.json` | script names frozen by the table below |
| Lockfile | `package-lock.json` | committed; CI uses `npm ci` |
| TS config | `tsconfig.json` | strict flags above; `"@/*": ["./*"]` |
| Lint | `eslint.config.mjs` | flat config: `next/core-web-vitals`, `@typescript-eslint` recommended-type-checked, `eslint-plugin-import` ordering |
| Format | `.prettierrc.json`, `.prettierignore` | Prettier 3 + `prettier-plugin-tailwindcss`; `printWidth: 100` |
| Editor | `.editorconfig` | LF, UTF-8, 2-space indent, final newline |
| Git attributes | `.gitattributes` | `* text=auto eol=lf`; `data/higgsfield/*.json linguist-generated` |
| Env template | `.env.example` | D8 names only, values empty |
| Unit test config | `vitest.config.ts` | `environment: 'node'`, `include: ['tests/unit/**/*.test.ts']` |
| E2E config | `playwright.config.ts` | projects for the §45 widths |
| CI | `.github/workflows/ci.yml` | install → typecheck → lint → format:check → test → build, plus the two media gates as separate steps: `manifest:verify` and `media:check-ids` (D6 amendment A1) |
| E2E CI | `.github/workflows/e2e.yml` | separate workflow; runs on PR to `main` only |
| PR template | `.github/pull_request_template.md` | embeds the Phase 01 documentation-update checklist |
| Ignore rules | `.gitignore` | already present — extend with `.supabase/`, `*.tsbuildinfo` |
| Session recovery | `CLAUDE.md`, `PROJECT_STATE.md`, `CONTEXT.md`, `CHANGELOG.md`, `README.md`, `docs/SESSION-STATE.md` | file set fixed by D7 + requirement §40/§41 |

**Canonical npm scripts (names frozen in this phase)**

| Script | Command | Phase that makes it meaningful |
|---|---|---|
| `dev` | `next dev` | 10 |
| `build` | `next build` | 10 |
| `start` | `next start` | 44 |
| `typecheck` | `tsc --noEmit` | 00 |
| `lint` / `lint:fix` | `eslint .` / `eslint . --fix` | 00 |
| `format` / `format:check` | `prettier --write .` / `prettier --check .` | 00 |
| `test` / `test:watch` | `vitest run` / `vitest` | 00 |
| `test:e2e` | `playwright test` | 10 |
| `check` | `npm run typecheck && npm run lint && npm run format:check && npm run test` | 00 |
| `db:types` | `supabase gen types typescript --local > lib/supabase/database.types.ts` | 03 |
| `db:reset` | `supabase db reset` | 03 |
| `db:migrate` | `supabase migration up` | 03 |
| `seed:content` | `tsx scripts/seed/seed-content.ts` | 03 machinery, 09 copy |
| `seed:media` | `tsx scripts/seed/seed-media.ts` | 06 |
| `manifest:build` | `python3 scripts/media/build-higgsfield-manifest.py` | 07 (already run) |
| `manifest:verify` | `npm run manifest:build && git diff --exit-code data/higgsfield/asset-manifest.json` | 00 |
| `media:check-ids` | `python3 scripts/media/check-asset-ids.py` | 00 — the D6 amendment **A1** gate; the script already exists |
| `media:assert-no-regen` | `tsx scripts/media/assert-no-regeneration.ts` | 07 — script lands with the migration; the name is frozen here |

D6 amendment **A1** requires `check-asset-ids.py` to run "in CI and before any media migration", and
`docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md` already names `media:assert-no-regen` as a merge gate.
Both therefore need a frozen script name from this phase, even though only the first is runnable
today: `media:assert-no-regen` exits with the "implemented in Phase 07" message until Phase 07 writes
`scripts/media/assert-no-regeneration.ts`.

**Database** — None.

**Studio surface** — None.

**Public surface** — None.

**Media** — None consumed. The manifest is read-only in this phase; `manifest:verify` proves the
generator is deterministic and that the committed manifest matches its inputs.

**Risks**

| Risk | Mitigation |
|---|---|
| Second package manager creeps in, lockfiles diverge | `.gitignore` `pnpm-lock.yaml`/`yarn.lock`; CI fails if either exists |
| Strict TS flags fought later with `any` / `@ts-expect-error` | ESLint bans bare `any` and requires a description on `@ts-expect-error`; CI counts suppressions and fails on increase |
| Manifest generator drifts from committed output | `manifest:verify` runs in CI; a non-empty diff fails the build |
| A secret is pasted into `.env.example` | CI grep job rejects any `=` followed by a non-empty value in `.env.example` |
| Session-recovery files rot into fiction | Requirement §41: a new session verifies repository state before trusting any document |

**Verification**

1. `nvm use && npm ci` — clean install with no engine warning.
2. `npm run check` — exits 0.
3. `npm run manifest:verify` — exits 0 with no diff.
4. `npm run media:check-ids` — exits 0 and prints
   `checked <N> documents against 250 manifest IDs: 0 collision(s)`. To prove it bites, temporarily
   add to any file under `docs/**` a gap ID of the forbidden `<FAMILY>-<NNN>` form — an upper-cased
   family name from `counts.by_family` plus a three-digit ordinal the manifest has not minted — and
   confirm it exits 1 naming the file, then remove it. **Do not leave such an ID written down**, not
   even as a cautionary example: the guard scans prose and cannot tell an illustration from a plan,
   so spelling one out turns this document itself red. This is the D6 amendment A1 gate.
5. `node -e "require('fs').readFileSync('.env.example','utf8').split('\n').filter(l=>/=.+/.test(l)).length===0||process.exit(1)"` — exits 0.
6. Open a throwaway PR; confirm the CI workflow ran `typecheck`, `lint`, `format:check`, `test`,
   `build`, `manifest:verify` and `media:check-ids` as separate visible steps and that the PR
   template rendered its checklist.
7. `jq '.counts.total' data/higgsfield/asset-manifest.json` returns `250`.

**Exit criteria**

- [ ] `.nvmrc`, `engines`, and a single committed `package-lock.json` exist.
- [ ] `npm run check` passes on a clean clone with no network beyond `npm ci`.
- [ ] Every script name in the table above resolves (implemented, or exits with an explicit
      "implemented in Phase NN" message — never silently succeeds).
- [ ] CI runs on push and PR and is red when `npm run check` is red.
- [ ] `.env.example` contains the exact D8 name set and zero values.
- [ ] `CLAUDE.md`, `PROJECT_STATE.md`, `CONTEXT.md`, `CHANGELOG.md`, `docs/SESSION-STATE.md` exist
      with real content and correct current-phase pointers.
- [ ] `npm run manifest:verify` is green and documented as a CI gate.
- [ ] `npm run media:check-ids` is green, runs as its own CI step, and is documented as the D6
      amendment A1 gate; `media:assert-no-regen` resolves to a named script (failing with the
      "implemented in Phase 07" message is acceptable, silently succeeding is not).
- [ ] D9 ten-point contract satisfied.

---

## PHASE 01 — PRD, Architecture & Documentation

**Goal** — The project acquires a written contract that later phases can be checked against, so
disagreements are resolved by reading rather than by argument. `CANONICAL-DECISIONS.md` already
fixes stack, layout, routes, naming and env vars; this phase adds the layer beneath it — what the
product is for (PRD), how it is put together (ARCHITECTURE), what the data means (DATA_MODEL), what
the business forbids (BUSINESS_RULES), and in what order it gets built (ROADMAP) — plus the
enforcement mechanism that keeps documentation from drifting behind code.

**Depends on** — Phase 00.

**Scope**

- Complete the D7 documentation map. Every file listed in D7 exists after this phase, either as
  final content or as an explicitly-marked stub owned by a named later phase.
- Add front matter to every document under `docs/` so status is machine-readable:

  ```yaml
  ---
  doc: ARCHITECTURE
  status: DRAFT | CURRENT | SUPERSEDED
  owning_phase: 01
  last_reviewed: 2026-09-07
  owner_verification: NOT_REQUIRED | OWNER_VERIFICATION_REQUIRED
  ---
  ```

- Write `docs/project/PRD.md`: audience, the seven seeded categories in D3 priority order, the
  conversion model (inquiry → WhatsApp), the non-goals, and the success criteria transcribed from
  requirement §51. No invented market claims, no invented customers.
- Write `docs/project/BUSINESS_RULES.md`: the three absolute prohibitions (no checkout, no payment
  gateway, no customer accounts), the price-label vocabulary (`Request Quote`, `Starting From`,
  `Price on Request`), the content-integrity rules from D10 / §38, and the
  `OWNER_VERIFICATION_REQUIRED` policy.
- Write `docs/project/ROADMAP.md`: all 47 phases from requirement §44 in one table with columns
  `Phase · Title · Status · Owning document · Blocking dependencies`.
- Write `docs/architecture/ARCHITECTURE.md`: rendering strategy (Server Components by default,
  Client Components only where interaction demands), the D2 folder layout with one sentence per
  directory, trust boundaries and where Zod sits on each, caching and revalidation strategy
  (`REVALIDATE_SECRET` webhook path), and the `MediaProvider` seam.
- Write `docs/architecture/DATA_MODEL.md` as a living document: naming rules from D5, the enum
  catalogue, and an entity table that Phase 03 onward appends to.
- Stub `docs/architecture/SCRAPER.md` (owned by Phase 25) with the §27 adapter tree only.
- Create the documentation-update contract and enforce it in CI.
- Formalise the SESSION-STATE template with the eighteen fields from requirement §40.
- Formalise the amendment procedure for `CANONICAL-DECISIONS.md`.

**Out of scope**

- Public marketing copy. Every headline, paragraph and CTA label is seeded content owned by
  Phases 08–09, not documentation (requirement §1: copy never lives in JSX *or* in docs as the
  source of truth).
- Final content of `docs/ops/*` — Phases 38/40/41/44 own deployment, performance, accessibility
  and security detail; Phase 01 creates the files with a scope paragraph and an owner marker.
- `docs/design/COMPONENT_REGISTRY.md` rows (Phase 02) and
  `docs/content/INITIAL_CONTENT_INVENTORY.md` rows (Phase 09).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Product requirements | `docs/project/PRD.md` | audience, categories, conversion model, non-goals, §51 success criteria |
| Business rules | `docs/project/BUSINESS_RULES.md` | prohibitions, price labels, content integrity, verification policy |
| Roadmap | `docs/project/ROADMAP.md` | 47-row status table, single source of phase status |
| Architecture | `docs/architecture/ARCHITECTURE.md` | rendering, boundaries, caching, provider seams |
| Data model | `docs/architecture/DATA_MODEL.md` | naming, enum catalogue, entity table (grows per phase) |
| Scraper stub | `docs/architecture/SCRAPER.md` | §27 tree + "owned by Phase 25" marker |
| Design system stub | `docs/design/DESIGN_SYSTEM.md` | owned by Phase 02 |
| Component registry stub | `docs/design/COMPONENT_REGISTRY.md` | column contract only; rows from Phase 02 |
| Studio guide stub | `docs/studio/STUDIO_GUIDE.md` | owned by Phase 05 |
| Media guides | `docs/media/{MEDIA_GUIDE,CLOUDINARY,HIGGSFIELD_GUIDE}.md` | stubs owned by Phases 06/07 |
| Higgsfield plan/status | `docs/media/{HIGGSFIELD_MASTER_ASSET_PLAN,HIGGSFIELD_ASSET_STATUS}.md` | required by §34; owned by Phase 07 |
| Content guides | `docs/content/{CONTENT_GUIDE,INITIAL_CONTENT_INVENTORY}.md` | column contract now, rows in Phase 09 |
| Ops docs | `docs/ops/{DEPLOYMENT,ENVIRONMENT,SECURITY,ACCESSIBILITY,PERFORMANCE,TESTING}.md` | scope paragraph + owning phase |
| Session state | `docs/SESSION-STATE.md` | eighteen §40 fields, rewritten at every phase end |
| Doc-contract checker | `scripts/docs/check-doc-contract.mjs` | two jobs: maps changed paths → required doc touch (table below), and validates front matter on every `docs/**/*.md` outside `docs/requirements/**` — first line exactly `---`, then all five keys present. Never `grep '^---'`, which any horizontal rule satisfies |
| CI wiring | `.github/workflows/ci.yml` | adds a `docs-contract` job on pull requests |

**Documentation update contract (requirement §43, made enforceable)**

| If the PR changes… | It must also change… | Enforced by |
|---|---|---|
| `supabase/migrations/**` | `docs/architecture/DATA_MODEL.md` | `check-doc-contract.mjs` |
| `app/(studio)/**`, `components/studio/**` | `docs/studio/STUDIO_GUIDE.md` | `check-doc-contract.mjs` |
| `lib/scraper/**` | `docs/architecture/SCRAPER.md` | `check-doc-contract.mjs` |
| `lib/media/**`, `scripts/media/**` | `docs/media/MEDIA_GUIDE.md` **or** `docs/media/CLOUDINARY.md` | `check-doc-contract.mjs` |
| `data/higgsfield/**` | `docs/media/HIGGSFIELD_ASSET_STATUS.md` | `check-doc-contract.mjs` |
| `components/primitives/**`, `components/patterns/**` | `docs/design/COMPONENT_REGISTRY.md` | `check-doc-contract.mjs` |
| `.env.example`, `lib/**` reading `process.env` | `docs/ops/ENVIRONMENT.md` | `check-doc-contract.mjs` |
| `lib/auth/**`, any RLS migration | `docs/ops/SECURITY.md` | `check-doc-contract.mjs` |
| Any phase marked COMPLETE | `CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`, `docs/project/ROADMAP.md` | PR template + reviewer |
| Anything under `docs/requirements/**` | **Rejected** — requirements are specifications of record | `check-doc-contract.mjs` hard failure |

**Amendment procedure for CANONICAL-DECISIONS.md** — never edit a D-section in place. Append a
dated entry under *Amendments* stating: what changed, why, which phases are affected, and which
documents were updated in the same PR. An amendment PR touches only that file plus the documents it
invalidates.

**Database** — None.

**Studio surface** — None. (`/studio/system/documentation` renders these files, but that viewer is
built in Phase 38; this phase only guarantees the files exist and are sanitised — no secrets, no
environment values, no private URLs.)

**Public surface** — None.

**Media** — None. `docs/media/HIGGSFIELD_ASSET_STATUS.md` is created as a stub; it is populated from
the existing 250-asset manifest in Phase 07 and must never trigger regeneration.

**Risks**

| Risk | Mitigation |
|---|---|
| Docs become aspirational fiction | Front matter `status` plus requirement §41: verify repository state, never trust a document's claim |
| Doc-contract checker becomes noise and gets bypassed | Rules are path-glob narrow and listed in the PR template; a bypass requires an explicit `docs-contract: skip` line in the PR body with a reason |
| Marketing copy migrates into docs and becomes a second source of truth | BUSINESS_RULES states that copy lives only in Supabase; the reviewer rejects prose headlines in docs |
| Roadmap status drifts from reality | ROADMAP is the only place phase status is recorded; PROJECT_STATE links to it rather than duplicating it |

**Verification**

1. `node scripts/docs/check-doc-contract.mjs --base origin/main` on a branch that edits a migration
   without touching `DATA_MODEL.md` — exits non-zero with the rule name.
2. Same command on a branch editing `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` — exits
   non-zero with "requirements are specifications of record".
3. `ls` every path in D7 — all present.
4. Front matter is present **and** complete. `^---` matches any horizontal rule, so the test is the
   *first line* plus the five required keys:

   ```bash
   for f in $(git ls-files docs | grep '\.md$' | grep -v '^docs/requirements/'); do
     head -1 "$f" | grep -qx -- '---' || { echo "MISSING FRONT MATTER: $f"; continue; }
     for k in doc status owning_phase last_reviewed owner_verification; do
       awk 'NR==1{next} /^---$/{exit} {print}' "$f" | grep -q "^$k:" || echo "MISSING KEY $k: $f"
     done
   done
   ```

   Expected output: **nothing**. Run against the tree as it stands on 2026-09-07 it names sixteen
   files — `docs/SESSION-STATE.md`, `docs/architecture/CANONICAL-DECISIONS.md`,
   `docs/content/{CONTENT_GUIDE,INITIAL_CONTENT_INVENTORY}.md`,
   `docs/media/{CLOUDINARY,HIGGSFIELD_ASSET_STATUS,HIGGSFIELD_GUIDE,HIGGSFIELD_MASTER_ASSET_PLAN,MEDIA_GUIDE}.md`,
   `docs/project/ROADMAP.md` and `docs/project/phases/PHASE-05-09.md` … `PHASE-39-46.md` — every one
   of which must gain front matter before this phase's exit criterion can be ticked. The same logic
   lives in `scripts/docs/check-doc-contract.mjs` so CI enforces it; this manual run is only a
   spot-check of the checker.
5. Read `docs/project/ROADMAP.md`: 47 rows, statuses for 00–01 reflect reality, 02 is `NEXT`.
6. Zero **affirmative** references to a rejected stack or to forbidden commerce. A blanket grep
   cannot be used: the documents are *required* to name what they reject (this phase's own
   `BUSINESS_RULES.md` scope bullet mandates the word "checkout"), and five Higgsfield image prompts
   contain the phrase "no neon". So the check is split — implementation is searched for the terms,
   documentation is searched for the prohibition:

   ```bash
   # a. rejected stacks, implementation paths only (docs/** deliberately excluded)
   grep -rniE '\b(sanity|contentful|neon|prisma|vercel[- ]blob)\b' \
     app components lib content scripts supabase tests package.json 2>/dev/null

   # b. no rejected dependency is installed
   node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};
     const bad=/^(@?sanity|@?contentful|@neondatabase|@?prisma|@vercel\/blob|@?stripe|razorpay)/;
     const hit=Object.keys(d).filter(k=>bad.test(k));if(hit.length){console.error(hit);process.exit(1)}"

   # c. no commerce affordance in implementation
   grep -rniE '\b(stripe|razorpay|checkout|add[_ -]?to[_ -]?cart|payment[_ -]?intent)\b' \
     app components lib content supabase scripts 2>/dev/null

   # d. the prohibitions are actually stated
   grep -ciE 'no (online )?checkout'  docs/project/BUSINESS_RULES.md
   grep -ciE 'no payment gateway'     docs/project/BUSINESS_RULES.md
   grep -ciE 'no customer accounts'   docs/project/BUSINESS_RULES.md
   ```

   Expected: (a) and (c) print nothing and exit 1 (grep's "no match"), (b) exits 0, (d) prints three
   non-zero counts. Paths that do not exist yet are skipped by `2>/dev/null`, so the check is
   meaningful from Phase 01 onward and gets stronger as code arrives.

**Exit criteria**

- [ ] Every path in D7 exists; none is empty.
- [ ] Every `docs/**` file except `docs/requirements/**` carries valid front matter — first line
      `---` and all five keys — proved by `check-doc-contract.mjs`, not by a horizontal-rule grep.
      The sixteen files listed in verification step 4 are the outstanding work.
- [ ] PRD, BUSINESS_RULES, ARCHITECTURE, DATA_MODEL, ROADMAP are `status: CURRENT`; all others are
      explicitly stubbed with an owning phase.
- [ ] `scripts/docs/check-doc-contract.mjs` passes on `main` and fails on each seeded counter-example.
- [ ] The documentation-update contract table appears in both `ARCHITECTURE.md` and the PR template.
- [ ] `docs/SESSION-STATE.md` contains all eighteen §40 fields, filled for Phase 01.
- [ ] No document contradicts `CANONICAL-DECISIONS.md`; contradictions found are logged as
      amendment proposals, not silently reconciled.
- [ ] D9 ten-point contract satisfied.

---

## PHASE 02 — Reference UI Audit + Design System

**Goal** — Rivya gains one visual language expressed as code before a single page is designed, so
that every later page phase composes existing primitives instead of inventing new ones. After this
phase, a colour, a spacing step, a type size, a radius, a shadow, an easing curve and a breakpoint
each exist in exactly one place; every externally-sourced component has a licence-checked registry
entry; and a reviewer can see the whole system on one dev-only page at eight viewport widths.

**Depends on** — Phases 00, 01.

**Scope**

- Audit the eleven approved research sources from requirement §7 and record the outcome, including
  rejections:

  `threeui.com/browse` · `smoothui.dev` · `magicui.design` · `ui.unlumen.com` · `21st.dev` ·
  `reactbits.dev` · `animmasterlib.dev` · `skiper-ui.com` · `vengenceui.com` · `daisyui.com` ·
  `originkit.dev`

- Build the token layer as CSS custom properties, bridged into Tailwind. Tokens are authored in
  `app/styles/tokens.css`; Tailwind consumes them. Target Tailwind 4.x with a CSS-first `@theme`
  block; if the build must remain on 3.4.x, the same variables are referenced from
  `tailwind.config.ts` `theme.extend` — the token file itself is identical either way.
- Derive the palette from evidence already in the repository rather than inventing a brand palette.
  The Higgsfield prompt corpus in `data/higgsfield/asset-manifest.json` fixes a consistent quartet
  across 114 assets and a secondary set across 61:

  | Token | Hex | Evidence |
  |---|---|---|
  | `--rv-color-obsidian` | `#080A0E` | 114 manifest prompts |
  | `--rv-color-ocean` | `#08283A` | 114 manifest prompts |
  | `--rv-color-sapphire` | `#164E6B` | 114 manifest prompts |
  | `--rv-color-champagne` | `#B89B63` | 114 manifest prompts |
  | `--rv-color-sapphire-bright` | `#0F52BA` | 61 manifest prompts |
  | `--rv-color-slate-deep` | `#0E3A53` | 61 manifest prompts |
  | `--rv-color-gold-bright` | `#D4AF37` | 70 manifest prompts |
  | `--rv-color-bone` | `#FAF9F5` | 2 manifest prompts; used as the light ground |

  Neutrals are generated as a ten-step ramp between `--rv-color-obsidian` and `--rv-color-bone`.
- Define the remaining token groups: typography (display / body / technical families and a modular
  scale), surface, ink, line, radius, shadow, spacing (4px base, steps 0–20), container widths, the
  §45 breakpoint set, motion durations and easings, and z-index layers.
- Build `components/primitives/**` **before** any page work: `Button`, `IconButton`, `TextLink`,
  `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Label`, `HelpText`,
  `ErrorText`, `Surface`, `Container`, `Section`, `Stack`, `Cluster`, `Grid`, `Heading`, `Text`,
  `Eyebrow`, `Divider`, `Badge`, `Tag`, `Spinner`, `Skeleton`, `VisuallyHidden`, `AspectBox`,
  `MediaFrame`, `FocusTrap`, `Breadcrumbs`.
- Build the seven behavioural patterns everything else composes from: `Dialog`, `Drawer`, `Tabs`,
  `Accordion`, `Tooltip`, `Disclosure`, `DropdownMenu` — all keyboard-complete and focus-managed.

  `Breadcrumbs` and `DropdownMenu` are pulled forward from the page phases on purpose. Phase 05's
  Studio shell needs a breadcrumb trail (`StudioPage`) and a user menu in the top bar, and Phase 05
  runs before Phase 10 builds the public chrome — so leaving either to Phase 10 means the Studio
  invents its own, which is exactly the divergence requirement §6 forbids. Both need a
  `COMPONENT_REGISTRY.md` row added in this phase (the primitive block ends at `RC-031` and the
  public-pattern block at `RC-229` today; the registry assigns the actual IDs).
- Establish the dev-only system gallery and the Playwright visual snapshot harness.
- Write `docs/design/DESIGN_SYSTEM.md` and open `docs/design/COMPONENT_REGISTRY.md` for rows.

**Out of scope**

- Every element requirement §6 names that is **not** in the build list above. None is left
  unassigned: each is deferred to one named phase, built there against these tokens, and registered
  in `COMPONENT_REGISTRY.md` in *this* phase as `PLANNED` with that phase.

  | §6 element | Component | Owning phase |
  |---|---|---|
  | navigation, mega menu | `SiteHeader` · `MegaMenu` · `MobileNav` · `SiteFooter` | 10 |
  | cards — product | `ProductCard` | 14 |
  | cards — collection | `CollectionCard` | 16 |
  | cards — portfolio | `PortfolioCard` | 17 |
  | cards — journal | `JournalCard` | 18 |
  | gallery, lightbox | `ProductGallery` + `Lightbox` | 15 |
  | slider, carousel | `ContentCarousel` | 16 |
  | filters (public) | `FilterBar` — URL-only, no client state | 14 |
  | filters (Studio) | `FilterBar` (Studio variant) | 05 |
  | search | `SearchCombobox` | 23 |
  | command palette | `CommandPalette` | 05 |
  | tables, data grids | `DataTable` | 05 |
  | KPI cards | `StatCard` | 05 |
  | charts | `charts/{BarSeries,BandStrip,Scatter,Sparkline}` | 31 |
  | 3D viewer UI | `ModelViewer` · `ViewerControls` | 21 |
  | Studio primitives | `components/studio/**` | 05 |

  §6's "slider" is the scroll-snap content strip specified in `DESIGN_SYSTEM.md` §10.4, not a range
  input: the Phase 14 catalogue filters are enumerated URL parameters with no numeric range control,
  so no range primitive is owed by any phase. §6's remaining elements — typography, colour, surface,
  border, radius, shadow, spacing, grid, container widths, breakpoints, buttons, links, inputs,
  selects, text areas, checkboxes, radios, switches, dropdowns, breadcrumbs, modal, drawer, tabs,
  accordion, tooltip, motion, transitions, reveal and scroll effects — are all built here.
- Any *product* page under `app/(site)` or `app/(studio)`, and any CMS block renderer. The dev-only
  design-system gallery is the single route this phase adds, and it does not exist in a production
  build.
- The 3D viewer UI (Phase 21) — only its token surface (`--rv-3d-*` overlay layer) is reserved.
- Copy. Primitives take content as props; no primitive contains a literal headline (D2 rule).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Token source | `app/styles/tokens.css` | every `--rv-*` custom property; the only place a hex literal is allowed. `app/styles/` is not in the D2 tree — amendment **A2·a** (see the preamble) adds it and must be merged before this phase starts |
| Base layer | `app/styles/base.css` | resets, focus-visible ring, `prefers-reduced-motion` defaults |
| Global entry | `app/globals.css` | imports tokens + base; Tailwind `@theme` bridge |
| Tailwind bridge | `app/globals.css` (v4) or `tailwind.config.ts` (v3.4) | maps `--rv-*` to utility names; no duplicated values |
| Primitives | `components/primitives/<Name>/{index.tsx,<Name>.test.tsx}` | one directory per primitive |
| Behavioural patterns | `components/patterns/<Name>/index.tsx` | Dialog, Drawer, Tabs, Accordion, Tooltip, Disclosure, DropdownMenu |
| Motion helpers | `components/primitives/motion/{Reveal.tsx,useReducedMotion.ts}` | reduced-motion returns a static render, not a shortened animation |
| Root layout | `app/layout.tsx` | minimal `<html>`/`<body>` importing `app/globals.css`. Next.js renders no route without a root layout, and the gallery below is a route; Phase 10 adds `app/(site)/layout.tsx` chrome around it rather than replacing this file |
| Dev gallery | `app/(site)/design-system/page.tsx`, `app/(site)/design-system/[group]/page.tsx` | Served at `/design-system` and `/design-system/patterns`. **The segment must not begin with an underscore**: a `_`-prefixed directory is a Next.js *private folder* and is opted out of routing entirely, so `_design` would produce no route and nothing could be opened, tabbed through or axe-scanned. The 404 comes from an explicit `if (process.env.NODE_ENV === 'production') notFound()` as the first statement of both page components — a deliberate guard, not a side effect of the folder name |
| Design system doc | `docs/design/DESIGN_SYSTEM.md` | token tables, usage rules, do/don't |
| Component registry | `docs/design/COMPONENT_REGISTRY.md` | one row per externally-sourced component |
| Registry schema check | `scripts/design/check-registry.mjs` | fails if a registry row misses a required column |
| Token discipline check | `scripts/design/check-tokens.mjs` | fails on a hex literal or raw `px` spacing outside `app/styles/**` |
| Visual snapshots | `tests/e2e/design-system.spec.ts` | eight widths from §45 |

**COMPONENT_REGISTRY.md column contract** — the ten columns required by requirement §7 plus four
governance columns. A row missing any column fails `check-registry.mjs`.

| Column | Content |
|---|---|
| Registry ID | `RC-###`, stable, never reused |
| Source | Site name from the §7 list |
| Link | Direct URL to the component |
| Licence | SPDX identifier; only `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` or written permission are accepted — anything else is `REJECTED` with a reason |
| Dependencies | npm packages the adaptation adds; `none` is the preferred answer |
| Page | Where it is used, or `system` |
| Purpose | Which of the §5 justifications it serves |
| Adaptation | What was changed to fit Rivya tokens; verbatim copies are not accepted |
| Mobile behaviour | What happens at 360px |
| Performance | Bundle delta in kB and whether it is client-only |
| Accessibility | Keyboard model, ARIA roles, reduced-motion behaviour |
| Reviewed on / Reviewer / Verdict | Date, reviewer, `ADOPTED` \| `ADAPTED` \| `REJECTED` |

**Database** — None.

**Studio surface** — None. Studio primitives are the same `components/primitives/**`; the Studio
shell that consumes them is Phase 05.

**Public surface** — None. `/design-system` is a development-only route: both page components call
`notFound()` as their first statement when `process.env.NODE_ENV === 'production'`, so the route does
not resolve in a production build. It is additionally `noindex, nofollow`, excluded from the sitemap
and disallowed in `robots.txt`. Because it cannot be reached in production it adds nothing to the D3
public route map and needs no amendment — unlike `app/styles/` and `/studio/login`, which do (see the
preamble, **A2**). It lives under `app/(site)/` deliberately: that directory is already in the D2
tree, whereas a fourth route group would not be.

**Media** — None consumed into any surface. The `material-macro` family (39 assets) and
`process-studio` family (19 assets) are read as visual reference for deriving colour, contrast and
texture tokens, but no manifest asset is embedded in a component: production delivery is Cloudinary
and does not exist until Phase 06.

**Risks**

| Risk | Mitigation |
|---|---|
| Pages get built before primitives and diverge | `check-tokens.mjs` blocks hex/px outside the token file; Phase 10 cannot begin until this phase's exit criteria are ticked |
| An attractive external component carries an incompatible licence | Licence column is a hard gate; `REJECTED` rows stay in the registry so the same component is not re-proposed |
| Motion-heavy references hurt INP and Core Web Vitals | Every adopted animated component records a bundle delta; anything client-only above 15 kB gzipped needs a named justification in its registry row |
| Token sprawl — three greys that mean the same thing | The neutral ramp is generated, not hand-picked; adding a base colour requires a DESIGN_SYSTEM.md entry and reviewer sign-off |
| Reduced-motion treated as "faster animation" | `useReducedMotion` returns a boolean that selects a *static* branch; a Playwright test asserts no transform is applied under `prefers-reduced-motion: reduce` |

**Verification**

1. `npm run dev`, open `/design-system` — every primitive renders with its states (default, hover,
   focus, disabled, error, loading).
2. `npx playwright test tests/e2e/design-system.spec.ts` — snapshots pass at 1920, 1440, 1280, 1024,
   768, 430, 390, 360.
3. `node scripts/design/check-tokens.mjs` — exits 0; introduce `#fff` into any primitive and confirm
   it exits non-zero.
4. `node scripts/design/check-registry.mjs` — exits 0; delete a Licence cell and confirm failure.
5. Tab through `/design-system/patterns` with a keyboard only: Dialog traps focus and restores it on
   close, Tabs follow the roving-tabindex pattern, Accordion headers are buttons, `DropdownMenu`
   opens on `Enter`/`Space`/`↓` and closes on `Escape` restoring focus to its trigger, and Escape
   closes Dialog and Drawer.
6. `NODE_ENV=production npm run build && npm start`, request `/design-system` — 404. Confirm the
   same URL returns 200 under `npm run dev`, so the 404 is proved to come from the `notFound()`
   guard and not from the route being absent everywhere.
7. Run axe against `/design-system` at 390px — zero critical or serious violations.

**Exit criteria**

- [ ] `app/styles/tokens.css` is the only file in `components/**` or `app/**` containing a hex colour.
- [ ] All eleven §7 sources have an audit outcome recorded in `COMPONENT_REGISTRY.md` (adopted,
      adapted, or rejected with a reason).
- [ ] Every externally-derived component has a complete fourteen-column registry row.
- [ ] All listed primitives and the seven behavioural patterns exist with unit tests.
- [ ] Every element named in requirement §6 appears either in this phase's build list or in
      `COMPONENT_REGISTRY.md` as `PLANNED` against the owning phase in the deferral table above —
      none is unassigned.
- [ ] Visual snapshots exist and pass at all eight §45 widths.
- [ ] `docs/design/DESIGN_SYSTEM.md` is `status: CURRENT` and documents every token group.
- [ ] `/design-system` returns 200 under `npm run dev` and 404 in a production build, and the 404
      comes from the `notFound()` guard.
- [ ] Amendment **A2·a** (`app/styles/` in D2) is merged into `CANONICAL-DECISIONS.md`.
- [ ] Zero critical/serious axe violations on the gallery; keyboard model verified by hand.
- [ ] D9 ten-point contract satisfied.

---

## PHASE 03 — Supabase Database + Data Layer

**Goal** — The catalogue spine exists in PostgreSQL, generated TypeScript types make it impossible
to query a column that is not there, and every read or write in the application goes through one
repository layer instead of scattered client calls. This phase also settles the rule that governs
the rest of the build: migrations carry structure, seeds carry content, and seeding is idempotent
and never overwrites an owner's edit.

**Depends on** — Phases 00, 01.

**Scope**

- Local Supabase development via the Supabase CLI (`supabase/config.toml`, `supabase db reset`),
  with numbered forward-only migrations in `supabase/migrations`.
- Schema foundation: extensions, the D5 enum catalogue, shared trigger functions, and the columns
  every content-bearing table carries (`status`, `created_at`, `updated_at`, `updated_by`).
- Core domain tables: taxonomy (`categories`, `collections`, `materials`), catalogue (`products`,
  the product join tables, `product_relations`) and a minimal `media_assets` registry.
- Generated types and a CI drift check so the checked-in types cannot lag the migrations.
- The repository/query layer under `lib/supabase/repositories/**`, with Zod schemas at the boundary.
- The seed runner, its bookkeeping tables, the content hash mechanism, and `--dry-run` reporting.
- Taxonomy-only seed data as the runner's first real consumer (category slugs, names and order — no
  marketing copy, no products).

**Out of scope**

- RLS policies, roles, auth helpers and audit logging — Phase 04. Tables are created here with
  `alter table ... enable row level security` and **no** permissive policy, so nothing is reachable
  from an anon or authenticated key until Phase 04 grants it deliberately.
- Cloudinary delivery columns, derivatives and the migration of the 250 manifest assets — Phase 06
  extends `media_assets`.
- CMS page/block tables (`pages`, `page_sections`, block schemas) — Phase 08.
- All website copy — Phase 09 supplies the seed modules; this phase supplies the machine that runs
  them.
- Inquiry, research (`research_*`), analytics and flag tables — their own phases.
- The product-relations *engine* (rules, recommendations, search) — Phase 23 builds on the table
  created here.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Supabase config | `supabase/config.toml` | local ports, seed disabled (seeding is a script, not a DB seed file) |
| Extensions | `supabase/migrations/0001_extensions.sql` | `pgcrypto`, `citext`, `pg_trgm`, `unaccent` |
| Enums | `supabase/migrations/0002_enums.sql` | `content_status`, `owner_verification`, `fact_classification`, `media_kind`, `price_state`, `collection_concept_state` |
| Shared functions | `supabase/migrations/0003_shared_functions.sql` | `set_updated_at()` trigger, `rivya_slugify(text)` |
| Taxonomy | `supabase/migrations/0004_taxonomy.sql` | `categories`, `collections`, `materials` |
| Media registry | `supabase/migrations/0005_media_registry.sql` | `media_assets` (Phase 06 extends) |
| Catalogue | `supabase/migrations/0006_catalog.sql` | `products`, `product_collections`, `product_materials`, `product_media`, `product_relations` |
| Seed bookkeeping | `supabase/migrations/0007_seed_bookkeeping.sql` | `content_seed_runs` + seed columns |
| Indexes | `supabase/migrations/0008_indexes.sql` | slug uniques, FK indexes, `pg_trgm` on title/slug |
| Generated types | `lib/supabase/database.types.ts` | generated only; hand edits rejected in review |
| Server client | `lib/supabase/server.ts` | cookie-bound, RSC-safe, anon key |
| Browser client | `lib/supabase/browser.ts` | anon key only |
| Admin client | `lib/supabase/admin.ts` | service-role; first line `import 'server-only'` |
| Row schemas | `lib/supabase/schemas/*.ts` | Zod per entity, derived from generated types |
| Repositories | `lib/supabase/repositories/{categories,collections,materials,products,media,relations}.ts` | the only files permitted to call `.from(...)` |
| Errors | `lib/supabase/errors.ts` | `NotFoundError`, `ConflictError`, `ValidationError`, `PermissionError` |
| Seed runner | `scripts/seed/seed-content.ts` | `--dry-run`, `--only=<module>`, `--version=rivya-v1` |
| Seed registry | `content/seed/index.ts` | module list; Phase 09 adds modules, never edits the runner |
| Taxonomy seed | `content/seed/taxonomy.ts` | seven D3 categories, slugs + names + order only |
| Layering check | `scripts/db/check-data-layer.mjs` | fails if `.from(` appears outside `lib/supabase/repositories/**` |
| Types drift check | CI job in `.github/workflows/ci.yml` | regenerate types on a fresh DB, `git diff --exit-code` |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `categories` | `id`, `slug citext unique`, `parent_id`, `name`, `subtitle`, `description`, `sort_order`, `is_primary`, `hero_media_id`, `seo_title`, `seo_description` | seven primary rows in D3 priority order: `furniture · collectible-design · 3d-resin · wall-statement-art · preservation · decor · gifts` |
| `collections` | `id`, `slug citext unique`, `name`, `statement`, `concept_state collection_concept_state`, `hero_media_id`, `sort_order` | seeded concepts land as `DRAFT_COLLECTION_CONCEPT` per requirement §9 and are never published without owner confirmation |
| `materials` | `id`, `slug citext unique`, `name`, `family text check (family in ('resin','timber','metal','stone','finish'))`, `description` | descriptions are `EDITORIAL_COPY`; no durability or certification claims (D10) |
| `media_assets` | `id`, `rivya_asset_id citext unique`, `kind media_kind`, `provider text default 'cloudinary'`, `provider_public_id`, `storage_folder`, `filename`, `width`, `height`, `duration_s`, `aspect_ratio`, `alt_text not null`, `is_ai_generated bool not null`, `is_concept bool not null`, `source text`, `higgsfield_generation_id` | D6: `alt_text`, `is_ai_generated`, `is_concept` are mandatory on every row |
| `products` | `id`, `slug citext unique`, `sku citext unique`, `title`, `subtitle`, `summary`, `description`, `category_id`, `price_state price_state`, `price_from_minor bigint`, `currency char(3)`, `is_large_format bool`, `dimensions jsonb`, `hero_media_id`, `model_media_id`, `seo_title`, `seo_description`, `publication_readiness jsonb` | zero rows seeded — requirement §32 forbids fabricated inventory |
| `product_collections` | `(product_id, collection_id)` composite PK, `sort_order` | |
| `product_materials` | `(product_id, material_id)` composite PK, `note` | |
| `product_media` | `(product_id, media_asset_id)` composite PK, `role text`, `sort_order` | roles: `hero`, `gallery`, `detail`, `lifestyle`, `video`, `model` |
| `product_relations` | `id`, `source_product_id`, `target_type text`, `target_id uuid`, `relation_type text`, `sort_order`, `created_by` | generic edge for §10/§11; Phase 23 builds the engine, never auto-creates edges without a stated rule |
| `content_seed_runs` | `id`, `seed_version`, `started_at`, `finished_at`, `actor`, `inserted_count`, `updated_count`, `skipped_owner_edited_count`, `failed_count`, `report jsonb` | one row per `npm run seed:content` invocation |

Every content-bearing table above also carries the D5 common set — `status content_status not null
default 'DRAFT'`, `owner_verification owner_verification not null default 'NOT_REQUIRED'`,
`fact_classification fact_classification`, `created_at`, `updated_at`, `updated_by`, `published_at`,
`published_by` — plus the four seed columns: `seed_key text unique`, `seed_version text`,
`seed_content_hash text`, `seed_last_applied_at timestamptz`.

Two constraints matter enough to name:

```sql
-- a quote-only product must never be represented as zero (requirement §21)
alter table products add constraint products_price_state_coherent check (
  (price_state = 'STARTING_FROM' and price_from_minor is not null and price_from_minor > 0
                                 and currency is not null)
  or (price_state in ('REQUEST_QUOTE','PRICE_ON_REQUEST')
      and price_from_minor is null and currency is null)
);

-- public reads only ever see published rows (D5); enforced again by RLS in Phase 04
create index products_published_idx on products (status) where status = 'PUBLISHED';
```

**`FIXED` is deliberately absent from `price_state` here, and that is not an oversight.** Requirement
§23 FAQ 09 and §30 both promise a fixed-price presentation ("Products may display a fixed price, a
starting price or a request-for-quote state"; the label set includes a plain `Price`), so a firm
price must eventually be representable. It is not representable in Phase 03 — and does not need to
be, because `products` ships with **zero rows**, there is no owner entry surface until Phase 14, and
`DATA_MODEL.md` places the fixed-price columns in Phase 14 (migrations `0120`–`0122`) alongside
`availability_state` and `edition_state`. Deferring keeps one migration responsible for the whole
price model instead of splitting it across eleven phases.

| Concern | Phase 03 (here) | Phase 14 |
|---|---|---|
| `price_state` values | `STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST` | `+ FIXED` |
| Amount columns | `price_from_minor bigint` | `+ price_minor bigint` |
| `products_price_state_coherent` | the two branches above | dropped and recreated with three |

The Phase 14 form the constraint above must become — recorded here so the target is unambiguous and
so the existing branches are known to need tightening (`price_minor is null`) rather than merely
extending:

```sql
-- Phase 14, migration 0122 — replaces the Phase 03 constraint
alter table products drop constraint products_price_state_coherent;
alter table products add constraint products_price_state_coherent check (
     (price_state = 'FIXED'         and price_minor      is not null and price_minor      > 0
                                    and currency is not null and price_from_minor is null)
  or (price_state = 'STARTING_FROM' and price_from_minor is not null and price_from_minor > 0
                                    and currency is not null and price_minor      is null)
  or (price_state in ('REQUEST_QUOTE','PRICE_ON_REQUEST')
                                    and price_minor is null and price_from_minor is null
                                    and currency is null)
);
```

**Idempotent seeding rule (`content_seed_version = "rivya-v1"`)**

1. Each seed module exports records keyed by a stable `seed_key` (for example
   `category:furniture`, `home:section-01-hero`).
2. The runner computes `sha256` over the seedable field values it is about to write.
3. Row absent → insert, set `seed_version = 'rivya-v1'`, store the hash, count as `inserted`.
4. Row present and `sha256(current row's seedable fields) === seed_content_hash` → the row is
   untouched since the last seed; update it and store the new hash, count as `updated`.
5. Row present and hashes differ → **an owner edited it. Skip.** Count as `skipped_owner_edited`
   and list the `seed_key` in the run report.
6. `--dry-run` performs steps 2–5 and writes the report without any mutation.
7. The runner never deletes a row and never changes `status` on an existing row.

**Studio surface** — None. Studio pages that read these tables begin in Phase 05.

**Public surface** — None.

**Media** — None. `media_assets` is created empty; the 250 manifest assets are imported in Phase 06
after Cloudinary migration, carrying `is_ai_generated = true`, `is_concept = true` and
`owner_verification = OWNER_VERIFICATION_REQUIRED` exactly as the manifest records them.

**Risks**

| Risk | Mitigation |
|---|---|
| A migration is edited after it has been applied to a shared environment | Forward-only rule in `DATA_MODEL.md`; CI applies migrations to a fresh database and fails on checksum change |
| Generated types drift behind migrations | CI regenerates and `git diff --exit-code`s `lib/supabase/database.types.ts` |
| Queries spread into components and bypass validation | `check-data-layer.mjs` bans `.from(` outside repositories; ESLint `no-restricted-imports` bans importing `lib/supabase/admin` outside its allowlist |
| Seeding overwrites owner edits after launch | Hash comparison in the rule above; `skipped_owner_edited` rows are reported, never forced. A forced overwrite requires `--force --only=<module>` and is logged to `content_seed_runs` |
| Content rows sneak into migrations | Review rule and a CI grep: no `insert into` in `supabase/migrations/**` except enum/reference values |
| `dimensions jsonb` becomes a place to invent measurements | `products` ships with zero rows; the column is nullable and Phase 14 wires it to owner entry only |
| Seeded FAQ 09 promises a fixed-price state the schema cannot hold | The promise is published in Phase 09 while the catalogue is still empty, and Phase 14 adds `FIXED` + `price_minor` in the same phase that first lets an owner enter a product — so no published copy is ever false. Phase 14's exit criteria must carry the three-branch constraint; this phase records the deferral so it is not mistaken for a gap |

**Verification**

1. `supabase start && npm run db:reset` — all migrations apply to an empty database with no error.
2. `npm run db:types && git diff --exit-code lib/supabase/database.types.ts` — no diff.
3. `npm run seed:content -- --dry-run` on a fresh database — reports 7 inserts, 0 updates, 0 skips.
4. `npm run seed:content` then `npm run seed:content` again — the second run reports 0 inserts,
   7 updates, 0 skips, and `select count(*) from content_seed_runs` returns 2.
5. `update categories set name = 'Owner Edit' where slug = 'furniture';` then re-run
   `npm run seed:content` — reports 1 `skipped_owner_edited`, and
   `select name from categories where slug='furniture'` still returns `Owner Edit`.
6. `psql -c "insert into products (slug, sku, title, price_state, price_from_minor) values
   ('x','X','X','REQUEST_QUOTE',0);"` — rejected by `products_price_state_coherent`.
7. The price-state deferral is deliberate and visible:
   `psql -Atc "select string_agg(e.enumlabel, ' ' order by e.enumsortorder) from pg_enum e join
   pg_type t on t.oid = e.enumtypid where t.typname = 'price_state';"` returns exactly
   `STARTING_FROM REQUEST_QUOTE PRICE_ON_REQUEST`, and
   `psql -c "insert into products (slug, sku, title, price_state) values ('y','Y','Y','FIXED');"`
   fails with `invalid input value for enum price_state`. Both assertions are inverted in Phase 14,
   where `FIXED` with a positive `price_minor` and a currency must insert successfully and `FIXED`
   with `price_minor = 0` must be rejected.
8. `node scripts/db/check-data-layer.mjs` — exits 0; add `.from('products')` to any component and
   confirm it exits non-zero.
9. `vitest run tests/unit/repositories` — repository tests pass against the local database.

**Exit criteria**

- [ ] Migrations 0001–0008 apply cleanly to an empty database and are forward-only.
- [ ] Every table listed above exists with the D5 common columns and the four seed columns.
- [ ] RLS is enabled on every table in `public` with no permissive policy yet (proved by a query
      against `pg_tables.rowsecurity`).
- [ ] `lib/supabase/database.types.ts` is generated and drift-checked in CI.
- [ ] `lib/supabase/admin.ts` starts with `import 'server-only'` and is imported nowhere outside its
      allowlist.
- [ ] No `.from(` outside `lib/supabase/repositories/**`.
- [ ] `npm run seed:content` is proven idempotent and proven not to overwrite an owner edit.
- [ ] `supabase/migrations/**` contains no content-row inserts.
- [ ] `price_state` holds exactly its three Phase 03 values, and the `FIXED` / `price_minor`
      deferral is recorded here and in `DATA_MODEL.md` against Phase 14 — so a later reader finds a
      decision, not a gap.
- [ ] `docs/architecture/DATA_MODEL.md` documents every table, column, enum and constraint added.
- [ ] D9 ten-point contract satisfied.

---

## PHASE 04 — Supabase Auth + RBAC + RLS

**Goal** — `/studio` becomes genuinely private and genuinely differentiated: staff sign in through
Supabase Auth, each staff member holds exactly one of six roles, every Studio page and every server
mutation re-checks permission on the server rather than trusting navigation, PostgreSQL enforces the
same boundary through RLS so a leaked anon key still reads only published rows, and every privileged
mutation — including every denial — lands in an append-only audit log. No customer accounts are
created now or ever; this authentication system exists for staff only.

**Depends on** — Phases 00, 01, 03.

**Scope**

- Supabase Auth with email + password, **public sign-up disabled at the project level**. Staff are
  provisioned by an owner or admin from `/studio/system/users` using the service-role client to
  issue an invite; there is no self-registration path anywhere in the application.
- `staff_profiles` as the single source of a user's role and status, linked 1:1 to `auth.users`.
- The six D5 roles — `owner · admin · editor · merchandiser · researcher · viewer` — as a
  PostgreSQL enum plus a typed permission matrix in `lib/auth/permissions.ts`.
- SQL helper functions used by every RLS policy, so policies stay one line long and consistent.
- The three RLS policy shapes — content table, join table, staff-only table — applied to every table
  created in Phase 03, and made mandatory for every table created afterwards. A table matches one
  shape or carries a deviation documented in this phase and in `DATA_MODEL.md`.
- `lib/auth/table-permissions.ts`: the single declaration of which permission governs reads and
  writes on each table, so the policy role lists and the permission matrix cannot drift apart.
- Server-side permission re-checks: middleware redirects, but never authorises.
- `audit_logs`: append-only, insert on every privileged mutation and every denial.
- The Studio login, sign-out and session-expiry surfaces. `/studio/login` is not in the fixed D4 map
  — amendment **A2·b** (see the preamble) adds it and must be merged before this phase starts.

**Out of scope**

- The Studio shell, navigation and dashboard — Phase 05 consumes `lib/auth/nav-visibility.ts` from
  this phase but builds the chrome itself.
- Customer accounts, wishlists, order history, saved carts — permanently out of scope (D1,
  requirement §39).
- SSO, SAML, MFA hardware keys. Supabase Auth's built-in MFA is deliberately deferred; the decision
  and its trigger condition are recorded in `docs/ops/SECURITY.md`.
- Rate limiting beyond what Supabase Auth provides, and the full security review — Phase 41.
- Per-record ownership ("editor may only edit their own drafts"). Permissions are role-scoped, not
  record-scoped; if that changes it needs a CANONICAL-DECISIONS amendment.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Role enum + profiles | `supabase/migrations/0009_auth_roles.sql` | `user_role` enum, `staff_profiles`, provisioning trigger |
| Auth helpers | `supabase/migrations/0010_auth_functions.sql` | `current_staff_role()`, `is_staff()`, `has_role(variadic)` |
| RLS policies | `supabase/migrations/0011_rls_policies.sql` | Shape A on the five content tables, Shape B on the four join tables, Shape C plus the documented deviation on `content_seed_runs` |
| Audit log | `supabase/migrations/0012_audit_logs.sql` | append-only table, `revoke update, delete` |
| Permission matrix | `lib/auth/permissions.ts` | typed `Permission` union + `ROLE_PERMISSIONS` const |
| Table → permission map | `lib/auth/table-permissions.ts` | `TABLE_READ_PERMISSION` and `TABLE_WRITE_PERMISSION`, one entry per table in `public`, plus the declared-deviation list. Read by `gen-role-sql.ts` to emit policies and by `check-rls.ts` to verify them |
| Session access | `lib/auth/session.ts` | `getStaffSession()` — user, profile, role, or `null` |
| Guards | `lib/auth/require.ts` | `requirePermission()`, `withPermission()`, `requireRole()` |
| Nav visibility | `lib/auth/nav-visibility.ts` | maps a role to the D4 routes it may see; consumed by Phase 05 |
| Audit writer | `lib/auth/audit.ts` | `writeAudit()` + `withAudit()` server-action wrapper |
| Middleware | `middleware.ts` | matcher `/studio/:path*` minus `/studio/login`; redirect only |
| Login page | `app/(studio)/studio/login/page.tsx` | Unauthenticated route, added to the D4 map by amendment **A2·b**. Contains no copy literal — every string resolves through the module below |
| Studio copy constants | `components/studio/strings.ts` | The `studio.login.*` keys, typed, with the requirement §38 wording as their values. Phase 05 extends the same module for the rest of the Studio chrome; Phase 09 replaces every lookup with a `global_content` row in the `STUDIO_HELP` group, at which point the copy becomes Studio-editable |
| Sign-out handler | `app/api/auth/sign-out/route.ts` | POST only, clears session, writes audit row |
| Users page | `app/(studio)/studio/system/users/page.tsx` | list, invite, change role, suspend |
| Matrix generator | `scripts/auth/gen-role-sql.ts` | emits the role list consumed by `0010`; CI checks drift |
| RLS assertion script | `scripts/auth/check-rls.ts` | fails if any `public` table has `rowsecurity = false`, has zero policies, matches none of Shape A / Shape B / a declared deviation, is missing from `table-permissions.ts`, or carries a staff-select role list that differs from the roles holding its `*.read` permission |
| RLS tests | `tests/unit/rls/*.test.ts` | one authed client per role, asserting allow/deny per table |
| Studio access e2e | `tests/e2e/studio-access.spec.ts` | anonymous redirect, viewer read-only, editor write |
| Security doc | `docs/ops/SECURITY.md` | promoted from stub to `status: CURRENT` for the auth section |

**Permission matrix** — permissions are named `<domain>.<action>`. A role holds a permission only
where the table says yes. `owner` additionally holds `system.owner.transfer`, which no other role
can ever hold.

| Permission | owner | admin | editor | merchandiser | researcher | viewer |
|---|---|---|---|---|---|---|
| `catalog.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `catalog.write` | ✓ | ✓ | — | ✓ | — | — |
| `catalog.publish` | ✓ | ✓ | — | ✓ | — | — |
| `content.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `content.write` | ✓ | ✓ | ✓ | — | — | — |
| `content.publish` | ✓ | ✓ | ✓ | — | — | — |
| `media.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `media.write` | ✓ | ✓ | ✓ | ✓ | — | — |
| `media.delete` | ✓ | ✓ | — | — | — | — |
| `merchandising.write` | ✓ | ✓ | — | ✓ | — | — |
| `inquiries.read` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `inquiries.write` | ✓ | ✓ | — | ✓ | — | — |
| `inquiries.export` | ✓ | ✓ | — | ✓ | — | — |
| `research.read` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `research.write` | ✓ | ✓ | — | — | ✓ | — |
| `research.confirm` | ✓ | ✓ | — | ✓ | — | — |
| `analytics.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bulk.execute` | ✓ | ✓ | — | ✓ | — | — |
| `destructive.execute` | ✓ | ✓ | — | — | — | — |
| `operations.audit.read` | ✓ | ✓ | — | — | — | — |
| `operations.logs.read` | ✓ | ✓ | — | — | — | — |
| `system.settings.write` | ✓ | ✓ | — | — | — | — |
| `system.flags.write` | ✓ | ✓ | — | — | — | — |
| `system.users.manage` | ✓ | ✓ | — | — | — | — |
| `system.owner.transfer` | ✓ | — | — | — | — | — |

**What the research permissions mean**, because three of them look interchangeable and are not. The
split is the one requirement §25 implies and `PHASE-23-30.md` implements — it is recorded here so the
matrix can be checked against the requirement without reading the scraper phases:

| Permission | Covers | Roles | Source |
|---|---|---|---|
| `research.read` | Reading any `/studio/research/**` surface | owner · admin · merchandiser · researcher · viewer | FEAT §19 |
| `research.write` | Source, job and schedule configuration; queueing and cancelling runs; re-running normalization | owner · admin · researcher | FEAT §26/§27 |
| `research.confirm` | Every one of the nine FEAT §25 row actions — Review · Ignore · Shortlist · Reject · Mark Duplicate · Confirm · Add Note · Add Tag · Compare | owner · admin · merchandiser | FEAT §25 |

So the merchandiser holding `research.confirm` without `research.write` is deliberate and complete:
§25 names the merchandiser's nine actions and all nine sit under `research.confirm`, while
`research.write` is source *configuration*, which §26 gives to the researcher. The researcher's lack
of `research.confirm` is the counterpart — they gather, a merchandiser decides.

Two enforcement layers, deliberately: **RLS is the coarse net** (role-level, per table, in the
database, always on — it answers *may this role see this table at all*) and
**`requirePermission()` is the fine net** (permission-level, in the server, per action — it answers
*may this role take this action, on this row, now*). The role list is the shared surface between them
and is generated by `scripts/auth/gen-role-sql.ts` from `lib/auth/permissions.ts`, with a CI drift
check — so the two layers cannot disagree about which roles exist, and the per-table rule below stops
them disagreeing about which roles read what.

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `staff_profiles` | `user_id uuid pk references auth.users on delete cascade`, `email citext unique`, `display_name`, `role user_role not null default 'viewer'`, `status text check (status in ('INVITED','ACTIVE','SUSPENDED'))`, `last_seen_at`, `created_at`, `created_by`, `updated_at`, `updated_by` | a trigger on `auth.users` insert creates the profile as `INVITED` / `viewer`; elevation is an explicit, audited action |
| `audit_logs` | `id`, `occurred_at timestamptz default now()`, `actor_user_id`, `actor_role user_role`, `action text`, `entity_type text`, `entity_id uuid`, `summary text`, `before jsonb`, `after jsonb`, `result text check (result in ('SUCCESS','DENIED','ERROR'))`, `request_id`, `ip inet`, `user_agent text` | append-only: `revoke update, delete on audit_logs from authenticated, anon`; readable by `owner`/`admin` only |

New enum in `0009`: `user_role as enum ('owner','admin','editor','merchandiser','researcher','viewer')`.

**Naming note — the table is `audit_logs`, plural.** D5 fixes plural table names and every other
table in this document already obeys it (`staff_profiles`, `media_assets`, `content_seed_runs`,
`product_relations`); the singular `audit_log` was a lone divergence with no amendment behind it, so
it is corrected here rather than carved out. Fourteen documents written before this correction still
spell it `audit_log` on 81 lines — `docs/architecture/{ARCHITECTURE,DATA_MODEL,SCRAPER}.md`,
`docs/ops/{SECURITY,TESTING,DEPLOYMENT}.md`, `docs/studio/STUDIO_GUIDE.md`,
`docs/project/{PRD,BUSINESS_RULES}.md`, `docs/media/HIGGSFIELD_GUIDE.md` and
`docs/project/phases/{PHASE-10-15,PHASE-23-30,PHASE-31-38,PHASE-39-46}.md`. The rename lands across
all of them in the same PR as migration `0012`; the Phase 01 documentation-update contract already
requires `DATA_MODEL.md` and `SECURITY.md` to move with an RLS or migration change, and a merge that
leaves the two spellings in the tree is incomplete.

**RLS helper functions and policy pattern** — every helper is `security definer`, `stable`, with
`set search_path = public, pg_temp` to avoid recursion and search-path attacks:

```sql
create or replace function public.current_staff_role() returns user_role
  language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.staff_profiles
   where user_id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.has_role(variadic roles user_role[]) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_staff_role() = any(roles)
$$;
```

Three policy shapes cover every table in `public`. Every table must match one of them or carry a
deviation documented here and in `DATA_MODEL.md` — "four policies on everything" is not achievable,
because half the Phase 03 tables have no `status` column to test.

**Shape A — content tables.** `categories`, `collections`, `materials`, `products`, `media_assets`,
and every content-bearing table added later. Exactly four policies, named consistently:

```sql
-- 1. the public sees published rows only (D5)
create policy products_select_public on products for select
  to anon, authenticated using (status = 'PUBLISHED');

-- 2. staff select — the role list is this table's readers, not "anyone signed in"
create policy products_select_staff on products for select
  to authenticated using (
    public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- 3. writes are role-gated
create policy products_write_staff on products for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));
create policy products_update_staff on products for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

-- 4. deletion is owner/admin only
create policy products_delete_admin on products for delete
  to authenticated using (public.has_role('owner','admin'));
```

Policy 2's role list is load-bearing, not decoration: it is the set of roles holding this table's
`*.read` permission in the matrix above. For every Shape-A table that set happens to be all six —
`catalog.read`, `content.read` and `media.read` are held by everyone — which is why `DATA_MODEL.md`
records the RLS-PUBLIC staff select as the shorthand `using (public.current_staff_role() is not
null)`. The two spellings are equivalent **only** in the all-six case. Elsewhere the shorthand is a
hole, so `check-rls.ts` accepts it on a table whose read permission is held by all six roles and
requires the explicit list on every other table.

**Shape B — join tables.** `product_collections`, `product_materials`, `product_media`,
`product_relations`. These carry no `status` of their own: the D5 common set applies to
content-bearing tables, and a join row is not content. Shape A's policy 1 therefore cannot be applied
to them — `column "status" does not exist` and the migration will not run — and simply omitting it is
worse, because `anon` would lose `select` on `product_media` and a published product's gallery would
render empty in Phase 15. Visibility is derived from the parent instead:

```sql
-- 1. a join row is public exactly when the parent it hangs from is public
create policy product_media_select_public on product_media for select
  to anon, authenticated using (
    exists (select 1 from products p
             where p.id = product_media.product_id and p.status = 'PUBLISHED'));

-- 2, 3, 4 are Shape A's, unchanged: staff select by role list, writes role-gated
--          (catalog.write → owner, admin, merchandiser), delete owner/admin
```

| Join table | What the `exists` clause must require |
|---|---|
| `product_collections` | parent `products` row **and** parent `collections` row both `PUBLISHED` |
| `product_materials` | parent `products` row **and** parent `materials` row both `PUBLISHED` |
| `product_media` | parent `products` row `PUBLISHED` — the asset itself is filtered by `media_assets`' own Shape-A policy when the join is resolved, so an unpublished asset drops out of the gallery rather than leaking |
| `product_relations` | `source_product_id` `PUBLISHED` only |

`product_relations` is the one place the derivation cannot be completed in SQL: `target_type` +
`target_id` is a polymorphic edge and RLS cannot join a table chosen at runtime. That is safe rather
than leaky — the row exposes a type name and a uuid, and resolving that uuid goes through the target
table's own policies, which return nothing for an unpublished target. The Phase 23 repository
resolves targets one type at a time and silently drops the misses.

**Shape C — staff-only tables**, and the deviations this phase declares:

| Table | Policy 1 (`anon`) | Staff select | Writes |
|---|---|---|---|
| `staff_profiles` | none | self-select (`user_id = auth.uid()`) plus `has_role('owner','admin')` — non-recursive, so the helper's `security definer` cannot loop | `has_role('owner','admin')` |
| `audit_logs` | none | `has_role('owner','admin')` — matches `operations.audit.read` | `insert` only, and `revoke update, delete` |
| `content_seed_runs` | **none — documented deviation** | `has_role('owner','admin')` — matches `operations.logs.read` | no policy for `authenticated` at all; the seed runner writes through the service-role client, which bypasses RLS (`DATA_MODEL.md` classifies it RLS-SERVICE) |
| `research_*` (Phase 25+) | **none, ever** — scraped data is never publicly readable (requirement §19) | `has_role` over the `research.read` set | `research.write`, or `research.confirm` for disposition-bearing writes |
| `inquiries` (Phase 20) | `insert` only, with a `with check` pinning the row to a new, unassigned state — **never `select`** | `has_role` over the `inquiries.read` set | `has_role` over the `inquiries.write` set |

**The staff-select role set is derived, never hand-written.**

| Table family | Read permission | Staff-select roles |
|---|---|---|
| catalogue · content · media (Shapes A and B) | `catalog.read` · `content.read` · `media.read` | owner · admin · editor · merchandiser · researcher · viewer |
| `inquiries`, `inquiry_attachments` (Phase 20) | `inquiries.read` | owner · admin · editor · merchandiser · viewer |
| `research_*` (Phase 25 onward) | `research.read` | owner · admin · merchandiser · researcher · viewer |
| `audit_logs`, `content_seed_runs`, operations logs | `operations.audit.read` · `operations.logs.read` | owner · admin |

The rule, enforced rather than merely stated: **a table's staff-select role set must equal the set of
roles holding that table's `*.read` permission in `lib/auth/permissions.ts`.** The mapping is
declared once in `lib/auth/table-permissions.ts`; `scripts/auth/gen-role-sql.ts` emits the policy
role lists from it, and `scripts/auth/check-rls.ts` reads `pg_policies` back and fails when a
policy's role list differs from its permission's role set, when a table is absent from the mapping,
or when a table matches none of Shape A, Shape B or a declared deviation.

Without that rule the pattern is not merely loose, it is dangerous. `using (current_staff_role() is
not null)` copied onto `inquiries` in Phase 20 — which line one of this section makes mandatory for
"every table created afterwards" — would let a `researcher`, denied `inquiries.read` in the matrix
above, read every customer name, phone number and email address straight through PostgREST with their
own session, never touching `requirePermission()`. The same copy onto `audit_logs` would hand every
role the security log.

**Studio surface**

| Route | This phase |
|---|---|
| `/studio/login` | **Creates**, under amendment **A2·b** — D4's fixed map lists authenticated surfaces only, and middleware needs an unauthenticated redirect target inside the Studio group. Email + password, error states, "session expired" state. No copy literal in the JSX: strings resolve from `components/studio/strings.ts` (`studio.login.*`) |
| `/studio/system/users` | **Fills.** List staff, invite by email, change role, suspend/reactivate. Every action audited. The last `owner` cannot be demoted or suspended |
| every other `/studio/**` route | Gains a `requirePermission()` call at the top of its server component as those pages are created |

**Where the login copy lives, and why it is not in the CMS yet.** This phase depends on Phases 00,
01 and 03, and Phase 03 puts the CMS page/block tables and all website copy out of scope: `pages`,
`page_sections` and `global_content` do not exist until Phase 08, and no seed module writes copy
until Phase 09. There is therefore no Studio-editable home for this copy at Phase 04, and inventing a
`site_settings`-style key/value table here would contradict `DATA_MODEL.md`, which records
deliberately that no such table exists because `global_content` covers the need. So the login strings
take the route the rest of the Studio chrome takes one phase later (`PHASE-05-09.md`): typed
constants in `components/studio/strings.ts` now, replaced by `global_content` rows in the
`STUDIO_HELP` group in Phase 09, when the copy becomes editable from Studio. The requirement §38
wording is the constants' value from day one, so the words never change — only where they are read
from. The exit criteria below are worded against that path rather than against an editing surface
that does not exist until Phase 08.

**Public surface** — None. `app/api/auth/sign-out/route.ts` is a route handler, not a page, and is
POST-only with an origin check.

**Media** — None.

**Risks**

| Risk | Mitigation |
|---|---|
| Service-role key reaches the browser bundle | `lib/supabase/admin.ts` starts with `import 'server-only'`; a post-build script greps `.next/static/**` for the key name and any `service_role` JWT shape and fails the build |
| Middleware mistaken for authorisation | Middleware only redirects unauthenticated requests; `requirePermission()` in the page body is the authorisation. A lint rule fails any `page.tsx` under `app/(studio)/studio/**` that does not call `requirePermission` or `requireRole` |
| RLS infinite recursion via `staff_profiles` | Helpers are `security definer` with a pinned `search_path`; `staff_profiles` has its own non-recursive policies (self-select, owner/admin manage) |
| Permission matrix in code drifts from role checks in SQL | `scripts/auth/gen-role-sql.ts` generates the SQL role list; CI regenerates and diffs |
| A new table ships without RLS | `scripts/auth/check-rls.ts` runs in CI against the migrated database and fails on `rowsecurity = false` or zero policies |
| Audit log grows unbounded or leaks secrets | `before`/`after` pass through a redaction allowlist (never tokens, keys, passwords, full addresses); a documented retention job is scheduled in Phase 38 |
| Denials go unrecorded, hiding probing | `withPermission()` writes `result = 'DENIED'` before throwing |
| Public sign-up left enabled in a Supabase project | `docs/ops/DEPLOYMENT.md` checklist item; the Environment page (Phase 38) reports sign-up state as a boolean health signal |

**Verification**

1. `npm run db:reset` then `node scripts/auth/check-rls.ts` — exits 0; every `public` table has
   `rowsecurity = true` and at least one policy.
2. `vitest run tests/unit/rls` — for each of the six roles, a client authenticated as that role gets
   the allow/deny result the matrix predicts on `products`, `categories`, `media_assets`,
   `staff_profiles` and `audit_logs`.
3. Shape B behaves: insert one `PUBLISHED` and one `DRAFT` product, attach a media asset to each,
   then with the **anon** key `select * from product_media` returns exactly the published product's
   row. Repeat for `product_collections`, `product_materials` and `product_relations`. Confirm the
   migration itself applies — a Shape-A policy pasted onto any of the four fails with
   `column "status" does not exist`, which is why the shape exists.
4. The derivation is enforced, not documented. Edit `0011` so `inquiries`-style staff select reads
   `using (public.current_staff_role() is not null)` on a table whose read permission is not held by
   all six roles — for this phase, `audit_logs` — reapply, and confirm `check-rls.ts` exits non-zero
   naming the table and the two role sets. Revert.
5. With the **anon** key only: `select` on `products` returns rows where `status = 'PUBLISHED'` and
   nothing else; `insert` fails; `select` on `staff_profiles`, `content_seed_runs` and `audit_logs`
   returns zero rows.
6. `npx playwright test tests/e2e/studio-access.spec.ts` — anonymous `/studio/catalog/products`
   redirects to `/studio/login?next=...`; signing in as `viewer` shows the page with write controls
   absent and a direct POST to the update action returns 403; signing in as `merchandiser` succeeds.
7. `npm run build` then grep `.next/static` for `service_role` and `SUPABASE_SERVICE_ROLE_KEY` —
   zero hits.
8. Change a user's role in `/studio/system/users`, then
   `select action, entity_type, result from audit_logs order by occurred_at desc limit 1` — one
   `SUCCESS` row naming the action and the target. Attempt the same as `editor` — one `DENIED` row.
9. Attempt to demote the sole `owner` — rejected with a specific message, and a `DENIED` audit row.
10. `psql -c "update audit_logs set summary='x';"` as the authenticated role — permission denied.
11. `grep -rn 'audit_log\b' docs --include='*.md' | grep -v '^docs/requirements/'` returns nothing:
    the plural rename has propagated to every document that names the table.

**Exit criteria**

- [ ] Public sign-up is disabled; the only route to a staff account is an owner/admin invite.
- [ ] `staff_profiles` exists with exactly one role per user, drawn from the six D5 roles.
- [ ] The permission matrix above exists in `lib/auth/permissions.ts` and matches this document
      cell for cell.
- [ ] Every table in `public` has RLS enabled and matches the content-table pattern (Shape A), the
      join-table pattern (Shape B), or a deviation documented in this phase and in `DATA_MODEL.md`
      (`content_seed_runs`, `audit_logs`, `staff_profiles`, and `research_*` from Phase 25).
- [ ] Every table appears in `lib/auth/table-permissions.ts`, and every staff-select policy's role
      list equals the roles holding that table's `*.read` permission — proved by `check-rls.ts`, not
      by reading the migration.
- [ ] Every `/studio/**` page calls `requirePermission()` or `requireRole()` server-side; the lint
      rule enforcing this is active.
- [ ] Every privileged mutation is wrapped by `withAudit()`; denials are logged with
      `result = 'DENIED'`.
- [ ] `audit_logs` cannot be updated or deleted by any application role.
- [ ] The service-role key is absent from the client bundle, proved by the post-build grep.
- [ ] `login/page.tsx` contains no copy literal: every string resolves through
      `components/studio/strings.ts` under a `studio.login.*` key, carrying the requirement §38
      wording. The same keys become `global_content` `STUDIO_HELP` rows in Phase 09 — that is where
      "editable from Studio" is satisfied, and Phase 09's exit criteria must name these keys.
- [ ] Amendment **A2·b** (`/studio/login` in D4) is merged into `CANONICAL-DECISIONS.md`.
- [ ] Every document that names the audit table spells it `audit_logs`; `grep -rn 'audit_log\b'`
      over `docs/**` outside `docs/requirements/**` returns nothing.
- [ ] `docs/ops/SECURITY.md` documents the two enforcement layers, the matrix, and the audit schema;
      `docs/architecture/DATA_MODEL.md` documents `staff_profiles` and `audit_logs`.
- [ ] D9 ten-point contract satisfied.

---

## Cross-phase notes

**What must be true before Phase 05 begins.** Studio Foundation assumes: a passing `npm run check`
(00), an enforceable documentation contract (01), primitives and tokens to build the shell from
(02), typed repositories to read through (03), and `getStaffSession()` / `requirePermission()` /
`nav-visibility` to gate on (04). Starting Phase 05 before Phase 02's primitives exist produces a
Studio styled independently of the public site, which is precisely what requirement §6 forbids.

**Statements requiring owner verification before publication.** These phases create no public copy,
but three artefacts they produce carry claims that only the owner can confirm, and each is created
`OWNER_VERIFICATION_REQUIRED`:

| Artefact | Why it needs verification |
|---|---|
| The seven seeded category names and descriptions (Phase 03 taxonomy seed) | They assert what Rivya actually offers |
| All 250 Higgsfield rows when imported (Phase 06) | Every one is `is_concept = true`; none depicts delivered work |
| Studio login and helper copy (Phase 04, from requirement §38) | It names the business and its scope |
