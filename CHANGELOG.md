# Changelog

All notable changes to Rivya Living Art. Newest first.
Every phase adds an entry; see `docs/architecture/CANONICAL-DECISIONS.md` D9 for what
"complete" means.

## [Unreleased]

### Phase 08 — Content Management Engine

The CMS: pages, a typed block catalogue, the status workflow, media binding, scheduling, revisions
and the Studio surfaces that drive them. Seven tables, six migrations, six blocks of twenty-eight.

**Three contradictions in the phase documents, resolved rather than picked between.** They named
eleven transition edges in one place and eight in another, and a permission column citing
`content.review` and `content.verify` — neither of which was in the matrix. The union of the edges
is twelve, both permissions are added, and `content.publish` is left alone; amendment A7 records
why. `lib/cms/transitions.ts` is now the single source and
`scripts/cms/gen-transition-sql.ts` renders the trigger from it, byte-compared by
`npm run cms:check-transitions`.

The fourth contradiction is not resolvable in code: all 250 imported Higgsfield assets are APPROVED
*and* `OWNER_VERIFICATION_REQUIRED`, which collides with Phase 03's
`media_assets_verified_before_publish`. Nothing binding one can be published until the owner
verifies it. That is the design working, and it means the site cannot go live on Higgsfield media
alone.

**A media gate that was open, found by testing the scheduler.** `sync_media_usages` only writes a
`media_usages` row when `media_slot_key` is present, and `cms_publish_section`'s RV003 and RV006
gates are both joins through that table. A section binding an asset with a null slot key therefore
published with **no media check at all** — verified: a DRAFT, unverified asset went live and stayed
DRAFT, invisible to the gap tracker too. Migration `0054` makes the slot key required whenever an
asset is bound; verified again after.

**Blocks in two tiers (amendment A8).** All 28 catalogue types are declared; six are built, chosen
so that between them they exercise every payload family: none, media-only, repeating items with
indexed media references, query-and-global, and the degenerate case of no payload *and* no copy
fields. Both registries are `satisfies Record<BlockType, …>`, so a missing entry fails the build —
proved by removing one and reading the error. A planned block cannot be added in Studio and renders
nothing at all on the public site, rather than a placeholder that would be a sentence nobody wrote.

**Copy cannot get into the renderers.** `npm run cms:check-copy` parses every file under
`components/sections/` with the TypeScript compiler and fails on a literal a visitor would read — a
JSX text node, or one given to `alt`, `title`, `aria-label`. Class names and `sizes` values are
literals too and are fine; what makes a literal copy is its position, which a regex cannot see.
Verified by planting a headline and a hard-coded `alt`.

**Scheduling.** `cms_run_content_schedule` (`0053`) sweeps due sections under `for update skip
locked`, so an overlapping invocation sees an empty set rather than double-publishing. A refusal is
recorded on the row and the section goes BLOCKED after three attempts — a permanently
unpublishable section retrying every tick forever is indistinguishable from one that worked. A
human edit un-blocks it. `CRON_SECRET` is compared after hashing both sides, because
`timingSafeEqual` throws on a length mismatch and the difference between a 500 and a 401 leaks the
secret's length.

**Preview** uses the staff session as its credential rather than a token in the query string, which
would land in browser history and in the `Referer` of every asset the previewed page loads.
`draftMode()` is awaited — it is async in Next 16, and written synchronously it still compiles
while `enable()` does nothing.

**Seeding.** Two modules: `pages` (one row per static D3 route, structure only) and
`global-content` (the strings the renderers require, with SEED §27–§29 verbatim). The renderers
ship no fallback copy, so those rows are load-bearing rather than cosmetic. Migration `0055` adds
an `ERROR` group for the media fallback label, which `MediaFrame` has named in its header since
Phase 05 and which the closed group list had no home for.

**Also fixed:** `sectionMediaFor` compacted its slot array, so a card holding `media_index: 2` drew
a different picture for visitors whose RLS hid an earlier asset. A guard written as
`const copy = <SectionCopy/>; if (copy === null)` could never fire, because a JSX element is always
truthy. `loadFixture()` could not delete a fixture user once any suite had attributed a revision to
them. Two RLS suites collided on the same fixed uuids and on cleanup patterns that missed each
other's rows.

23 tables, 90 policies, 25 migrations. 930 tests pass with `RLS_TESTS_REQUIRED=1`, none skipped.
23 gates.

### Phase 07 — Higgsfield Asset Audit + Initial Asset Plan

**CODE COMPLETE. The migration has not been run.** Everything below is built, tested and merged;
moving the 250 assets into Cloudinary is an owner-side action, because this sandbox's proxy refuses
CONNECT to both `api.cloudinary.com` and the Higgsfield CDN the assets are fetched from. See
*Remaining Work* in `docs/SESSION-STATE.md` for the exact command.

**The migration.** `scripts/media/migrate-higgsfield.ts` moves each manifest asset from its
Higgsfield CDN origin into the Cloudinary folder and public id the manifest already assigns, then
writes a `media_assets` row with full provenance. `--dry-run`, `--family=`, `--limit=`.

The upsert key is `higgsfield_generation_id`, not `rivya_asset_id`. Rebuilding the manifest
renumbers a family whose membership changed — `PROCESS-POUR-004` can legitimately become `-005` —
while the generation id names the run that produced the pixels and no rebuild touches it. Keying on
the asset id would re-insert a renumbered family as new rows and double the library. A unit test
shifts twelve `process-pour` ids and asserts the run reports 250 skips and zero uploads.

Images upload from `source_min_url`, not `source_url`, and a canary paid for that lesson: the
originals are 4800×3584 PNGs past 20 MB against Cloudinary's 10 MB image cap. The `_min.webp`
variant is not a downscale — same pixels, webp-compressed to 463 KB, a 47× reduction. All 26 videos
carry `source_min_url: null` and need none.

Two pieces of state, split deliberately: `data/higgsfield/migration-log.json` per asset, committed,
which is the resume mechanism; `higgsfield_migration_runs` per run, in the database, which is the
audit record.

**The gap engine.** `content/media-slots.ts` declares 26 CMS media slots across the D3 route map,
each naming the manifest families that could fill it. An empty `fillableBy` is a statement, not an
omission — it is how a gap is distinguished from a slot that merely has no binding yet, which is a
distinction the assets alone cannot make.

`lib/media/gaps.ts` joins that against `media_usages`, classifying each slot FILLED / COVERED /
THIN / GAP and reporting thin families, families no slot can consume, and per-slot missing ratios.
Against the manifest with nothing bound: 13 coverable, 2 thin, 11 gaps — every page the phase
document predicted, and `gallery-scene` as the one family no declared surface uses.

A slot also declares whether an unfillable one earns a generation brief or an honest empty state.
`/portfolio` is the second: a portfolio entry asserts that Rivya delivered a piece to a client, and
generating an image of one would fabricate exactly the business fact D10 exists to prevent, so
`briefableGaps()` excludes it by construction rather than by a filter somebody could forget.

**`slot_key` now carries the registry key verbatim.** `MEDIA_GUIDE.md` §6 previously documented
short section-scoped keys (`media`, `card.3`), which the registry keys do not match — the join
would have silently found nothing after Phase 09. Neither the schema nor CANONICAL-DECISIONS fixes
a vocabulary, only non-blank, so the registry supplies one. The alternative would force
`computeGaps()` to join through `page_sections`, which does not exist until Phase 08 — so the gap
list could not run until after the phase that works from it. Repeating slots keep the documented
`[n]` index form; `slotKeyOf()` strips it so four cards count against one declared slot.

**The tracker** at `/studio/media/higgsfield` — Inventory, Families and Gaps, with a
non-dismissible concept-media banner on all three. Every asset here is `is_concept = true`, and an
owner who forgot that could send a client a render of a table nobody has built.

Tabs are links rather than the RC-203 widget: the Gaps tab needs its own URL for the phase's
verification and for the e2e test, 250 inventory rows should not ride along in the payload of a
six-row gap list, and a control that changes the URL is navigation — `role="tab"` would tell a
screen reader it stays on the page when it does not.

The asset drawer is read-only and has no regenerate control. Editing alt text and tags belongs to
the Media Manager, where the asset has a `media_assets` row to write to.

**Two guards, both in CI and in `npm run check`.** `scripts/media/assert-no-regeneration.ts` reads
the master plan's briefs and fails if any targets an existing `rivya_asset_id`, is unmarked, plans
an existing family, or if any generation call appears in `app/`, `components/`, `lib/` or
`content/`. Targets are read from brief headings, never by grepping for asset ids — every brief
cites existing assets as its justification, and a guard that flagged those would be switched off
within a week. Verified both ways: passing on the current plan, and exiting 1 on a planted brief
for `WALL-ART-001`, naming the asset and where it already lives.

`scripts/media/build-asset-status.ts` writes §3 and §4 of `HIGGSFIELD_ASSET_STATUS.md` between
markers, leaving the hand-written analysis untouched. Manifest-only and deterministic, because CI
regenerates it and diffs the result; a generator that read the database would produce a different
document on every machine.

**A real ID collision, caught by a test.** The slot key `large-format.coffee` mints
`LARGE-FORMAT-COFFEE-001`, which normalises to the same name as the `LARGEFORMAT-COFFEE-001` the
family allocator will mint once `largeformat-coffee` has a second asset. Different strings, one
name — a literal comparison passes and a reader cannot tell them apart, which is precisely what D6
as amended by A1 forbids. The brief skeleton now names the colliding family rather than minting,
because choosing the replacement is a naming judgement.

**Migration `0040`** adds `higgsfield_migration_runs` with a check constraint that the counts add
up; **`0041`** is its generated select policy. Both are applied to the local cluster and the hosted
project, which now records 19 migrations with `0041_rls_policies_phase07.sql` as the latest.

733 unit tests, no skips, with a database reachable. Sixteen static gates and six database gates
green.

### Phase 06 — Cloudinary Media Architecture

Media becomes a first-class database entity rather than a URL pasted into a field. Cloudinary is
reachable only through `lib/media/`; no other module imports the SDK, and a build gate proves it.

**The provider seam.** `MediaProvider` is an interface; `getMediaProvider()` is the only export the
rest of the product uses. `lib/media/providers/cloudinary.ts` is `server-only` and the sole SDK
importer. URL construction lives in `lib/media/url.ts` and needs no SDK, so a Client Component can
render media without the secret-holding module reaching a browser bundle.

**Migrations `0030` and `0031`**, applied to the local cluster AND the hosted project, then proved
equal by hashing a signature over all 515 objects in `public` — columns, constraints, indexes,
policies, RLS flags, enum labels, function ACLs and triggers. `media_assets` gains 22 columns;
`media_usages` is the reverse index that makes "which slot uses this asset" and "which assets are
unused" answerable without scanning every block payload.

`media_assets.source` is `not null` **with no default**. A default would be worse than an omission:
a forgotten value would silently become a provenance claim nobody made, which is what D6's ladder
and D10's no-fabrication rule exist to prevent.

`media_usages.media_id` is `on delete restrict` — a foreign key rather than the trigger
`CLOUDINARY.md` §7 previously described. A trigger can be disabled with one statement by anyone who
can write a migration.

**`app/api/media/sign`** mints a credential; the bytes never touch this server. All five gates
therefore run BEFORE the signature: session, `media.write`, Zod, the folder allowlist, then
SECURITY.md §7.1's MIME allowlist and byte ceiling.

**`MediaImage` and `MediaVideo`** (RC-232, RC-233 — both now BUILT). Every srcset candidate is built
from the same resolved spec with only the width replaced; a spec fixing both dimensions (`og`) gets
no srcset at all. `MediaVideo` mounts no `<video>` element under any of the four §4.3 gates — not a
paused one — and pressing play still works under all of them.

**The Studio Media Manager**: six sections from one component, the uploader, and the save action.
Alt text is demanded before the upload rather than after, because an uploader that asks afterwards
produces a library full of rows somebody meant to come back to.

**Five new gates**, each verified to fail on a planted violation rather than merely to pass:
`media:check-provider`, `perf:check-image-props`, `perf:check-video-props`, plus the existing
`media:check-folders` and the `check` aggregate.

#### The defect the unit tests could not have found

All three Phase 06 canaries were uploaded to the live account, and the delivery URLs `url.ts`
builds were then put to the API that parses them. Every image chain was accepted. **Every video
chain was rejected** — `"g_auto must be in a transformation component by itself"`, HTTP 400. The
restriction is per resource type and inline `g_auto` is valid on an image, so it is invisible until
a video URL is requested; all six presets carry `gravity: 'auto'`, so every video and every derived
poster would have 400ed in production. Twenty-three unit tests passed throughout, because they
compared strings without sending one anywhere. Fixed, and both forms re-verified against the API.

#### Two corrections to work already committed

- **The transform policy had been invented rather than read.** `PHASE-05-09.md` §06 and
  `CLOUDINARY.md` §5 fix six presets and a nine-rung ladder; my first version had five different
  presets on a different ladder, and no `og` — which `SECURITY.md` §7.2 already cites by name when
  telling the owner what to supply for a social card.
- **`MediaVideo` was missing two of its four gates.** `saveData`/`deviceMemory` and the 768px
  viewport gate, both named in RC-233's own record.

#### Deliberately not built

`/studio/media/higgsfield` stays a stub — AI Assets is a filter on `source = 'HIGGSFIELD'`, not a
kind, and Phase 07 owns it with the remaining 247 assets. The §8 rate limit on the sign endpoint is
not enforced: it needs `rate_limit_buckets`, which belongs to Phase 41. Both are recorded in the
code rather than omitted silently.

### The hosted database exists — migrations applied, RLS verified on the real project

**Every migration `0001`–`0022` is applied** to `ccvarsmzickdkryoakdg` (PostgreSQL 17.6). This had
been blocked for the whole of Phases 03–05: the sandbox cannot reach `*.supabase.co`, and GitHub
Actions has never provisioned a runner to do it from. The Supabase MCP server reaches it directly.

- **Field-by-field verification, not a "success" reply.** Hosted vs local: 14 tables, 14 with RLS,
  55 policies, 63 indexes, 194 columns, 18 check constraints, 9 triggers, 7 functions — every count
  identical. PostgreSQL 17 matching a 16.13 local cluster.
- **RLS confirmed on the real project**, with a baseline so the zeros mean refusal rather than an
  empty table: `anon` sees only the PUBLISHED product and nothing of `audit_logs`,
  `staff_profiles`, `activity_events` or `content_seed_runs`. Closes Phase 04 verification step 8.

**Fixed before it shipped — `0001` would have produced a mixed extension layout**

Checking the real project first showed only `pgcrypto` was installed, in `extensions`. The other
three did not exist, and `create extension` with no schema installs into the first search-path
entry — `public`. That would have left `pgcrypto` in one schema and `citext`, `pg_trgm`, `unaccent`
in another, and tripped Supabase's advisor, which flags extensions in `public` because PostgREST
exposes it. `0001` now names the schema on all four.

**`0022` — a security finding from a check this project could not previously run**

Supabase's security advisor reported eight warnings. The cause was PostgreSQL's default, not
anything written here: **every function is created with EXECUTE granted to PUBLIC.** Migration
0010's explicit grant was redundant, and it hid that the trigger functions had it too — including
`handle_new_auth_user`, which is `SECURITY DEFINER` and writes `staff_profiles`.

Now revoked from PUBLIC and `anon` everywhere, and from `authenticated` on everything but the three
RLS helpers. `authenticated` must keep those or every staff policy fails closed and locks the
Studio out of its own database; each reports a fact about the caller alone and takes no user id.
**Eight warnings down to three**, and the three are the deliberate ones. All 74 RLS tests still
pass, which is what proves `anon` never needed the grants.

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
