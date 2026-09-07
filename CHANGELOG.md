# Changelog

All notable changes to Rivya Living Art. Newest first.
Every phase adds an entry; see `docs/architecture/CANONICAL-DECISIONS.md` D9 for what
"complete" means.

## [Unreleased]

### Phase 02 — Reference UI Audit + Design System — COMPLETE

**Added**

- **Toolchain.** Next.js 16 App Router, React 19, TypeScript strict with
  `noUncheckedIndexedAccess`, Tailwind 4 CSS-first, Vitest, Playwright, ESLint, Prettier, and
  `.github/workflows/ci.yml` running every gate as a separately visible step.
- **Token layer.** `app/styles/tokens.css` is the only file permitted a colour literal;
  `scheme.css` redeclares an identical 28-token semantic set for DEEP, INK and BONE, so a
  component reads `--rv-ink-secondary` and never asks which ground it is on; `globals.css`
  carries the Tailwind `@theme` bridge and no values of its own.
- **32 primitives**, **both motion helpers** and the **seven behavioural patterns**
  (Dialog, Drawer, Tooltip, Tabs, Accordion, Disclosure, DropdownMenu), each with
  behaviour-level tests. 282 unit tests across 41 files; 104 e2e tests across the eight QA
  widths; 16 visual baselines.
- **Dev-only gallery** at `/design-system`, plus an eight-width Playwright harness covering
  visual baselines, axe, keyboard reachability and the reduced-motion contract.
- **Five gates**, each proved to bite by provoking the failure it exists for:
  `check-tokens` (colour literals, arbitrary values, and a re-derivation of the neutral ramp
  from the OKLab rule), `check-utilities` (classes that compile to no CSS),
  `check-registry` (the two-tier registry contract and licence allowlist), plus the two
  media gates from amendment A1.
- **Licence audit of all eleven FEAT §7 sources**: 5 `NOT_ADOPTED`, 6 `REJECTED`, none
  adopted. Every licence read from a `LICENSE` file or npm metadata at a named ref, because
  none of the eleven sites was reachable from this environment.

**Verified rather than assumed**

- The palette quartet re-counted against the Higgsfield manifest (114 assets each).
- The ten-step neutral ramp reproduces exactly from DESIGN_SYSTEM §2.2's OKLab rule — all
  ten hexes and luminances to four decimal places.
- Champagne on bone measures 2.52:1 and fails AA at every size, which is why light grounds
  use champagne-deep at 5.05:1.
- `/design-system` returns 200 under `next dev` and 404 in a production build, and since the
  route is in the production manifest the 404 provably comes from the `notFound()` guard.

**Fixed**

- **Every button in the product rendered unstyled** — no padding, no accent fill on the
  primary CTA, no border on the secondary. `app/styles/base.css` was imported *unlayered*,
  and Tailwind 4 puts utilities in `@layer utilities`; an unlayered stylesheet beats a
  layered one regardless of source order, so `button { padding: 0; border: none;
  background: none }` overrode every padding, border and background utility on every button.
  Nothing caught it: the classes were present in source, they compiled to real CSS, axe was
  satisfied because text-on-ground contrast is fine without a fill, and **the sixteen visual
  baselines agreed with it, having been captured from the broken state.** Found only by
  chasing a 43px-wide button reported by a newly added touch-target test. Fixed by importing
  Tailwind first and pulling `base.css` into `layer(base)`; guarded by an e2e assertion that
  reads computed style, which is the only place a cascade loss is visible.
- **Nine components had no transitions.** `duration-[--rv-duration-fast]` is an arbitrary
  *value* in Tailwind 4 and compiles to `transition-duration: --rv-duration-fast`, invalid
  CSS the browser drops. The parenthesis form is the variable reference. `check-tokens` now
  rejects the bracket-variable pattern anywhere.
- **The QA matrix could not test touch.** The three "mobile" projects reported a fine
  pointer, so they were narrow desktops and the 44px touch-target rule in FEAT §48 was
  untestable at exactly the widths it exists for. `hasTouch` is now set on those projects and
  a touch-target test asserts the rule.
- **`Dialog` and `Drawer` did not restore focus to their trigger**, though both promise it in
  their registry contracts. `useModalSurface` applies `inert` in a layout effect; `FocusTrap`
  captured `document.activeElement` in a passive effect, which runs later — so it captured
  `<body>` after the browser had blurred the inert trigger, and correctly refused to restore
  to that. jsdom does not implement `inert`'s focus behaviour, so the unit test asserting
  restoration passed throughout; the Chromium test caught it.
- **`Switch` had no accessible name** — a critical axe violation. Its unit tests had hidden
  it by passing `aria-label` themselves, so the tests were compensating for the gap they
  existed to expose.
- **Polymorphic `ref` typing.** Four component groups independently hit the same error: a
  union of intrinsic elements does not unify its ref types. Fixed once in
  `lib/ui/polymorphic.ts` and documented as DESIGN_SYSTEM §6.3.
- **React Bits is not MIT** — its licence is "MIT + Commons Clause License Condition v1.0",
  read verbatim. Recorded as `REJECTED` rather than assumed.
- **Four false positives in the gates themselves**: unescaped variant selectors, bare
  utility roots matching prose, unstripped block comments, and CSS leading-digit escaping.
  A gate that cries wolf is worse than no gate.

**Known blocker**

GitHub Actions cannot provision a runner for this repository. Every run since the workflow
was added fails in 2-5 seconds with `runner_id: 0` and zero steps executed, including the
first — an account-level condition, not a defect in the diff. The full sequence passes
locally from a clean `npm ci`.

### Phase 01 — PRD, Architecture & Documentation — COMPLETE

**Added**
- `docs/architecture/CANONICAL-DECISIONS.md` — the binding contract fixing stack, repository
  layout, public and Studio route maps, database naming, media rules, documentation map,
  environment variable names, the phase completion contract and content-integrity rules.
- `docs/project/ROADMAP.md` and `docs/project/phases/` — the full 47-phase implementation
  approach, each phase with goal, dependencies, scope, deliverables, database and surface
  impact, media consumption, risks, verification and exit criteria.
- `docs/architecture/ARCHITECTURE.md`, `DATA_MODEL.md`, `SCRAPER.md`.
- `docs/design/DESIGN_SYSTEM.md`, `COMPONENT_REGISTRY.md`.
- `docs/studio/STUDIO_GUIDE.md`.
- `docs/media/` — Higgsfield master asset plan, asset status ledger, Higgsfield guide, media
  guide, Cloudinary taxonomy and migration runbook.
- `docs/content/INITIAL_CONTENT_INVENTORY.md`, `CONTENT_GUIDE.md`.
- `docs/project/PRD.md`, `BUSINESS_RULES.md`; `docs/ops/` deployment, environment, security,
  accessibility, performance and testing standards.
- Session-recovery set: `CLAUDE.md`, `CONTEXT.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`,
  this changelog.

### Fixed

- **Duplicate Rivya asset IDs.** `build-higgsfield-manifest.py` numbered images and videos with
  separate counters, so 26 image/video pairs sharing a subject family were minted the same
  `rivya_asset_id`. The ID is the authoritative key, so this was a collision rather than a
  cosmetic issue. The counter namespace is now shared and the generator asserts that both asset
  IDs and Cloudinary public IDs are unique before writing.
- **Colliding planned asset IDs.** Fixing the above exposed a second allocator: the media plan
  names assets that do not exist yet, and five of those IDs had borrowed a manifest family prefix
  — three colliding with real videos immediately, two the moment their family grew. Planned IDs
  now use the `<PAGE>-<SECTION>[-<KIND>]-<NNN>` form, which the family allocator cannot mint.
  Added `scripts/media/check-asset-ids.py` to enforce the separation; recorded the rule in
  CANONICAL-DECISIONS D6 with amendment A1.
- **`audit_log` vs `audit_logs`.** CANONICAL-DECISIONS D5 fixes plural table names, but fifteen
  documents spelled the audit table singular — 89 occurrences across the architecture, ops, Studio,
  product and phase documentation. Caught because a phase document, having corrected its own copy,
  recorded the other files it could not reach and added an exit criterion asserting that
  `grep -rn 'audit_log\b' docs` returns nothing. Renamed everywhere outside `docs/requirements/`
  (which holds the specifications verbatim and is never edited); that assertion now passes.
- **PHASE 09 missing exit criteria.** The phase document ended on open questions without its exit
  criteria section. Added, aligned to SEED §57's definition of done.

### Phase 07 — Higgsfield Asset Audit — PARTIAL (audit complete, migration outstanding)

**Added**
- `data/higgsfield/raw/{images,videos}.json` — the full generation history pulled from the
  Higgsfield workspace: 224 images, 26 videos, 163 distinct prompt families.
- `scripts/media/build-higgsfield-manifest.py` — deterministic, score-based multi-label
  classifier. Word-boundary keyword matching, negative-prompt stripping and stable tie-breaking,
  so the same history always produces the same manifest.
- `data/higgsfield/asset-manifest.json` — 250 assets, each with a Rivya asset ID, family, subject
  tags, target page and section, Cloudinary folder and public ID, aspect ratio, source URL,
  original prompt, draft alt text and AI-concept metadata.

**Note** — no asset was regenerated. The manifest exists so that later phases reuse what is
already there, per the asset-priority rule.

### Phase 00 — Repository Audit & Baseline — COMPLETE

**Added**
- `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` and
  `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` — the governing specifications, captured
  in the repository so later phases read from source of truth rather than conversation history.
- `.gitignore`.

**Audit finding** — the repository contained a single commit and a one-line README. Everything
is greenfield; no legacy code constrains the architecture.
