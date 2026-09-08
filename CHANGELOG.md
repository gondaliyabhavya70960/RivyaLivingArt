# Changelog

All notable changes to Rivya Living Art. Newest first.
Every phase adds an entry; see `docs/architecture/CANONICAL-DECISIONS.md` D9 for what
"complete" means.

## [Unreleased]

### Phase 05 — Studio Foundation — IN PROGRESS

The navigation spine, the shell, the primitives and the palette. Not complete: see *Not done* below.

**Added**

- **`lib/auth/studio-nav.ts` — the D4 route map, written down once.** 8 groups, 58 leaves, each with
  a label *key*, a read permission, a write permission where one applies, and the phases that build
  it. `nav-visibility.ts` derives from it; the 58 `page.tsx` files are generated from it.
  `tests/unit/studio-nav.test.ts` **parses** the D4 block out of `CANONICAL-DECISIONS.md` and
  requires manifest ↔ contract ↔ disk to agree, in both directions. A page on disk the manifest does
  not name fails — that one would be unreachable from the sidebar and governed by no permission.
- **The shell.** `app/(studio)/layout.tsx` (the bone ground, a Phase 04 carry-forward) and
  `app/(studio)/studio/(shell)/layout.tsx`. `(shell)` is a route group because `/studio/login` is a
  child of `/studio`: a layout at `studio/layout.tsx` would put a permission check in front of
  signing in, which is a redirect loop that reads as "my password is wrong".
- **`/studio` Overview** with D4's three tabs as query parameters rather than client state, so a tab
  can be linked, reloaded and reached with Back.
- **Migrations `0020` and `0021`** — `activity_events`, `studio_preferences`, and their generated
  policies. Policy migrations are now **one file per phase**: a single growing file would be
  rewritten by every later phase, which `db:migrate` refuses.
- **Fifteen Studio primitives**, each built around the distinction it exists to preserve. Documented
  in `STUDIO_GUIDE.md` §4.1.
- **The ⌘K palette**, its provider registry (20 results / 200 ms per provider, enforced by the
  registry) and `app/api/studio/search/route.ts`.
- **`no-unused-vars`.** Found three dead bindings, one of which documented a rejected approach next
  to the code that replaced it, then caught a fourth within the hour.

**Fixed**

- **`withPermission` wrote TWO audit rows per outcome**, and names the record now. Phase 04
  verification step 8 is worded against one row; it could not be run, and while it could not be run
  the wrapper was writing two of each.
- **`check-migrations` demanded dense numbering** and would have failed every phase from 05 onward.
  DATA_MODEL §12 allocates numbers in per-phase blocks. It now checks that a number is *allocated*.
- **`check-utilities` reported `content-type` as a dead utility.** Two candidate fixes were measured
  and rejected before the third shipped — the first would have gutted the gate.

**Corrected in the specification**

- **Phase 05 verification step 7 cannot pass as written.** It expects a permission error from
  `select count(*) from activity_events` as anon. RLS denial is zero rows, not an exception, and `0`
  on an empty table is the same `0` — so the step is satisfied identically by a locked table, an
  empty table, and a table with RLS off. Replaced by `tests/unit/rls/phase05.test.ts`, which seeds a
  row first so that zero means *refused*.

**Not done**

- `tests/e2e/studio-rbac.spec.ts` — the per-role route matrix. Needs real sessions, so it needs a
  reachable Supabase project, exactly as Phase 04 step 6 does.
- The top bar (user menu, role badge, environment badge) and a visible ⌘K affordance.
- `studio_preferences` has no reader or writer: the table and its self-scope are verified, but
  nothing collapses a sidebar or pins a route yet.
- Visual baselines for the shell. The unauthenticated Studio surfaces pass at all eight FEAT §45
  widths (104 assertions); the shell itself cannot be reached without a session.

### Phase 04 close-out — the proxy convention, and a runner that can touch a real database

**Changed**

- **`middleware.ts` is now `proxy.ts` (amendment A6).** Next 16 deprecated the `middleware` file
  convention. Taken now rather than carried, because Next no longer *reads* `middleware.ts` and
  does not warn about a file it never opens: restoring one from an older document or a stale branch
  would leave every Studio route reachable with no session, a green build, and nothing saying so.
  The export renames; the matcher, the behaviour and A2·b are unchanged. Next's build output now
  reports `Proxy (Middleware)` in its route table, which is what confirms the file is registered.
- Every document naming the file is corrected, **including the unbuilt Phase 41 plans** that put
  response headers and the `request_id` there. Leaving those would plant the trap rather than
  describe it. `docs/requirements/**` stays read-only history.

**Added**

- **`scripts/db/migrate.mjs` (`npm run db:migrate`) — forward-only, and safe to point at a real
  database.** `db:reset` drops schema `public`, so nothing in the repository could migrate the
  hosted project without destroying it. The new runner records a SHA-256 per migration and refuses
  two things outright: a migration **edited after it was applied** (the database holds the old
  definition while the repository shows the new one, and every run reports "0 pending"), and a
  version present in the database but absent from the repository. Each migration and its ledger row
  commit in **one transaction**, so a failure leaves neither.
  It deliberately does **not** apply `supabase/local/**` — that shim redefines `auth.uid()` and
  re-grants roles Supabase manages, which on a live project would replace real authentication with
  a local imitation.
- **`.github/workflows/db-migrate.yml`** applies it to hosted Supabase from a GitHub runner, which
  has the outbound network access this sandbox lacks. `workflow_dispatch` only — no push, PR or
  schedule trigger — so it spends Actions minutes only when someone runs it deliberately. Mode
  defaults to `plan`; `apply` additionally requires typing the project ref, compared against the ref
  parsed from the secret so a dispatch at the wrong project fails before any SQL runs.
- **`scripts/security/check-proxy.mjs` (`npm run security:check-proxy`)** refuses a
  `middleware.{ts,js}` anywhere Next would once have found one, an export still named `middleware`,
  and a missing `config`. All four refusals verified by breaking the file four ways.
- Two CI steps: the migration runner is exercised against its own throwaway database (plan changes
  nothing → apply → second run is a no-op → an edited migration is refused), and the proxy
  convention is checked.

**Fixed**

- **The open-redirect e2e assertion was wrong, not the guard.** It asserted `evil.example` was
  absent from the page; Next serialises the request URL into its RSC flight payload, so the string
  is present whatever the app does with it. That is the framework echoing the request, not the
  application trusting it. The test now asserts the hidden `next` field the form would submit, and
  a companion test proves a legitimate path passes through untouched — a guard that rejects
  everything looks identical to a working one if only hostile input is tested.
- `lib/supabase/server.ts` claimed "Phase 04 adds that middleware", which had been true and no
  longer was.

**Still blocked, and now blocked twice over**

- The hosted Supabase project has **still never been migrated**. This sandbox cannot reach it
  (the proxy answers 403 to CONNECT; 5432/6543 are blocked). The workflow above was built to do it
  from a runner instead — but **GitHub Actions has still never provisioned one**: 48 runs, each
  created with its `ubuntu-latest` label and dead 2–3 seconds later with no steps and no logs. Run
  #48 has the same signature as run #1, *after* a payment method was added, so the payment method
  alone did not resolve it.

### Phase 04 — Supabase Auth + RBAC + RLS — SUBSTANTIALLY COMPLETE

Eleven of fourteen exit criteria met, three partial. The gaps are named under *Not done* below
rather than glossed: two need a running app against real Supabase Auth, which this environment
cannot reach.

**Added**

- **Migrations `0009`–`0012`.** The six D5 roles as an enum, `staff_profiles`, three `security
  definer` helpers with pinned search paths, 51 RLS policies across 12 tables, and an append-only
  `audit_logs`.
- **RLS became testable here**, which Phase 03 concluded it would not be. Supabase's policies rest
  on ordinary Postgres roles plus `auth.uid()` reading a per-transaction setting; the local shim now
  reproduces the roles, **Supabase's grants**, and the claim readers, so a policy is exercised
  exactly as PostgREST would exercise it.
- **The permission matrix as the single source.** `lib/auth/permissions.ts` holds it,
  `lib/auth/table-permissions.ts` maps it onto tables, and migration `0011` is GENERATED from both.
  Two drift gates: `auth:check-policies` proves the migration matches the matrix, `auth:check-rls`
  proves the database does.
- **Studio auth surfaces**: a redirect-only `proxy.ts`, a login page with no copy literal in its
  JSX, a POST-only sign-out with an Origin check, and user management where every mutation is
  permission-wrapped and audited.
- **Four new gates**, each proved to bite: `auth:check-policies`, `auth:check-rls`,
  `security:check-bundle`, and an ESLint rule failing any Studio page that does not authorise in its
  own body.
- **143 new tests** (459 total, from 316 at the end of Phase 03): 62 RLS against the real database,
  36 open-redirect attacks, 25 matrix/nav/redaction, 7 refusal-predicate, plus repository coverage.

**Fixed — a Phase 03 blocker found while building this**

- **The migration set could not be applied to a hosted Supabase project at all.** Hosted projects
  keep `citext`/`unaccent`/`pg_trgm` in an `extensions` schema where `create extension if not
  exists` is a no-op, so `0003` failed at CREATE time with `text search dictionary "unaccent" does
  not exist`. Every local check passed throughout. `db:check-hosted-layout` is the standing gate.

**Fixed — three defects the full gate run exposed, each passing individually**

- **Seven queries sat outside the repository layer, two of them mine.** Fixed with real `staff` and
  `audit` repositories rather than by widening the allowlist.
- **The RLS suite had stopped running.** The fixture wipe tripped the last-owner trigger, so it
  passed once on a fresh database and then reported *62 skipped* — a security suite going quietly
  green. CI now sets `RLS_TESTS_REQUIRED=1`, which turns a missing database into a failure.
- **The last-owner refusal was detected by matching prose.** The trigger now raises with
  `constraint = 'staff_profiles_last_owner'`, and the predicate is extracted and tested.

**Decided — amendment A5, each taking the safer reading of a conflict**

- A join row is public only when **every** parent it names is published. The looser reading would
  have exposed an unannounced `DRAFT` collection's existence and id to anonymous visitors.
- Only the service role writes `audit_logs`. An `authenticated` insert policy lets any signed-in
  staff member forge entries implicating someone else.
- No policy may gate on `auth.role()` — it reads a channel the database does not verify.

Plus corrections **C11–C15** in DATA_MODEL §1.8, and `staff_profiles` self-update deferred to the
phase that builds a profile surface.

**Not done, and why**

- **The authenticated half of verification step 6.** The spec now exists and its unauthenticated
  half passes (13 tests); the four cases needing a real session are `test.fixme`, so they appear in
  every test report rather than only here. A forged cookie is refused by `getUser()` — that is the
  guard working, not an obstacle to route around.
- **The audit trail is not verified end to end** (step 8), blocked on the same thing.
- **A refusal writes two audit rows.** `withPermission()` logs ERROR alongside the explicit DENIED,
  and it takes no entity parameter so it cannot name the record. Step 8 expects one row naming the
  target. Carried into Phase 05.
- **Project-level sign-up disablement is unverified** — an owner-side dashboard setting.


### Phase 03 — Supabase Database + Data Layer — COMPLETE

**Added**

- **Migrations `0001`–`0008`**, applied to a real PostgreSQL 16.13 cluster and verified there,
  not merely written. Four extensions, six enums, two shared functions
  (`set_updated_at()`, `rivya_slugify(text)`), ten tables, 24 indexes. **RLS is enabled on every
  table with no permissive policy** — nothing is reachable from an anon or authenticated key
  until Phase 04 grants it deliberately.
- **The catalogue spine.** `categories`, `collections`, `materials`, a minimal `media_assets`,
  `products`, three join tables and `product_relations`, plus `content_seed_runs`. Every content
  table carries the three column tiers from DATA_MODEL §1.2, written out in full rather than
  applied by a shared helper — a helper would let a later edit retroactively change what an
  already-applied migration created.
- **Constraints that carry business rules**, each proved to reject what it exists for: a
  quote-only product cannot carry a price, a `STARTING_FROM` product cannot carry zero or a null
  currency, a blank `alt_text` is refused, a video without a duration is refused, and no content
  row can reach `PUBLISHED` while `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` — D10 as a
  schema rule rather than a review convention, on all five content tables.
- **Generated types and a drift gate.** `lib/supabase/database.types.ts` is produced by
  `scripts/db/gen-types.mjs`, which introspects `pg_catalog` directly; `npm run db:check-types`
  regenerates and diffs, so the types cannot lag the migrations. Determinism verified by
  generating twice and comparing bytes.
- **The repository layer.** `lib/supabase/{server,browser,admin}.ts`, Zod schemas tied to the
  generated types by a `satisfies` annotation, six repositories, and a four-class error
  vocabulary. Schemas validate on the way **out** of the database as well as in: a row that
  fails means the database holds something the model calls impossible, and passing it through
  would surface as a blank page instead of a named error.
- **The idempotent seed runner** and the taxonomy seed (the seven D3 categories: slug, name and
  order only — no marketing copy). `--dry-run`, `--only`, `--version`, and a `--force` that
  refuses to run without `--only` because it overwrites human edits.
- **Five new gates**, each proved to bite: `db:check-data-layer` (no `.from(` outside the
  repository layer), `db:check-migrations` (forward-only numbering, no content rows in
  migrations), `db:check-schema` (RLS, column tiers, enum values and D10 gates asserted against
  the live catalog), `db:check-types`, and an ESLint rule naming the small allowlist permitted to
  import the RLS-bypassing admin client.
- **35 new tests** (329 total, from 294), covering the seed content hash, the comment/string
  stripper the layering gate depends on, and the repository layer's query shapes, error mapping
  and schema validation.

**Decided**

- **Amendment A4·a — nothing may incur a charge without the owner's prior approval.** Recorded as
  a general rule after the owner stated it for GitHub Actions. The CI workflow follows it: the
  database gates run in the same job as everything else, because a second job would pay a second
  runner startup and a second `npm ci` for parallelism a three-minute run does not need.
- **Amendment A4·b — `newsletter_subscribers` does not land in Phase 03.** A3·b assigned it here;
  DATA_MODEL §1.7 forbids creating a production table before the feature that uses it, and Phase
  03's scope never included it. Corrected rather than built.
- **Amendment A4·c/d** — the type generator replaces the Docker-dependent Supabase CLI, and the
  seed runner connects over `DATABASE_URL` because it needs a transaction per module that
  PostgREST cannot give it.
- **Corrections C7–C10** in DATA_MODEL §1.8, covering `media_assets` column naming, the columns
  deferred to Phase 06, a `not null` the identity key requires, and the `product_media.role`
  vocabulary.

**Deferred, with the instruction written where the next phase will find it**

- `price_state` holds exactly its three Phase 03 values; `FIXED` and `price_minor` arrive together
  in Phase 14, which must **drop and recreate** the coherence constraint rather than extend it.
- `products_listing_idx` and `products_facets_idx` are created in their Phase 03 form and must
  likewise be dropped and recreated in Phase 14, once the columns they name exist.
- `media_assets.source`, the Higgsfield provenance columns and `tags`/`subject_tags` are Phase 06.
- `owner_edited` exists; its trigger is Phase 08. The seed runner does not depend on it.

**Known limitation**

- The local database has no PostgREST, so `@supabase/supabase-js` cannot be exercised against it.
  The schema, every constraint and the whole seeding contract are proved against a real
  PostgreSQL; the repository layer's query shapes and error mapping are proved with a fake client.
  RLS *behaviour* is proved by neither and becomes testable in Phase 04, when the first policy
  exists. The split is documented in `docs/ops/ENVIRONMENT.md`.


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
