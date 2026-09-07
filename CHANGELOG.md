# Changelog

All notable changes to Rivya Living Art. Newest first.
Every phase adds an entry; see `docs/architecture/CANONICAL-DECISIONS.md` D9 for what
"complete" means.

## [Unreleased]

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
