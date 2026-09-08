# SESSION-STATE

> Updated at the end of every phase, per requirement FEAT §40. Read this second, after
> `CLAUDE.md`, before doing anything. **Verify the claims below against the repository** —
> never assume a phase completed because this file says so.

---

## Current Phase

**Phase 05 — Studio Foundation. IN PROGRESS.** Phase 04 is closed out (PR #5, plus the close-out in
PR #7). Phase 03 merged as PR #4.

### Phase 05: what is built, and what is not

**Built and verified**

- **`lib/auth/studio-nav.ts` — the D4 map, once.** 8 groups, 58 leaves, each with a label *key*, a
  read permission, a write permission where one applies, and its owning phases. `nav-visibility.ts`
  now derives from it instead of holding a second copy, and the 58 `page.tsx` files are generated
  from it.
- **`tests/unit/studio-nav.test.ts`** asserts D4 ↔ manifest ↔ disk. D4 is *parsed* out of
  CANONICAL-DECISIONS rather than transcribed. Both failure directions were provoked and confirmed,
  including a page on disk the manifest does not name — an unreachable, ungoverned route.
- **The shell.** `app/(studio)/layout.tsx` (bone ground — the Phase 04 carry-forward) and
  `app/(studio)/studio/(shell)/layout.tsx`. `(shell)` is a route group so `/studio/login` stays
  outside the permission check; a layout at `studio/layout.tsx` would gate the sign-in page behind
  being signed in.
- **`/studio` Overview** with the three D4 tabs as query parameters, not client state. Activity
  reads real rows; Analytics says Phase 37 and shows no figure.
- **Migration `0020`** (`activity_events`, `studio_preferences`) and **`0021`**, generated.
- **`withPermission` writes exactly one audit row** and names the record — the Phase 04
  carry-forward, with nine tests and both regressions confirmed against the old behaviour.

- **All fifteen Studio primitives** in `components/studio/**`, each built around the distinction it
  exists to preserve rather than around rendering. Documented in `STUDIO_GUIDE.md` §4.1 with the
  reason each one is shaped the way it is. 20 tests.
- **The ⌘K command palette**, its provider registry (20 results / 200 ms per provider, enforced by
  the registry rather than trusted to providers), the route provider, and
  `app/api/studio/search/route.ts`. 13 tests, including that a provider is skipped *before* it runs
  when the role lacks its permission.
- **`loading.tsx` / `error.tsx` / `not-found.tsx`** for the Studio. The error boundary never renders
  `error.message` — only the digest.
- **`logActivity()` has three real callers**: all three user-management mutations.

**Not built yet, and Phase 05 is not complete without them**

1. **`tests/e2e/studio-rbac.spec.ts`** — the per-role route matrix. Blocked on the same thing as
   Phase 04 step 6: it needs real sessions, so it needs a reachable Supabase project.
2. **Visual baselines for the shell.** The unauthenticated Studio surfaces DO pass at all eight
   FEAT §45 widths — `studio-access.spec.ts` runs 104 assertions across them — but the shell itself
   cannot be reached without a session, so its baselines wait on Supabase too.
3. **The top bar.** The sidebar shows the role as text; the user menu, role badge and
   deployment-environment badge are not built, and the ⌘K trigger has no visible affordance.
4. **`studio_preferences` has no reader or writer.** The table, its RLS and its self-scope exist and
   are verified, but nothing collapses the sidebar or pins a route yet, so `pinned_routes` and
   `dashboard_card_order` are columns nothing fills.
5. **Verification step 6** (press ⌘K on a Studio page, type `journ`, assert Content → Journal is
   first and Enter navigates) needs a browser with a session. The logic beneath it is covered:
   `searchRoutes('journ', …)` is asserted to return the journal route first.
   **Step 7 is done** — and the step as written was wrong; see `PHASE-05-09.md`, which now records
   why, and `tests/unit/rls/phase05.test.ts`, which replaces it.
6. **`docs/architecture/DATA_MODEL.md`** still needs its Phase 05 pass (D9). `CHANGELOG.md` is
   done.

## Status

**SUBSTANTIALLY COMPLETE — 10 of the 11 verification steps pass against a real database.**
Everything verifiable in this environment has been verified, against a real PostgreSQL 16.13
cluster: 19 gates green, 459 unit/RLS tests (none skipped — `RLS_TESTS_REQUIRED=1`), e2e 13 passed
and 4 `fixme`.

### The 11 verification steps, as actually run

| # | Result | Note |
|---|--------|------|
| 1 | PASS | `db:reset` then `check-rls` exits 0; 12 tables, all `rowsecurity`, 51 policies |
| 2 | PASS | Six roles × five tables, allow/deny matches the matrix |
| 3 | PASS | Shape B verified on all four join tables; a Shape-A policy pasted on does fail with `column "status" does not exist` |
| 4 | PASS | The tampered `0011` was rejected by `check-rls` naming the table and both role sets; reverted |
| 5 | PASS | anon sees `PUBLISHED` only; insert refused; `staff_profiles` / `content_seed_runs` / `audit_logs` return zero rows |
| 6 | **PARTIAL** | The unauthenticated half passes (13 tests). The authenticated half is `test.fixme` — see below |
| 7 | PASS | Zero hits for `service_role` / `SUPABASE_SERVICE_ROLE_KEY` in `.next/static` |
| 8 | **BLOCKED** | Needs a real session in the Studio UI. See below |
| 9 | PASS | The sole owner cannot be demoted — the trigger raises with `constraint = staff_profiles_last_owner`, and `isLastOwnerRefusal()` is unit-tested against both error shapes |
| 10 | PASS | `update audit_logs` as `authenticated` is refused at the privilege level, not merely unpolicied |
| 11 | PASS | No stale `audit_logs` references outside `docs/requirements/` |

**Why 6 and 8 are not closed, precisely.** Both need a *real Supabase session*. A forged cookie is
refused by `getUser()` — which is the reason `getUser()` is used rather than `getSession()`, so this
is the guard working, not an obstacle to route around. No amount of local PostgreSQL substitutes for
the auth server. The four unproved cases are `test.fixme` in the spec rather than omitted, so they
appear in every test report instead of only in this file.

What those cases would prove IS proved one layer down: the six-role matrix is exercised by the RLS
suite against a real PostgreSQL. What is unproved is the seam between a browser session and that
layer — not the layer.

### Carried into Phase 05

**A refusal writes TWO audit rows.** `withPermission()` logs `ERROR` alongside the explicit `DENIED`
written by the last-owner handler, and it takes no entity parameter so it cannot name the record
touched. Step 8 is worded against one row naming the target. A known defect, not an unknown — fix it
in Phase 05, when the Studio shell gives `withPermission` somewhere to learn the entity from.

**RLS became testable here, contrary to what Phase 03 concluded.** Supabase's policies rest on
ordinary Postgres roles plus `auth.uid()` reading a per-transaction GUC, all reproducible on a plain
cluster. `supabase/local/00-auth-shim.sql` does it. **The grants in that file are load-bearing**:
on Supabase, `anon` holds full DML on every table in `public` — GRANT is not the security boundary
there, RLS is the whole of it — so a shim without them makes every deny assertion pass for the wrong
reason. `assertHarnessIsHonest()` runs before the suite and fails if a table with RLS disabled is
not visible to anon.

## Completed

- Toolchain scaffolded per CANONICAL D1/D2: Next.js 16 App Router, React 19, TypeScript
  strict with `noUncheckedIndexedAccess`, Tailwind 4 CSS-first, Vitest, Playwright, ESLint,
  Prettier, and `.github/workflows/ci.yml` running every gate as its own step.
- **Token layer.** `app/styles/tokens.css` is the only file permitted a colour literal;
  `scheme.css` redeclares an identical 28-token semantic set for DEEP, INK and BONE;
  `globals.css` carries the Tailwind `@theme` bridge and no values of its own.
- **Every derived value re-verified before use.** The palette quartet re-counted against the
  Higgsfield manifest (114 assets each). The ten-step neutral ramp reproduces exactly from
  the OKLab rule in DESIGN_SYSTEM §2.2 — all ten hexes and luminances to four decimals.
  Every contrast claim recomputed, including champagne on bone at 2.52:1 (fails AA at every
  size) and its replacement champagne-deep at 5.05:1.
- **32 primitives** in `components/primitives/**`, each with behaviour-level tests.
- **Motion helpers** implementing the §4.3 contract: reduced motion renders the final state,
  not a shortened animation; content is never gated on motion; the static branch is used on
  both the server and the first client render so hydration agrees.
- **Dev gallery** at `/design-system`, verified 200 under `next dev` and 404 in a production
  build — and since the route is in the production manifest, the 404 provably comes from the
  `notFound()` guard rather than an absent route.
- **Licence audit of all eleven FEAT §7 sources.** 5 NOT_ADOPTED, 6 REJECTED, none adopted.
- **Five gates**, each proved to bite by provoking the failure it exists for.

## Files Created

```
package.json · tsconfig.json · next.config.ts · postcss.config.mjs · eslint.config.mjs
playwright.config.ts · vitest.config.ts · .prettierrc.json · .github/workflows/ci.yml
app/layout.tsx · app/globals.css · app/styles/{tokens,scheme,base}.css
app/(site)/design-system/page.tsx
components/primitives/**  (32 components + motion/{Reveal,useReducedMotion})
components/devtools/Specimen.tsx
lib/ui/{cn.ts,polymorphic.ts}
scripts/design/{check-tokens,check-registry,check-utilities}.mjs
tests/setup/vitest.setup.ts · tests/e2e/design-system.spec.ts
tests/e2e/design-system.spec.ts-snapshots/  (8 baselines)
```

## Database Changes

**Migrations `0001`–`0008`** — the whole Phase 03 spine. Applied and verified against a local
PostgreSQL 16.13 cluster; **never applied to the hosted Supabase project** (see Migration
Requirements).

| Migration | Contents |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, `citext`, `pg_trgm`, `unaccent` |
| `0002_enums.sql` | `content_status`, `owner_verification`, `fact_classification`, `media_kind`, `price_state` (three values — no `FIXED` until Phase 14), `collection_concept_state` |
| `0003_shared_functions.sql` | `set_updated_at()`, `rivya_slugify(text)` (IMMUTABLE, accent-folding) |
| `0004_taxonomy.sql` | `categories`, `collections`, `materials` |
| `0005_media_registry.sql` | `media_assets` (minimal), plus the two `hero_media_id` foreign keys `0004` could not declare |
| `0006_catalog.sql` | `products`, `product_collections`, `product_materials`, `product_media`, `product_relations` |
| `0007_seed_bookkeeping.sql` | `content_seed_runs` |
| `0008_indexes.sql` | 24 performance indexes |

RLS is enabled on all ten tables with **zero policies** — the intended state until Phase 04.

**Seed data:** the seven D3 categories, slug/name/order only. `3d-resin` is seeded
`OWNER_VERIFICATION_REQUIRED` because the name asserts a fabrication capability nobody has
confirmed; the `categories_verified_before_publish` constraint makes that row unpublishable until
an owner clears the flag. `products` has zero rows and always will under seed policy.

## Tests Run

```
npm run typecheck · lint · format:check · test · build
npm run manifest:verify · media:check-ids
npm run design:check-tokens · design:check-registry · design:check-utilities
npm run db:reset · db:check-migrations · db:check-schema · db:check-types · db:check-data-layer
npm run seed:content -- --dry-run   then twice for real, then after an owner edit, then --force
npx playwright test                 (8 projects = the FEAT §45 widths)
```

## Test Results

- Unit: **329 tests across 44 files**, all passing (was 282/41 at the end of Phase 02).
- All **thirteen** gates pass.
- Phase 03's nine verification steps, each executed against the real database:

  | # | Step | Result |
  |---|---|---|
  | 1 | Migrations apply to an empty database | 8/8, no error |
  | 2 | `db:types` then diff | no diff; two runs byte-identical |
  | 3 | Dry run on a fresh database | 7 inserted, 0 updated, 0 skipped |
  | 4 | Two real runs | 7 inserted; then 0 inserted, 7 updated, 0 skipped; `content_seed_runs` = 2 |
  | 5 | Owner edit, then re-seed | 1 `skipped_owner_edited`; `name` still `Owner Edit` |
  | 6 | `REQUEST_QUOTE` with price 0 | rejected by `products_price_state_coherent` |
  | 7 | `price_state` values / `FIXED` insert | exactly the three values; `FIXED` rejected as an invalid enum input |
  | 8 | `check-data-layer` | exits 0; exits 1 when a `.from(` is added to a component |
  | 9 | `vitest run tests/unit/repositories` | 19 tests pass |

- Every constraint was additionally probed with a value it must reject **and** one it must accept.
  The media identity key was confirmed to allow the same `public_id` under a different
  `resource_type` while rejecting a true duplicate — the behaviour DATA_MODEL §7 says the wider
  key exists for.
- Each of the five new gates was proved to bite by provoking the failure it exists for, and the
  layering gate was additionally proved **not** to fire on `.from(` inside a comment or a string.

**Step 4 sequencing note.** Verification steps 3 and 4 each begin from a fresh database. A dry run
writes a `content_seed_runs` row (that is what `is_dry_run` is for), so running step 3 and step 4
against the same database yields a count of 3, not 2. Step 4's assertion is only true from a
fresh start, and that is how it was run.

## Known Issues

**Supabase credentials are configured but UNREACHABLE from this sandbox.** `.env.local` holds
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and a
direct (5432, non-pooled) `DATABASE_URL`. The egress proxy refuses `*.supabase.co` over HTTPS
(`CONNECT tunnel failed, 403`) and refuses raw TCP to 5432/6543, while npm:443 stays open in
the same test. **Phase 03 migrations and the seed can be written here but not applied or
tested here** — that needs a machine with ordinary egress, or CI. See docs/ops/ENVIRONMENT.md.

**Cloudinary works, through MCP.** Cloud `dhaqpl1kz`, Free plan, 1.04% of credits used. Direct
HTTPS to `res.cloudinary.com` is blocked like everything else, but the MCP server routes via
the allowlisted Anthropic proxy, so uploads run server-to-server with this sandbox never
touching the bytes.

**The Phase 06 migration path is settled, and it is not the obvious one.** Higgsfield's source
PNGs exceed the plan's 10 MB image cap (a canary was rejected at 20.8 MB). The `_min.webp`
variant Higgsfield serves alongside each image is *not* a downscale — same 4800×3584, 463 KB.
`source_min_url` is now in the manifest for all 224 images and is what the bulk run reads.

**SECRETS EXPOSED — rotation requested, not confirmed.** The service-role key, secret key, JWT
secret and database password were pasted into a chat transcript on 2026-09-08. They must be
rotated in the Supabase dashboard; `.env.local` needs re-filling afterwards. Until that is
done, treat these credentials as compromised.

**BLOCKING, and outside this session's reach: GitHub Actions cannot provision a runner.**
**40 of 40** runs — on `main` and on feature branches alike, including the very first — fail
about two seconds after creation with `runner_id: 0`, an empty runner name, **zero steps
executed** and `HTTP 404` for the job logs. A job that dies before a runner picks it up has
run none of this repository's code.

Ruled out with evidence: the code (all nine gates pass locally and Vercel builds the same
commits); the workflow file (an unparseable one yields a run with *zero* jobs, whereas the
`verify` job is created with its `ubuntu-latest` label intact and only then dies unassigned);
Actions permissions (set to "Allow all actions and reusable workflows"; runs created after
that change fail identically); and flakiness (a re-run reproduced the signature to the
second). What remains is the account layer — the repository is **private**, so its minutes are
metered, and this signature is what GitHub emits when Actions is refused at billing. Owner
action: `github.com/settings/billing` → Actions, any account-level banner, or make the
repository public. Full diagnosis in `docs/ops/ENVIRONMENT.md`; evidence on PR #3.

**Until a runner exists, CI is not a gate.** Run the nine `verify` steps locally before every
push and satisfy D9 from those runs, evidenced in the phase record — never from a green check.

**Resolved during this phase**, recorded because each was a real defect:

1. **Every button rendered unstyled.** `base.css` was imported unlayered and beat every
   Tailwind utility on `button` — no padding, no accent fill, no border. The visual baselines
   had been captured from that state and therefore endorsed it. This is the phase's most
   important lesson: **a snapshot proves nothing changed, never that anything is right.** The
   checks that found real defects were the ones asserting against an external standard —
   computed style, the OKLab rule, axe, a real keyboard — not the ones comparing the system
   to its own past output.
2. **Nine components had no transitions** — `duration-[--var]` compiles to invalid CSS that
   browsers drop silently. Gated in `check-tokens`.
3. **The QA matrix could not test touch** — mobile projects reported a fine pointer until
   `hasTouch` was set, so the 44px rule was unverifiable where it applies.
4. `Dialog` and `Drawer` **did not restore focus to their trigger**. `useModalSurface`
   applies `inert` in a layout effect; `FocusTrap` captured `document.activeElement` in a
   passive effect, which runs later, so it captured `<body>` after the browser had blurred
   the inert trigger. **jsdom does not implement `inert`'s focus behaviour**, so the unit
   test asserting restoration passed throughout — the Chromium test caught it. Recorded above
   that test so it is not trusted alone.
5. `Switch` rendered a button with **no accessible name** — a critical axe violation. The
   unit tests had hidden it by passing `aria-label` themselves. Now optional `label` with a
   dev-time assertion covering all three name sources, plus a test that the name does not
   change when toggled.
6. Four component groups independently hit the **polymorphic ref** error. Fixed in
   `lib/ui/polymorphic.ts` and documented as DESIGN_SYSTEM §6.3 so a fifth does not.
7. **False positives in my own gates** — unescaped variant selectors, bare utility
   roots matching prose, unstripped block comments, and CSS leading-digit escaping.
8. Playwright polled `/` for readiness, which legitimately 404s until Phase 10.

## Remaining Work

**None for Phase 02.**

**Owner decisions — RESOLVED 2026-09-08**, recorded as CANONICAL-DECISIONS amendment A3:

| Question | Decision |
|---|---|
| Does `Place Order` survive the no-checkout rule? | **Renamed.** It is not seeded at all. The action is `Send an Enquiry`; the handoff is `Discuss on WhatsApp`. |
| Is a newsletter in scope? | **Yes, build it.** Double opt-in; `newsletter_subscribers` in Phase 03; capture, consent, confirmation and unsubscribe in Phase 09. |

**New open question, and it blocks part of Phase 09:** no email service provider exists in
CANONICAL D1. The newsletter can capture an address and can never send to it, so the
confirmation email — the thing that makes double opt-in mean anything — cannot ship until one
is chosen. Adding Resend, Postmark, SES or Mailchimp is a new production dependency and needs
its own amendment, so it is the owner's call rather than a default taken here. Phase 09 can
build capture, consent, confirmation-token handling and unsubscribe without it.

Two smaller questions from Phase 01 remain: whether to bless `/studio/content/pages/global` as
the CTA library's reserved page id or add a D4 route leaf, and whether `analytics` stays a tab
on `/studio` rather than a route segment.

## Next Exact Action

**Finish Phase 05.** Read `docs/project/phases/PHASE-05-09.md` §PHASE 05, then work the seven
unbuilt items listed under *Current Phase* above, in that order. Items 1–3 and 5 are unblocked;
item 4 needs Supabase.

Previously recorded as the phase-start list, and still true of the items not yet done:

Phase 05 consumes `getStaffSession()`, `requirePermission()` and `lib/auth/nav-visibility.ts` from
Phase 04 and builds the Studio chrome itself. Four things it should pick up on the way:

1. **Fix the double audit row.** Give `withPermission()` an entity parameter and stop it writing an
   `ERROR` row for a refusal that already wrote `DENIED`. Verification step 8 of Phase 04 is worded
   against one row naming the target.
2. **Un-`fixme` the four authenticated cases in `tests/e2e/studio-access.spec.ts`** once a Supabase
   project is reachable: a `viewer` sees the page with write controls absent and a direct POST
   returns 403, a `merchandiser` succeeds, a suspended account is treated as signed out. The file
   exists and its unauthenticated half passes; only these four are annotated.
3. **`app/(studio)/layout.tsx` does not exist**, so the login page currently renders on the root
   layout's `rv-scheme-deep` ground. It uses only semantic tokens, so it inherits `rv-scheme-bone`
   unchanged once the Studio shell adds that layout.
4. ~~`middleware.ts` deprecation~~ — **done**, amendment A6. The file is `proxy.ts`, its export is
   `proxy`, and `npm run security:check-proxy` refuses a return of the old name.

## Relevant Documentation

`docs/project/phases/PHASE-00-04.md` §PHASE 02 · `docs/design/DESIGN_SYSTEM.md` ·
`docs/design/COMPONENT_REGISTRY.md` · `docs/architecture/CANONICAL-DECISIONS.md` D1/D2/D6

## Environment Requirements

Node 22, npm 10. **TypeScript is pinned to 6.0.3 and ESLint to 9.x** — the reasons are in
`eslint.config.mjs`; do not bump either without reading them. Playwright uses the image's
pre-installed Chromium via `PLAYWRIGHT_CHROMIUM_PATH`; do not run `playwright install`.
No Supabase or Cloudinary credentials are set; Phase 02 needs none.

## Migration Requirements

`supabase/migrations/0001`–`0012` exist and apply cleanly to an empty database, **and to one laid
out the way a hosted Supabase project is** (`npm run db:check-hosted-layout` — added after the
Phase 03 set was found to be un-appliable to a real project).

**They have still NEVER been applied to the hosted Supabase project** — this sandbox cannot reach
`*.supabase.co` (the proxy answers 403 to CONNECT) and Postgres 5432/6543 are blocked outright.

**The route is `.github/workflows/db-migrate.yml`** — Actions → *Database migrate (hosted)* →
Run workflow. A GitHub-hosted runner has ordinary egress; that is the whole reason it exists. It is
`workflow_dispatch` only, so it costs Actions minutes only when someone runs it deliberately.

- Requires the repository secret **`SUPABASE_DB_URL`**, set to the **Session Pooler** string from
  Supabase → Project Settings → Database.
- `mode: plan` (the default) reports what would apply and changes nothing. `mode: apply`
  additionally requires typing the project ref, which is checked against the secret.

**Do NOT use `db:reset --allow-remote`**, which earlier revisions of this file suggested. It DROPS
SCHEMA PUBLIC. The correct script is `db:migrate`, which is forward-only, records a SHA-256 per
migration, and refuses if a migration was edited after being applied or if the database carries a
version this repository does not have.

The pooler string is not a preference. `db.<ref>.supabase.co` is IPv6-only and GitHub runners have
no IPv6 route, so it times out looking like a firewall problem; `scripts/db/migrate.mjs` rejects
that hostname by name rather than letting anyone spend an afternoon on it. Port 6543 (transaction
mode) cannot hold the session DDL needs — use 5432.

After a successful apply, still to run against the project: `npm run seed:content` and
`npm run auth:check-rls`.

Note `supabase/local/00-auth-shim.sql` is applied by `db:reset` and is LOCAL ONLY — it stands in for
roles, grants and `auth.uid()` that Supabase provisions itself. Applying it to a hosted project would
be wrong; it lives outside `supabase/migrations/` so `supabase db push` cannot pick it up.

Phase 14 must **drop and recreate** (not extend) `products_price_state_coherent`,
`products_listing_idx` and `products_facets_idx` — reasons in `0006_catalog.sql` and
`0008_indexes.sql`.
