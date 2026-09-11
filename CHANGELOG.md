# Changelog

All notable changes to Rivya Living Art. Newest first.
Every phase adds an entry; see `docs/architecture/CANONICAL-DECISIONS.md` D9 for what
"complete" means.

## [Unreleased]

### Phase 42 — Comprehensive Testing (2026-09-11)

The test system the previous forty-one phases wrote specs against. One deterministic fixture, a
browser suite that actually runs, a visual tier, coverage thresholds that mean something, and the CI
to run all of it.

**It found four production defects on its first run.** The worst: no enquiry could be saved, in any
environment, since Phase 41 — `submit-inquiry.ts` wrote a 32-character rate-limiter digest into a
column whose CHECK demands 64, so the database refused every insert and the site's one
non-negotiable business rule had never completed successfully. Also: nothing had ever been written
to `system_logs` (seven RPC parameters sent as `undefined`, which `supabase-js` drops); the
catalogue's product cards were not links, twenty-seven phases after the component's own comment
promised the anchor; and two listing pages skipped a heading level.

#### Added

- `scripts/test/seed-fixture.ts` — six staff, four products (one per `price_state`), a collection, a
  project, two articles, ten FAQs, five inquiries, a research corpus of twenty, twelve media assets,
  all dated from a frozen clock, all behind a reserved id prefix, refusing any non-local database
- `scripts/test/check-fixture-isolation.mjs` — preflight gate 9 at last: no fixture id and no
  `tests/` import may reach the product
- `scripts/test/build-fixture-media.ts` — twelve committed PNGs written by a hand-rolled encoder, so
  the bytes are a pure function of the pixels
- `tests/support/media-route.ts` — every Cloudinary request answered locally; no test touches the
  network
- A third vitest project, `integration`: row security across the schema, seed idempotency by digest,
  the publish gates attempted as the database owner, the migration ledger against the files
- Sixteen browser specs, including the seven `tests/e2e/a11y/**` Phase 41 deferred
- Four visual specs, 33 baselines at three widths, tiered by what a regression costs
- `.github/workflows/e2e.yml` (sharded four ways), `.github/workflows/security.yml` (gitleaks over
  the whole history, `npm audit` split by runtime versus build), `.github/dependabot.yml`,
  `.gitleaks.toml`, `tests/flaky.json` and the gate that keeps it honest

#### Fixed

- `ip_hash` is built with `hashAddress` rather than a slice of a bucket key, so an enquiry can be
  saved
- `writeSystemLog` sends every RPC parameter as `null` rather than `undefined`, so a log row is
  written
- `ProductCard` carries the heading anchor and `::after` overlay Phase 15 promised
- `cardHeadingLevel` derives a card's heading level from whether its section rendered one

#### Changed

- `docs/ops/TESTING.md` rewritten, including a new §13 naming what the suite still cannot see
- Coverage thresholds set to the measured figures as a ratchet, with the 80% target and what it
  would take recorded in `vitest.config.ts`


### Phase 44 — Vercel Deployment (DEVELOPMENT COMPLETE; drills and tests outstanding)

The property this phase buys is not "it is deployed" — it is that a bad deploy can be undone
without guessing. Most of it is a runbook and two scripts, and the most useful thing in it is the
list of what is NOT true.

**One Supabase project, not two, and the consequence is written down.** The phase document
specifies `rivya-prod` and `rivya-staging` with the build failing if a preview points at
production. The owner chose one project, so **a preview deployment reads and writes production
data** — `DEPLOYMENT.md` §1.1 says exactly that, lists the four consequences and what reduces each,
and names what a second project would buy. `check-env.ts` reports the posture as a warning on every
preview rather than enforcing a comparison that would fail every build, because a gate that always
fails is a gate somebody deletes. Amendment **A42**.

**`scripts/ops/preflight.ts` runs thirteen named gates in one command.** "Run all the guard
scripts" is how one of them stops being run: a person under time pressure runs the four they
remember. Each gate prints its own row whether it passed, failed or skipped, failures sort first,
and a **skipped gate says which phase owns it** — a preflight reporting twelve green gates as
thirteen would be the failure it exists to prevent. Ten run today; gates 9 and 13 belong to Phases
42 and 46, and gate 12 skips without `DATABASE_URL` with a reason that says to point it at a
throwaway database. Gate 3 is spawned as `python3` rather than through npm, so a missing interpreter
reads as a failed gate naming the interpreter rather than as a media check that quietly did not
happen (D6 amendment A1).

**`scripts/ops/check-env.ts` checks shape, not just presence**, per environment: a Supabase URL
that is not https, a service-role key that is not a three-segment JWT (structure only — decoding it
would put the payload in this process's memory), a site URL with a trailing slash that doubles every
built URL, a WhatsApp number that is not E.164. It names the variable and the rule and never a
value, a prefix or a length, which is what makes it safe in a build log. It carries one
cross-variable rule: a preview must not use the production WhatsApp number, because a reviewer
reaching the handoff would message the owner's real phone from a draft.

**`scripts/docs/check-doc-contract.mjs` exists now.** Phase 01 named it and it was a filename in a
runbook until this phase. It compares two sets in both directions — every declared variable
documented, every variable the product reads declared — and joins `npm run check`.

**The migrate workflow was extended, not duplicated.** `db-migrate.yml` already did dispatch-only
invocation, a typed project-ref confirmation and plan/apply; it now takes a `pg_dump` snapshot before
any apply and uploads it as a 30-day artefact, and carries a GitHub Environment on the apply path
only. Two workflows applying migrations to one project is how they drift until somebody runs the
wrong one. There is no `migrate-staging.yml`, because there is no staging database.

**`vercel.json` gained** the framework, install and build commands, the `bom1` region, function
memory and duration for the six cron routes and the two heavy media paths. `next.config.ts` gained a
`www` → apex 308 derived from `NEXT_PUBLIC_SITE_URL` rather than hard-coded, and a one-host image
allowlist.

**The environment ribbon (RC-362)** sits above the announcement bar on every non-production
deployment, naming the environment and the commit. It renders null only for the literal
`production`, so a missing `VERCEL_ENV` shows it — the safe direction is to say which environment
this is rather than assume it is the real one. **The build panel (RC-363)** replaced three inline
lines on the environment page and added the migration-state row: `BEHIND` is a warning, `AHEAD` is
`info` because it is the safe half of an expand/contract window.

**Neither deployment drill has been run, and no elapsed time is claimed.** The rollback drill needs
a production deployment with a previous one to fall back to; the forward-fix drill, with one
project, would apply a migration to the production database. Both procedures are written out and
both are marked NOT RUN in `DEPLOYMENT.md` §11.1. A number nobody measured is worse than no number.

**Four owner actions were added to the backlog**: create the `production-database` GitHub
Environment with a required reviewer (without it the approval gate is declared but does not wait),
set both salts, disable public sign-up and create the first owner user, and decide whether a second
Supabase project is worth its cost.

### Phase 43 — Media Coverage + Higgsfield Finalization (DEVELOPMENT COMPLETE; tests deferred to Phase 42)

Phase 07 produced a projected gap list before most slots existed. Phases 09–22 then built the real
slots. This phase re-runs the analysis against reality and resolves every slot with one of four
dispositions — and the headline is how few needed anything generated.

**Ten briefs became two.** `scripts/media/build-coverage-report.ts` joins the 26 declared slots in
`content/media-slots.ts` against the 250 manifest assets and writes the result into
`HIGGSFIELD_ASSET_STATUS.md` §5.0. Its first run proposed ten `GENERATE_NEW` dispositions — not
because ten surfaces were uncoverable, but because six slots carried an empty `fillableBy` list that
Phase 07's own analysis had already answered. Mapping `material-macro` to the collection landing and
contact surfaces, `gallery-scene` to collectible design, `interior-lifestyle` and `process-studio` to
commissions, and the five `largeformat-*` families to furniture took it to four; marking `/faq` and
`/search` as honest empty states — which is what Phase 07 said and the registry had not recorded —
took it to two. Fifteen slots reuse an existing asset, six re-crop one, three are deliberately empty.

**The two that remain are the ones Phase 07 named.** Zero videos in the library carry `page = home`
and the seven at 1920 × 1080 are process, macro or gallery subjects. `HOME-HERO-VIDEO-001` and
`HOME-HERO-POSTER-001` have briefs in `docs/ASSET_GENERATION_PROMPTS.md`, in the families
`home-hero-video` and `home-hero-poster` so the Python builder mints exactly the planned ids.

**Re-crop became a first-class mechanism.** `media_crops` (`0410`–`0411`) stores one editor-chosen
crop per (asset, D6 ratio), applied as `c_crop` **before** the delivery preset — the order matters:
reversed, the preset resizes first and the stored box names pixels that no longer exist. Either a
four-number box in source pixels or a Cloudinary gravity, never neither, so the resolver never
invents a centre crop nobody chose. The crop editor sits on the asset page and warns about a box
outside the source and a box that drifts from its nominal shape.

**All 250 alt texts were rewritten.** The imported drafts were the first ~160 characters of each
generation prompt, cut at a character count: 124 ended mid-clause and the rest carried the prompt's
instructions — lighting rigs, lens settings, palette hex codes, "no people". `build-alt-text.ts`
keeps the scene and drops the instructions, finishing at a clause boundary rather than a count, and
every one of the 250 now passes the SEED §43 rules. The file is committed TypeScript and the
generator PRESERVES a hand edit unless `--overwrite` is passed, so an editor who improves a sentence
after looking at the picture has made a reviewable diff rather than an invisible database change.

**A prompt describes what was asked for, not what arrived**, so every value stays
`OWNER_VERIFICATION_REQUIRED` and the Studio's new alt-text queue orders bound assets first, then the
ones whose draft was truncated, then by warning count.

**The Studio gained four surfaces**: a Coverage tab and a Concept Placement tab on the Higgsfield
tracker, the crop editor on the asset page, the alt-text queue under the media library, and the
brand-format panel that states what the owner must supply *before* they pick a file — read from the
same `BRAND_SLOTS` table the Phase 41 validator enforces, so it cannot promise something the upload
would refuse.

**Nothing was generated, and three categories never will be.** Brand marks are the studio's identity
and are owner-supplied; 3D models of products Rivya has not made would be fabricated products, not
concept media; portfolio imagery would assert delivered work. `media:register-external` is the
intake path for an image the owner generates themselves: it refuses a URL outside the project's own
Cloudinary cloud, registers `is_ai_generated = true, is_concept = true` without a flag to turn that
off, and touches the manifest not at all.

Migrations `0410`–`0411`. `MEDIA_GUIDE.md` §5.4–§5.5, DATA_MODEL §11.ai.

### Phase 41 — Accessibility + Security (DEVELOPMENT COMPLETE; tests deferred to Phase 42)

The security posture stops being a document and becomes code, and the accessibility half gets its
mechanisms — with its proof deliberately deferred, because the owner asked for all development across
the remaining phases before any testing work. Where something is not built, this entry says so.

**Every response now carries the header set, and the policy is collected before it is enforced.**
`proxy.ts` mints a per-request nonce, attaches the content security policy and six static headers to
the pass-through, the authenticated response and the redirect alike, and its matcher was widened to
reach the public site — a header set that runs only on `/studio` is not a header set. The policy ships
`Content-Security-Policy-Report-Only`; violations go to `POST /api/csp-report`, which rate-limits
before reading the body, caps six fields, strips query strings from every path and logs at `SECURITY`
level. `CSP_ENFORCE=1` flips it, after a soak the owner reads in `/studio/operations/logs`.

**The rate-limit key became an HMAC, and the table stopped being aspirational.** `sha256(salt + ip)`
is reversible by enumeration — four billion IPv4 addresses is minutes of GPU time — so the key is now
`hmac(salt, value)` under two separate salts: `IP_HASH_SALT` for `inquiries.ip_hash` and
`RATE_LIMIT_SALT` for bucket keys, because rotating one costs a cleared window and rotating the other
makes every returning enquirer unrecognisable. Five surfaces that SECURITY.md already listed are now
actually wired: search suggestions (degrading to an empty list rather than 429, because a type-ahead
that throws is worse than one that stops suggesting), the Studio signing route, the revalidate
endpoint, the CSP report endpoint and Studio sign-in. A limited surface answers with `Retry-After`
carrying the SHORTEST window in force.

**Uploads are now checked against their bytes, and the control is the row rather than the upload.**
The browser uploads straight to Cloudinary, so the server never holds the file; `saveUploadedAssetAction`
fetches the first 4 kB of the stored original back, runs `validateUpload` against it with the reported
length passed in separately, and on a refusal destroys the Cloudinary object and writes a `DENIED`
audit row. Nothing reads Cloudinary except through `media_assets`, so an object with no row is
unreferenced storage. SVG is refused on every path by content rather than by extension, before the
allowlist, so a polyglot cannot pass by also satisfying a raster signature.

**A person can now ask what is held about them, and ask for it to be erased.** `/studio/inquiries/all`
gained a data request panel and `npm run ops:anonymise-inquiries` does the same three things from a
terminal. Matching is by the email or phone somebody typed — there are no customer accounts — so a
preview is mandatory: it returns the reference codes it would touch, and the erasure sends them back
so the server can refuse a set that has moved since. Erasure clears the person and keeps the enquiry,
with its status and dates, so the studio's record is not rewritten. Owner-only, audited, and the CLI
refuses to write without `--apply`.

**`media_assets.is_decorative` makes WCAG 1.1.1 one CHECK** (`0390`): an asset has a usable text
alternative, or it is explicitly marked decorative, with no third state and no way to store a blank
alternative by accident. `/studio/media/all/[assetId]` is a new route — a page rather than a drawer,
because the six Media Manager sections are one Server-rendered table and a drawer would have made all
six client routes — where the two fields are edited together with quality warnings that appear as you
type and never block a save.

**Five gates joined `npm run check`, and each found something real on its first run.** Secret exposure
(over the built `.next/static`, distinguishing a variable's NAME in copy from its VALUE), action
guards (179 Server Actions across 38 modules reach a permission helper), licences (102 packages, no
copyleft in the runtime closure), contrast (33 token pairs across three schemes, resolved through
`var()` chains) and focus styles (exempting only the pointer-only case and one programmatic focus
target, and counting them).

**Three corrections to documents that claimed more than the code did.** EXIF is **not** stripped from
stored originals — the fix is an incoming transformation that spans the provider and both uploaders
and cannot be verified anywhere but against the real Cloudinary account, so it is recorded as
outstanding with the mechanism named rather than shipped blind. `proxy.ts` assigns no `request_id`
yet. `/studio/system/environment`'s new Security section omits the dependency-audit result, because a
number from somebody's last CI run would be a stale figure wearing a live badge.

**Deferred to Phase 42, by the owner's instruction:** the seven axe specs and `exceptions.json`, the
alt-text coverage test, `rate-limit-window`, `upload-validation` and `pii-scope` unit suites, the
`security-headers` and `studio-authz` e2e specs, and the `gitleaks` + `npm audit` workflow with
`.gitleaks.toml` and Dependabot.

Amendment **A41**. Migration `0390` (`0391` allocated and unused — `rate_limit_buckets` shipped in
`0182` under A18). New variables `IP_HASH_SALT`, `RATE_LIMIT_SALT`, `CSP_ENFORCE`, all owner-set.

### Phase 40 — Performance (COMPLETE)

The performance budget stops being a property of the homepage and becomes a property of the site,
and — more to the point — becomes something anybody can re-measure in one command.

**`perf/budgets.json` is now the only place the numbers live.** Every public route has an LCP
target, a first-load JavaScript target, an island ceiling and a declaration of whether it has an
LCP image; `/studio/**` is one group rule rather than eighty-two rows; `app/(devtools)` is excluded
with a reason. The four guard scripts and this repository's documentation all read it, so they
cannot disagree.

**First-load JavaScript is measured from what the browser is actually sent.** Next 16's build table
no longer prints per-route sizes, so `scripts/perf/measure-bundles.mjs` asks a running production
build for each page and totals the gzipped bytes of every script its HTML asks for — which is
exactly the phase document's definition, and is resilient to the bundler moving its internals
again. `perf/bundle-baseline.json` records the result; `check-bundle.mjs --base <url>` fails CI on
growth beyond 5 %, and `--explain <route>` breaks a route down chunk by chunk.

**Three findings, two fixed in this change** (`docs/ops/PERFORMANCE.md` §4.5):

- **Every hero on the site was fetched at default priority.** `MediaImage` had `loading` and no
  priority hint, so the largest image on every page was un-deferred and then queued behind every
  stylesheet and script the parser had already found. `MediaImage` gains `priority`
  (`fetchpriority="high"` plus eager); `HeroSection`, `SignatureMediaSection` and the product
  gallery's first frame derive it from `isFirst`; `ResponsiveMedia` gives it to the MOBILE half of a
  pair only, because two high-priority images demote each other and the constrained device is the
  one the hint is for. `scripts/perf/check-priority-images.mjs` found ten routes with none and now
  refuses a route with none or with two.
- **Studio answered with no `Cache-Control` header at all** — which does not mean "do not cache".
  `next.config.ts` now sets `private, no-store` on every Studio response beside the Phase 39
  `X-Robots-Tag`.
- **The section registry puts ~98 kB gzipped on every CMS route, 83.5 kB of it Zod.** NOT fixed
  here and tracked with evidence: routes that render CMS sections weigh 280.8–282.0 kB and routes
  that do not weigh 182.8–190.5 kB. Both candidate fixes are architecture rather than tuning, and
  each deserves its own change measured with the harness this phase just built.

**Field data, with nowhere to put an identifier.** Migration `0380` creates `web_vitals_samples`
with ten columns and no IP, user agent, session id, user id, referrer or resolved URL — and
`tests/unit/rls/phase40.test.ts` pins the column set by name so one cannot be added unnoticed.
`route_pattern` is CHECKed three ways to refuse anything that still looks resolved.
`components/patterns/VitalsReporter` (RC-354) beacons LCP, CLS, INP, TTFB and FCP for one page view
in ten, from production only, through `POST /api/vitals` — same-origin, rate-limited, `.strict()`
Zod, inserted as the service role because the alternative is an unauthenticated write policy.
`VitalsCard` (RC-355) shows p75 per metric per route pattern on the Studio Analytics tab, captioned
with the sample rate. The Phase 38 retention cron gained the 90-day purge.

**Guards.** `count-islands.mjs` (every route against its budget, sharing one graph walk with the
Phase 11 homepage gate so the two cannot drift), `check-third-party.mjs` (no origin outside self,
`res.cloudinary.com` and `*.supabase.co` — a privacy position before a performance one),
`check-cache-headers.mjs` (the contract row by row against a running build, with the three
`searchParams`-driven listing deviations recorded on the rows themselves rather than hidden), and
`check-priority-images.mjs`.

`@next/bundle-analyzer` is deliberately **not** wired: it is a webpack plugin and this project
builds with Turbopack, so it would be a dependency that cannot run. `--explain` replaces it.

### Phase 39 — SEO (COMPLETE)

Search engines stop seeing thirteen pages with fallback metadata. **The ladder** (`lib/seo/resolve.ts`):
ENTITY → PATH → DERIVED → GLOBAL, climbed per field, first hit wins, with the one dumb derivation
rule (first heading, first 155 characters of the first body on a word boundary) and the rung shown
beside every field in the Studio. **The canonical table** (`lib/seo/canonical.ts`): a static path
to itself, a filtered listing to the unfiltered category and `noindex`, page 2 onward to itself
with `rel=prev/next`, `/search` none, an owner canonical only when absolute and same-origin.
**One emitter** (`components/patterns/JsonLd`, RC-347) and eight gated builders under
`lib/seo/jsonld/` — `Organization` and `WebSite` from the layout, `BreadcrumbList` from real live
parents, `Product` with `offers` only for FIXED **and** VERIFIED and `material` only from the
join, `CollectionPage`, `Article`, `FAQPage` from VERIFIED rows only, `ContactPoint` from a
VERIFIED section — every capability-bearing property through `verifiedOnly()`, the forbidden-key
list proved absent by `tests/unit/jsonld-guard.test.ts` and by `scripts/seo/validate-jsonld.mjs`
crawling the real build in CI. **The sitemap** is an index over six route-handler children
(PUBLISHED only, `lastmod`, no priority, no changefreq, no image sitemap); `robots.txt` names it;
`X-Robots-Tag: noindex, nofollow` on `/studio`, `/api` and every non-production response.
**Redirects** (`seo_redirects`) are consulted only on the path that would otherwise 404, one hop,
refused at save time when they would loop or chain, and offered pre-ticked when a product's slug
changes. **Keywords** (`seo_keyword_themes`): the seventeen SEED §42 themes as research targets
with no numeric column to fill, the two geography themes awaiting verification. **The workspace**
`/studio/content/seo` — Global · Pages · Entities · Keywords · Structured data · Redirects ·
Coverage — under the new `seo.write` (owner, admin, editor), plus a "Search and social" panel on
the product, collection, project and article editors. Migrations `0370`–`0371`; gates
`seo:check-jsonld-scope` (check and CI) and the build-time validator; the inventory gains a
generated "SEO coverage" section; amendment A40.

### Phase 38 — Environment + Documentation + Logs (COMPLETE)

The System group stops being the place where an operator has to guess. Three read-only surfaces
share one redactor: `lib/logging/redact.ts` now strips by key, by the current value of every D8
server-only variable wherever it appears, and by shape (JWT, PEM block, Cloudinary URL,
`postgres://user:pass@`, bearer token), always to the fixed `[redacted]`. **`/studio/system/
environment`** runs eight checks in parallel under a three-second timeout — `supabase_db`,
`supabase_auth`, `cloudinary`, `google_sheets`, `vercel`, `higgsfield`, `migrations`, `build` — and
renders status, a fixed code, latency and identifiers only; `configured` is presence collapsed to a
boolean, an unconfigured check is never probed, and `tests/unit/env-checks-no-secrets.test.ts`
sets every variable to a sentinel, runs the checks against an echoing network and fails on any
four-character fragment (and is shown to fail on a deliberate leak). **`/studio/system/
documentation`** serves the ten FEAT §30 documents by allowlist key from a redacted index
`npm run docs:index` builds before the build, parsed by a Markdown renderer with no HTML branch.
**`/studio/operations/logs`** reads the new `system_logs` (`0360`–`0361`): `level × channel`,
append-only, written only by the service role through `system_log_write()` which collapses a
repeat within five minutes onto one row, filters in the URL, a redacted detail per row, a CSV
export under the new `operations.logs.export`; **`/studio/operations/workflows`** lists every run
from `workflow_runs_v`. The scraper's warnings, failed Sheets exports and failed environment checks
now write the third log; the 04:15 UTC cron purges by retention (90 / 400 days) and logs its own
summary. `npm run logs:check-separation` (in `check` and CI) refuses a module that sends one event
to both the audit log and the system log. `lib/ops/` joins D2 beside `lib/sheets/` (A39). Hosted
level through `0361`.

### Phase 37 — Studio Analytics (COMPLETE; the market section waits for `advanced_analytics`)

The Analytics tab Phase 05 stubbed on `/studio` becomes real and honest. Eighteen metrics — FEAT
§28's eight first-party and ten competitive — are declared one module each under
`lib/analytics/metrics/` with a definition, a data requirement, a coverage rule and a `compute()`
that only the snapshot writer may call; the registry is held to the specification's list by test.
Migrations `0350`–`0351`: `analytics_snapshots` (one row per metric per day; **an UNAVAILABLE row
must carry a reason and an AVAILABLE one must not** — a CHECK), read by every staff role with the
COMPETITIVE rows additionally behind `research.read` at the policy (the generator's new
`selectScope`, amendment A38), written by the service role only.

`npm run analytics:snapshot` (`--date`, `--only`, `--dry-run`) and the 03:45 UTC cron write the
rows and prune past 400 days; the tab reads the newest row per metric and computes nothing.
Against an empty database every tile is a true zero with `n = 0` or a named reason — "no product
dimensions recorded", "no enabled adapter captures resin style: no attribute key for it exists in
the source schema; sources that would need it: …" — proved by `analytics-no-fabrication.test.ts`
over the in-memory empty reads. `content_performance` is database-derived and the tab says traffic
analytics are not connected (PERFORMANCE §7.5, owner decision). Trends need two snapshots. Flag
`advanced_analytics = false` gates the market section and trend lines, never the access. The
FEAT §17 dashboard cards stop showing their Phase 05 unavailable state: every card whose table
exists has a query. Hosted level through `0351`.

### Phase 36 — Google Sheets (COMPLETE; flag off until the owner's setup)

A one-way export from the research and enquiry tables to a Google Sheets tab, with **no new
dependency, no stored credential and no read path**. Migrations `0340`–`0342`:
`sheets_export_definitions` (entity, allowlisted columns, filter, tab, schedule, PII flag,
circuit-breaker state — no credential column) and `sheets_sync_runs` (status, counts, attempts, a
CHECKed error-code vocabulary, one RUNNING run per definition), the generated policies, and the seven
default `MANUAL` definitions as structure.

`lib/sheets/` (amendment A37 adds it to D2): a service-account JWT minted with `node:crypto` for the
`spreadsheets` scope only; a staging-tab write in ≤ 5,000-cell chunks swapped into place by one
`batchUpdate`; five retries with jitter and `Retry-After`, never on 401/403; three consecutive
failures pause the definition; the per-entity column allowlist; a run engine that audits every run
carrying personal data and records only a sanitised code, never what Google said.
`/studio/research/sheets` (banner, definitions, form, run history), `npm run sheets:sync`, the hourly
`/api/cron/sheets-sync` under `CRON_SECRET`, flag `google_sheets = false`, permissions
`integrations.sheets.manage` (owner, admin) and `integrations.sheets.run` (+ `inquiries.export` for
enquiries). `npm run sheets:check-no-read` fails the build on any Sheets read under `lib/sheets/`;
`tests/unit/sheets-redaction.test.ts` injects a generated key and searches every surface for it.
Environment: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID` (optional; the owner's
five-step setup is ENVIRONMENT §4). Hosted level through `0342`.

### Phase 35b — Demo catalogue + image prompt book (content track)

The owner-authorised placeholder catalogue grows from thirty to **thirty-five** pieces (one more
collectible study, two decor pieces, two gifts — every category now holds at least four), still
`is_demo`, still `PRICE_ON_REQUEST`, still no dimension, material, lead time or claim. Every demo
row is now on the hosted project: 35 products, the 10 article bodies (7 published, 3 waiting for
the owner), 6 DRAFT projects and 6 DRAFT testimonials. `npm run demo:sql` prints the seed (or the
purge, `--purge`) as idempotent SQL for environments the seeder cannot connect to, which is how the
hosted rows were written. `docs/ASSET_GENERATION_PROMPTS.md` (the D7 path amendment A31 added)
carries one ChatGPT prompt per product hero and one room scene per furniture piece — 45 entries,
each with its planned asset ID, dimensions, filename, exact slot and `Cloudinary Status:
WAITING_FOR_UPLOAD` — under the transparency rule recorded as amendment A36: a generated product
image is a concept visualisation, registered and labelled as one, never presented as a photograph.

### Phase 35 — Shortlist + Confirmation (COMPLETE-WITH-FLAG-OFF)

The FEAT §23 pipeline gets its workspace and its gate. **No new stage, no enum change, no second
transition log, no second state machine**: migrations `0330`–`0331` alter no type, and the movement
table lives once, in `lib/scraper/core/stage.ts`, compared cell for cell with the phase document and
SCRAPER §26 by `tests/unit/pipeline-transitions.test.ts`.

**Migrations `0330`–`0331`.** `research_shortlist_entries` (non-blank reason; the score, confidence
and model version captured at entry; one open entry per row; closed with a reason, never deleted),
`research_confirmations` (non-blank decision note; one unarchived decision per row; archival as a
column; `created_product_id` with **no foreign key**), `guard_research_stage_writer()` verbatim from
the phase document (a bare `update research_products set stage …` is refused, naming the row) and
`research_write_stage()` (SECURITY DEFINER, service role only) which carries the transaction-local
flag because PostgREST gives the repository no transaction of its own. `0331` is generated:
`research.read` select, `research.confirm` writes, no anon leg.

**Code.** `MOVEMENTS` and `InvalidStageTransitionError` in `stage.ts` (`MATCHED → SHORTLISTED` is
the one forward jump); `review-actions.ts` writes the entry and the confirmation beside the
review-action row — Confirm now needs a decision note and admits only a shortlisted row;
`returnToReview` and `archiveDecision`; bulk operations `research.close_entry` and
`research.archive_confirmation` beside Phase 29's five, every one now through `moveStage` /
`setDisposition` with its own `undoItem`, and a 200-row cap refused by name;
`/studio/research/shortlist` and `/studio/research/confirmed` filled (score at entry, age, tags,
reason, decision notes, product-started link resolved by a second query, `PipelineBulkBar`); the
research dashboard counts entries open longer than 60 days.

**The one bridge.** `startProductFromConfirmation` starts an **empty `DRAFT`** product — `slug`
(typed), `title` (the slug's title case), `category_id` (chosen), `DRAFT`, `PRICE_ON_REQUEST`, and
nothing else — behind `catalog.write`, the seeded acknowledgement (`StartProductDialog`, unticked on
open) and the flag `research_product_bridge`, **which ships `false`**. Invariant I4 is narrowed to
"no automatic and no field-copying path" with this one carve-out, encoded in
`scripts/research/bridge-isolation.mjs` under `check-research-isolation.mjs` (a second writer, a
moved symbol or a wider projection fails the build) and admitted by `check-no-autoimport.mjs` for
`insertProduct` in that file only; `tests/unit/confirmation-no-import.test.ts` and the RLS suite
put a research row of sentinels through the projection and the insert and find none in the product
or its join tables. Recorded as amendment A35 (proposed); the owner accepts it by enabling the flag.

### Phase 34 — Product Direction Tool

Research becomes a written internal brief instead of a folder of tabs. A direction brief is a Rivya
document a person writes — nine prose sections — with the evidence stapled to it; the tool
assembles the evidence and writes not one sentence of prose, and **it has no path to the
catalogue**: no `PUBLISHED` state (refused by CHECK and by the Zod schema), no price, dimension,
material or lead-time column, and a build gate that fails on any module importing both the
direction repository and the products repository (BR-F6).

**Migrations `0320`–`0321`.** `research_direction_briefs` (`target_category_slug` a checked slug —
the I1 allowlist stays at two, amendment A34), `research_direction_brief_evidence` (non-empty
`rationale`; a volatile kind carries a captured value), `research_direction_brief_revisions`
(written by a SECURITY DEFINER trigger after Phase 08's pattern; restore puts prose back and never
the status); `guard_direction_brief_approval()` holds `research.direction.approve` at the row.

**Evidence is captured by value where it is volatile** — a score's number, state and model
version, a snapshot's observed figures with their coverage — and the rail marks *changed since
attachment* beside the current value. **Observed is not intended**: figures copied from research
render in their own panel with `CoverageBadge` and the words *observed in competitor research*, on
screen, in the A4 print view and in the Markdown export.

**`/studio/research/opportunities/direction`** and **`/[briefId]`**: the list and the two-column
editor (intended prose left, evidence rail, observed figures and revisions right), a permanent
internal-document banner, Approve and Archive behind the confirm dialog, `?view=print`;
`npm run research:direction-export`. New permissions `research.direction.write` (owner, admin,
merchandiser, researcher) and `research.direction.approve` (owner, admin, merchandiser).

### Phase 33 — Visual Similarity (the first-party half)

**The owner decided: competitor images are referenced by URL only and never fetched** (amendment
A33, closing the phase document's open question 12). So the research hash tables are created and
hold no rows, `research_image_hashing` and `advanced_similarity` ship `false` with descriptions
that say why, and the machinery is turned inward: every Rivya asset is hashed, and a re-upload of
one is refused at the upload step, by name.

**Migrations `0310`, `0311`, `0313`** (`0312`, embeddings, allocated and unused). `research_image_hashes`,
`research_similarity_runs` (a `MEDIA_ASSET` scope stores no pairs, by CHECK), `research_similarity_pairs`
(ordered, within the ceiling, banded by its own distance at the table), `research_similarity_suppressions`,
the `similarity_band` enum, `research_sources.image_hashing_enabled` gated on an APPROVED policy; and
**`media_asset_hashes`, first-party**, in its own file, never joined to a research table.

**Pure hashers** — 64-bit dHash and DCT pHash over a gray buffer, Hamming distance, the band table
with its "does not mean" column as the single source, and **seven-segment blocking with NEAR_DUPLICATE
recall of exactly 1.0 by the pigeonhole principle**, measured against brute force over a 2,000-hash
fixture on every test run. Fixture distances are measured, not assumed: a 10 % centre crop lands at 8
on the synthetic scene and the test records it.

**The upload guard.** `saveUploadedAssetAction` fetches the original back from the delivery origin,
hashes it in memory (`lib/media/hashes.ts`, the one module allowed to import a decoder — a new build
gate, `media:check-decoder`), and refuses a byte-identical file on either side or an image within six
bits of a Rivya asset or a research image, naming the match; the Cloudinary object is destroyed and a
DENIED audit row written. Videos by exact checksum only, and the library panel says so.

**`/studio/research/similarity`** is filled: the owner's decision and the two flags, the legend with
`PRECISION NOT YET MEASURED` beside every band, library coverage, **Check the library against itself**
(`research.similarity.run`, new permission: owner, admin, researcher), and run history.
`npm run media:hash` plus the dispatch-only `Media hash backfill (hosted)` workflow (the development
container cannot reach Cloudinary); `npm run research:similarity` records a corpus run with every
source skipped and the gate that stopped it; `npm run research:similarity-sample` writes the labelling
CSV a precision figure must come from.

### Phase 32 — Opportunity Engine

Rivya gets a ranked view of where the market looks under-served — and anyone can see exactly why a
row is where it is. A score is the weighted mean of **seven declared signals**, each normalised to
0–100 by a rule written in code and weighted by a **versioned model**; every stored score keeps one
component row per signal (raw input, normalised value, weight, contribution) so a researcher with a
pocket calculator can reproduce the total. No machine-learning model, no language model, no
embedding, no hidden term — `npm run research:check-no-ml` fails the build on one, and is proved
to fail on a fixture.

**Migrations `0300`–`0302`.** `research_scoring_models` (`DRAFT → ACTIVE → RETIRED`, exactly one
ACTIVE by partial unique index, `freeze_active_scoring_model()` refusing any definition change on a
non-draft row and naming the version), `research_opportunity_scores` and
`research_opportunity_components` (no session write policy; `included = (normalised is not null)`
because **excluded is not zero**). `0302` seeds v1 as a DRAFT: activation is a human, audited act
under the new `research.score.manage` permission (owner, admin).

**The formula is implemented once** in `lib/scraper/analytics/opportunity/score.ts` and printed
verbatim in SCRAPER §23. Signals below their coverage requirement are excluded with a stored reason
and lower confidence; below the floor a row is `INSUFFICIENT_DATA`, stored and never ranked. The
`large_format_fit` table resolves all 24 category × flag combinations with no default, asserted by
an exhaustive test; furniture that is not large-format scores 50, written down as a judgement.

**`/studio/research/opportunities`** is filled: a header stating the active model and last run,
Scored and Insufficient-data tabs both visible, an Explain drawer whose footer reproduces the total
from the stored components, an exclusions panel, and — for owner and admin — the model panel with
the rank-movement diff rendered before the Activate button. `npm run research:score` (`--model`,
`--source`, `--dry-run`, `--explain`) and a 03:15 UTC cron produce scores; the cron answers
`skipped: no_active_model` until a human activates one.

### Phase 31 — Analytics + Comparison

The research corpus becomes measurable, and every measurement carries its own error bars. Three
pure modules under `lib/scraper/analytics/` answer three questions — what is being made and in what
proportion, at what price levels and how those levels are spaced, at what physical sizes — and
each returns a **coverage record** beside its result: `n`, the denominator, the percentage and a
count per reason for every row it could not use. `n + Σ excluded = denominator` is asserted by a
unit test on every module's output. The Studio holds evidence after this phase; it still holds no
opinion.

**Migrations `0290`–`0292`.** `research_comparison_sets` and `research_comparison_members` — a
person's saved question, written as the person under `research.write`. `research_analytics_snapshots`
and `research_metric_coverage` — the machine's record, with **no session write policy at all**: a
snapshot a session could insert is a market figure nobody computed. `coverage_pct` is a generated
column, so the stored percentage cannot disagree with its integers, and zero over zero is 0 %.

**Currencies are never mixed, at three layers.** `computePriceArchitecture` throws
`MixedCurrencyError`; the workflow splits by currency first and writes one price snapshot per
currency; and the snapshot table's unique key includes the currency, with a CHECK requiring it on a
price row — there is no key under which a combined figure could be stored. Quote-only rows are
counted, never imputed as zero. Below twelve priced rows the panel says INSUFFICIENT SAMPLE and
withholds every percentile.

**`/studio/research/compare` and `/compare/[setId]`** are filled: sets, members (whole sources or
individual rows, one target per row by two CHECKs), a recompute action that reads as the person and
writes as the system, and four panels each headed by `CoverageBadge`. The dashboard gains a
per-source coverage panel that reads health from the Phase 26 view rather than recomputing it.
Charts are four token-only inline-SVG patterns (`BarSeries`, `BandStrip`, `Scatter`, `Sparkline`),
each `role="img"` with a data table beside it and no chart library.

**`npm run research:analytics`** computes any scope with `--dry-run` printing every coverage record,
and `app/api/cron/research-analytics` writes the corpus, every enabled source and every set nightly
under `CRON_SECRET` (amendment A25). A deleted set takes its snapshot history with it through a
SECURITY DEFINER trigger, because `scope_id` names a set, a source or a category and cannot carry a
foreign key to three tables.

Verified: unit project 154 files / 2,497 tests; RLS project 24 files / 545 tests with
`RLS_TESTS_REQUIRED=1`; `npm run check` green; migrations applied locally and to the hosted project.

### Phase 30 — Large-Format Research Workspace

SEED §56 puts large-format furniture first in the content hierarchy; this gives the same priority to
research. `/studio/research/large-format` is a workspace over the rows that are large by a stated,
editable rule — with honest coverage figures for the rows whose dimensions could not be read.

What it is **not** is a market analysis. Rivya has no published products, so a comparison against
its own catalogue would be an artefact of an empty catalogue wearing the clothes of a finding. This
screen describes what has been observed; opportunity scoring is Phase 32.

**Migrations `0280`–`0281`.** Six columns on `research_products`, `research_large_format_rules`
(five ordered rules seeded as configuration, first match wins) and `research_saved_views`.

**`is_large_format` is three-valued, and the null means "we have no measurement"** — not "we could
not place it". A boolean would force a row whose dimensions could not be parsed to `false`, and
every distribution built on the column would then under-report large work in proportion to how badly
a source writes its pages: a failure that looks exactly like a finding. The first draft of this
phase tied the null verdict to the BAND instead, and the phase document's own four verification rows
caught it — a well-measured 1 150 mm piece whose proportions match no band signature is banded
`UNKNOWN` and its size is perfectly well known (amendment A30).

**Coverage is stated before anything is drawn from it.** The banner renders above every panel, each
panel takes a required coverage prop, and zero rows in scope reads as 0 % rather than 100 %. No
panel drops the unknown bucket or an empty band to look tidy. Price panels group by currency and
produce no combined total — the summary type has no field for one, a shape that cannot express the
wrong answer — and quote-only rows are counted rather than dropped.

**An editor override is permanent.** `large_format_source = 'EDITOR'` freezes the row;
`research:reclassify-scale` skips it and **reports** the skip, because somebody editing the rules
needs to know how many rows their edit did not reach. Proved end to end against a live fixture: a
2 100 mm piece banded DINING and large, a 900 mm piece COFFEE and not large, an unmeasured row
UNKNOWN with no verdict, and an overridden row surviving a threshold raised past it.

**`research_saved_views` is the first owner-scoped research table.** Five of the six roles hold
`research.read`, so the scope carries the security rather than the permission; sharing is a second
SELECT policy rather than a widened scope, because it widens who may READ a row and must not widen
who may edit it.

**The gap panel reports research coverage and says so in its heading** — no comparison with Rivya's
catalogue, no score, and no opportunity language, which a test asserts by reading the component.

**The workspace acts, not only reports.** Row selection arrived here and on the change queue, so the
Phase 24 bulk toolbar and the Phase 29 action bar both work from the screen where a piece was found.
Nothing new was built to carry them: the preview, the typed-count confirmation, the per-item snapshot
and the 24-hour undo are the engine's, and the single-row controls call the same Server Actions the
queue calls — Phase 29 wrote them to accept a bare product id for exactly this case. On the queue the
checkbox carries the PRODUCT id, because the five operations target a product and a queue row is one
field's movement on one of them. `/studio/research/explorer` keeps the named unavailable state, which
is still true there.

**I3 now bans the scale identifiers rather than the words.** `scale_band`, `scaleBand`,
`large_format_source` and `largeFormatSource` may not appear on a public surface; "dining" and
"console" obviously may, and `products.is_large_format` is a first-party column the public Large
Format page reads.

### Phase 29 — Change Detection + Review

The research subsystem becomes useful **over time** rather than at a point in time. A page Rivya has
already read says something different, and somebody has to decide what that means. The rule that
shapes every table, every action and every guard is FEAT §25's last line: **changes are never
automatically imported into Rivya products.** They are never automatically imported into anything.

**Migrations `0270`–`0271`, applied locally AND to the hosted project** — with parity measured, not assumed: a structure digest over the seven tables' columns, constraints, indexes, policies, trigger functions and triggers (147 objects) matches byte for byte. Seven tables — `research_changes`, `research_change_rules`,
`research_review_actions`, `research_notes`, `research_tags`, `research_product_tags`,
`research_change_digests` — in three postures that answer one question: who may write. What the
SYSTEM detected takes no write policy at all, for any role including owner, because a change row a
session could insert is a competitor price move somebody invented. What a PERSON decided is
`research.confirm` and append-only at a TRIGGER as well as at the policy, so the service role is
refused too. What a person CONFIGURED is `research.write`, the same posture as the material lexicon.

**Diffs are version-to-version, never against the mutable current row**, and both snapshot keys are
stored — so a change record can still be reproduced years later, from the two gzipped pages it was
actually read from, after the rule that produced it has been edited twice.

**Materiality is a stated rule with three levels.** `NOISE` is recorded, hidden by default and never
counted: a queue that reports a CDN rewriting an image URL beside a 12 % price rise is a queue
people stop reading, and an organisation that believes it is watching its competitors while nobody
reads the queue is worse off than one that knows it is not. Four of the eleven rules exist for a
specific failure: a price STATE change overrides the percentage rule, because a competitor
withdrawing a public price is not a 0 % move; the LARGEST axis decides a dimension change, not the
average; an image is identified by its URL PATH, because a CDN swaps hosts constantly; and lists are
compared as SETS, because markup gets rearranged.

**The thresholds are rows, tuned per source without a deploy** — `unique nulls not distinct
(source_id, field)`, because PostgreSQL's default would permit a second global default and the
threshold in effect would depend on row order (amendment A29). The editor is on
`/studio/operations/data-quality`, NOT on `/studio/system/settings` where the phase document places
it: that page needs `system.settings.write`, which a researcher does not hold, and a researcher is
exactly who notices a source flooding the queue.

**The nine FEAT §25 actions**, all writing three things in an order chosen for what a crash between
any two leaves behind: the append-only log first, the domain effect second, the queue's decision
stamp last. Compare records an activity event and **nothing else**, and its row is written by the
system rather than by the person — which is what makes `STUDIO_GUIDE.md`'s `research.read`
permission for it real.

**Bulk review runs on the Phase 24 engine**, which is what Phase 24's unavailable registration was
for. All five carry a new `extraPermission` of `research.confirm` on top of `bulk.execute`, so a
researcher cannot reach in bulk what they cannot reach one row at a time.

**Four never-auto-import guarantees, because they fail differently**: the isolation guard's I4 leg,
a new CI gate (`research:check-no-autoimport`) that refuses a catalogue write or a first-party write
import from any research module, a test that runs that gate against a fixture tree containing the
offence, and the seeded confirm-dialog copy plus one quotable sentence in `BUSINESS_RULES.md`. The
RLS suite adds a fifth of a different kind: it counts `products`, `product_media`, `media_assets`
and product audit rows either side of a confirm, proving there is no DATABASE path either.

**One defect found by the tests rather than by an operator.** The append-only DELETE trigger made
`research_sources` undeletable, because deleting a source cascades to its products and thence to
their decisions. The rule is now stated precisely — a decision about a row may not be erased WHILE
THAT ROW EXISTS — and the cascade is distinguished by whether the parent is still visible, which it
is not during one.

### Phase 28 — eleven review findings fixed, and migration `0262`

The merged phase was re-read adversarially. Nineteen findings came back, each was verified by
execution or by SQL rather than accepted, eight were wrong and eleven were real.

**Migration `0262`, applied locally AND to the hosted project,** corrects two CHECK constraints in `0260` that passed what they were written to
refuse — the same NULL-evaluates-to-PASS family `0260` documents once and then broke twice more.
`research_material_lexicon_token_shape` was case-insensitive because `token` is `citext` and citext
overloads `~` to the case-insensitive operator; `has_no_blank_pattern` let a SQL NULL element
through because `btrim(null) = ''` is NULL. Forward-only, because `0260` is applied to both
databases and `db:migrate` refuses an edited migration. Two RLS tests insert the rows that used to
be accepted.

**Three pipeline events violated their own table's constraint** — `moves_somewhere` requires a
from-stage and a to-stage, and `match.ts` supplied neither. `recordEventAtCurrentStage()` is now the
only way those sites record anything. **A merchandiser could not clear a duplicate they were
permitted to clear**, because the audit write went through the session client and the events table
is service-role-only; the two-client model is now explicit — the domain write runs as the person, so
RLS still judges it, and only the event runs as the system.

**Five parser defects, all one species: a confident wrong answer where the design calls for
`AMBIGUOUS`.** A currency word welded to an adjacent number (`chfront` → `CHF`), replaced by a real
ISO 4217 allowlist with a digit-adjacency test; a range invented out of a VAT line or a discount
percentage; a zero guard that tested only the first amount; and a dimension cursor that mis-assigned
the third number of a `W × D × H` triple once a diameter had taken a slot.

**The explorer's severity filter** inlined up to twenty thousand uuids into a PostgREST `in.(…)`
filter, which travels in the query string and would have failed opaquely at a few hundred findings.
Capped at two hundred, most-recent-first, **and the screen says so when the cap bites**. `?row=` and
`?source=` are shape-checked before they reach a `uuid` column instead of throwing a 500.

**The offline gate had the hole it exists to close**: it read `*.test.ts` and nothing else, so a
database import one `import './helper'` away passed — and the commit that added the gate added such
a helper. It now walks each test's import closure (136 tests, 473 modules) and names the test that
pulls the offending module in. Six cases in `tests/unit/db/unit-offline-gate.test.ts` hold it there,
including that indirection.

### CI — the unit project runs without a database again

`main` had been red since Phase 26 merged, through three merges, and the cause was Phase 26's.
`ci.yml` runs `npm run test:unit` as step five — before `db:reset` — with `DATABASE_URL` set for the
whole job, so a unit test that reaches for a cluster does not skip: it connects to a database with
no migrations in it and fails. Phase 26 added two such files; twenty-two assertions failed on every
run. It passed locally every time because a developer's database is already migrated.

Both database suites moved to `tests/unit/rls/**`, the project CI runs after the migrations and the
seed with `RLS_TESTS_REQUIRED=1`, and the twenty-one-expression table they share moved to a module
so the two implementations are still asked the same rows. **`npm run db:check-unit-offline` now
enforces the rule** the workflow had only described — being described in a comment is exactly why it
was broken quietly.

### Phase 28 — Normalization + Validation

The strings Phase 27 extracted become comparable data, and the data is judged before it is trusted.
Three of FEAT §23's seven stages ship: `NORMALIZED`, `VALIDATED` and `MATCHED`. The governing rule is
that **a value Rivya could not parse is recorded as unparsed, never as a guess** — because every
downstream comparison, scale band, opportunity score and shortlist decision inherits that first
judgement, and none of them can tell a guessed figure from a read one.

**Migrations `0260`–`0261`, applied locally AND to the hosted project.** Twenty-three normalisation columns on `research_products`;
`research_validation_issues`, `research_match_candidates` and `research_material_lexicon` (forty
seeded terms, editable in Studio); `research_products_matched_category_fk` — the **second and final**
allowlisted research → public foreign key, closing the allowlist for good; a rewritten
`refresh_research_search_document` so a scraped row is findable in Studio search by its normalised
title; and two backstop constraints mirroring the first-party rules.

**No currency conversion exists anywhere under `lib/scraper/`**, and a test reads every file in that
tree to keep it that way. `$` alone records `AMBIGUOUS` rather than guessing a country. Amounts are
integer minor units read with the source's own separators, because `1.234` is two different numbers
in two conventions and nothing in the string distinguishes them.

**`AMBIGUOUS` stores nothing.** `dimensions_mm` is null unless the parse state is `PARSED`, so no
chart ever reads a millimetre figure arrived at by supposing. The source string survives in the
version's `raw`, where the explorer shows it beside the word "ambiguous" and a person can correct it.

**Every ERROR rule runs before the write, and the database constraints are backstops.** A row that
fails a check is written, kept at `VALIDATED` with the finding attached, listed in the explorer's
Issues view and counted on the data-quality tab — never dropped, never a raised database error, never
quietly promoted on a later run.

**Matching proposes; it never decides.** Auto-merge needs the source's own identifier, or an identical
title and price, or a title above 0.95 with measurements agreeing within 5 %. Everything below becomes
a `research_match_candidates` row a merchandiser decides, and every duplicate flag is reversible with
an audited reversal. Cross-source deduplication stays out of scope on purpose: two competitors listing
similar objects is the signal Phase 31 reads.

**`research.write` corrects a value; `research.confirm` decides an identity** — drawn by the Server
Actions and, underneath them, by `0261`, which makes the candidates table `research.confirm` to write
so a researcher cannot reach the decision sideways. Two of the three new tables have **no insert
policy for any role, owner included**.

**Three defects were found and fixed rather than worked around.** `array_length` on an empty array is
NULL and a CHECK evaluating to NULL passes, so the lexicon's "must have patterns" constraint admitted
exactly the row it refused — caught by an RLS test asserting the refusal rather than assuming it. The
phase document's illustrative SQL puts a subquery inside a CHECK, which PostgreSQL refuses outright;
two IMMUTABLE functions carry what the constraints cannot. And `image_url_unreachable_shape` was
written to catch shapes the draft schema already refuses, which would have made it unreachable — this
phase's own named risk, found by a test.

**Studio.** `/studio/research/explorer` shows raw beside normalised beside provenance, with filters in
the URL and permission-gated correction controls; `/studio/operations/data-quality` gains a Research
tab with issue counts, per-source parse coverage and the material lexicon editor;
`npm run research:renormalize` rolls a lexicon or parser fix over stored evidence with **zero network
traffic**, respecting every hand-corrected field and reporting how many it left alone.

**Verification.** 33 gates green; 2,727 unit and RLS tests pass, including six new normalisation
suites and 39 new RLS cases; production build succeeds against a local PostgREST with both new routes
present. Hosted parity was measured rather than assumed: every column, constraint, index, policy and
trigger is byte-identical, every Phase 28 function and comment is byte-identical, and the only
differences anywhere are two pre-existing cosmetic drifts from Phases 08–25 recorded in
`docs/SESSION-STATE.md`. Amendment **A28** records the six readings the repository forced.

### Phase 27 — Scraper Extraction

The pipeline starts producing structured rows. FEAT §27's adapter architecture is built as an
EXECUTION BOUNDARY with its own record rather than as a hope that nothing throws — because "a broken
source adapter must not break other sources" is a claim about failure, and a claim about failure
needs a record or it cannot be checked.

**Migrations `0250`–`0251`, applied locally AND to the hosted project.** `research_product_versions`
is append-only and deduplicated by content hash, so a page that has not changed produces NO new row
and a page that has produces exactly one — the substrate Phase 29 diffs, and the one thing that
cannot be retrofitted. `research_adapter_runs` is one row per (run, source, adapter): items seen,
extracted and failed, the first five errors with their URLs, and whether the source was ABORTED.
`current_version_id` becomes the foreign key `0231` declared its column for and deferred
(**amendment A27**).

**The adapter contract, and what it deliberately withholds.** `AdapterContext` carries the source
configuration, a URL matcher, a logger and a budget predicate — and no database handle, no `fetch`,
no file system, no Cloudinary client and no clock. An adapter is a pure function from bytes to a
draft; every side effect belongs to the core. That is what makes a vendor adapter reviewable in ten
minutes, safe to accept from somebody else, and impossible to misuse: a `fetch` in an adapter would
be a request that skipped robots.txt and the delay.

**`RawProductDraft` is strings, and a parsed number fails validation.** Every field is the source's
own text — `priceText`, `dimensionTexts`, `availabilityText` — with a per-field `confidence` map
recording what was FOUND rather than defaulted and a `provenance` map recording which strategy read
it. Phase 28 parses, converts and resolves, once, over stored evidence; a draft carrying a number
would put the same parsing in two places, and the second is always the one nobody re-runs when a rule
is corrected.

**The `generic` adapter, first hit wins per field**: JSON-LD `Product` (including `@graph`, arrays
and an `@type` array), then microdata, then RDFa, then OpenGraph, then the source's configured
selectors, then `<title>` and `<h1>` as a last resort. A broken JSON-LD script tag beside a valid one
does not abandon the valid one. `extract()` never throws on malformed input — broken HTML, binary,
an empty string each return a low-confidence draft — because one bad page in a run of four hundred
must cost one item.

**A REAL DENIAL-OF-SERVICE VECTOR, FOUND BY A TEST WRITTEN FOR SOMETHING ELSE.** The contract suite
feeds every adapter a hundred kilobytes of unclosed `<div>` to prove malformed input produces a draft
rather than a throw, and the first time the generic adapter was actually registered the test run hung
indefinitely. `node-html-parser` is super-quadratic in NESTING DEPTH — 500 levels 29 ms, 2,000 levels
791 ms, 4,000 levels nearly six seconds, twenty thousand levels hours — so a page well inside the
fetcher's 2 MB cap, trivially served by anybody who would like Rivya to stop reading them, wedges the
cron invocation. **The CPU budget cannot catch it**: the runaway is one synchronous call into a
dependency with no loop of ours to ask, and JavaScript cannot pre-empt one.
`lib/scraper/adapters/parse.ts` is the answer and the only sanctioned parse in the tree — it
estimates nesting depth in one linear pass, without building a tree, and refuses past 200 levels.
The contract suite now also asserts that no other file imports `parse` from the library, because a
second call site is a second place with no guard, added by somebody writing a vendor adapter who had
never met this failure.

**Four isolation layers, each with its own record.** Per item: a try/catch, a measured budget and a
Zod check, so a throw, an overrun or an invalid draft fails that item and the drain loop continues.
Per source per run: ten consecutive item failures stop THAT SOURCE for the rest of the run and set
`status = 'ABORTED'` — and because a run is drained across many cron ticks, the ROW is what makes
"for the rest of the run" survive the tick boundary. Per source across runs: three consecutive
ABORTED runs open the same circuit five consecutive FETCH failures open, with a `WARNING` naming the
adapter and version. Cross-source: every source's items are leased and executed independently, and
`tests/unit/adapter-isolation.test.ts` interleaves two sources with adapter A throwing on every item
to prove B is untouched.

**Versions, not overwrites.** The content hash is over the DRAFT rather than the page body — two
fetches differing only in a session id are one observation — and it EXCLUDES `confidence` and
`provenance`, so an adapter fix that finds the same value by a different route does not read as every
product on every source changing at once in Phase 29's review queue. Array order is hashed: a
re-ordered gallery is a change.

**A work item is `DONE` when extraction fails, and the host is not asked again.** A work item is a
URL to fetch and it was fetched; retrying would ask a third party's server for a document Rivya
already holds because OUR reading of it was wrong. The failure is accounted on the adapter row and
repaired by `scripts/research/reextract.ts`, which re-runs an adapter over stored snapshots with
**zero network traffic** — enforced by never importing the fetcher, and asserted statically because
the failure it guards against is a future edit.

**Placeholders, not vendors.** `source-a` and `source-b` are FEAT §27's own names, `supports()`
returns false unconditionally, and both are registered so the shared contract suite still runs them.
A new CI assertion in `check-research-isolation.mjs` fails the build on any external host named
anywhere under `lib/scraper/adapters/**`, READMEs included — because an adapter is exactly where a
real competitor's name would first appear, and a real source is a row somebody approved rather than a
literal in a build artefact.

**The run detail screen answers the two questions in the order they are asked**: which source
stopped and did it take the others with it (the adapter panels), then what was read (the versions,
each openable beside the strategy that produced each field). An `ABORTED` source is toned as a
warning rather than a failure, because it is the isolation working. The snapshot is NAMED and never
linked: it lives in a private bucket, and a signed URL rendered on a Studio screen would publish a
competitor's page body from a Rivya origin for as long as the link lived.

**Verified**: 75 migrations apply from clean; local and hosted both report 75 / 68 tables / 232
policies. `npm run test` — **2,499 passing, none skipped**, including 386 across ten new suites and
`tests/unit/rls/phase27.test.ts` (23 cases, every role including OWNER refused a write to either
table). `npm run check` — all **33** gates green, with the isolation guard now naming five
assertions. A production build against the seeded database renders the completed run detail route.

### Phase 26 — Comparator Source Management

Adding a competitor becomes a Studio task rather than an engineering one. All twenty-three FEAT §26
fields are stored, validated, editable and consumed by the Phase 25 engine, and the claim that
matters is proved rather than asserted: `tests/e2e/research-sources-crud.spec.ts` builds a complete
second source through the interface — its politeness settings, three URL patterns, four category
mappings and a schedule — and then asserts `git status --porcelain` is EMPTY. Every behavioural
difference between two sources is a column or a child row; there is no branch anywhere under
`lib/scraper/**` that names one.

**Still zero sources, and still nothing fetched.** This repository ships no source row and seeds
none. `research_sources_enabled_requires_approval` continues to make an enabled-but-unapproved
source unstorable, and Phase 26 adds the workflow around it rather than a way past it.

**Migrations `0240`–`0241`, applied locally AND to the hosted project.** Four enums. Three child
tables — `research_source_url_patterns`, `research_source_category_map`, `research_source_schedules`
— each with its own constraints and audit trail rather than three keys in a jsonb blob nobody can
review. Eight new columns on `research_sources`. Three politeness ceilings tightened to FEAT §26's
numbers (60 rpm, a 1,000 ms floor, four at a time), so the form and the table now refuse the same
values. `0241` is the generated RLS (**amendment A26**).

**FEAT §26 fields 20 and 21 are not columns.** `research_source_health_v` computes last run and
health on read — `DISABLED · FAILING · DEGRADED · STALE · HEALTHY`, in that precedence — because a
cached health value is wrong between the event and the job that would update it, and the moment it
is most likely to be wrong is the moment somebody looks. **`security_invoker = true` is the
load-bearing word in that view**: without it a relation over nine staff-only tables becomes readable
by anyone PostgREST will speak to. The isolation guard gains a fifth assertion for the half a policy
cannot cover — a VIEW has no policies, so its GRANTS are the whole of its access control, and
Supabase exposes a new one by default.

**Six hours, parsed in SQL.** `research_source_schedules_min_interval` calls
`research_cron_min_interval_minutes()`, which reads the minute and hour fields of a five-field cron
expression and returns the smallest gap between two fires — 0 for an expression it cannot read, so
an unparseable schedule is refused rather than sailing through a `null >= 360` that PostgreSQL
treats as satisfied. The rule exists twice on purpose: as a CHECK a server action cannot bypass, and
in `lib/scraper/core/cron.ts` so a form can say what is wrong before the write. A 21-row table runs
both implementations against each other, and the database half really runs.

**The tester makes no request; the probe makes exactly one.** Pasting twenty candidate URLs answers
which pattern claims each and what robots.txt says, entirely from stored configuration and the
cached robots file — a plain GET on the page, so the answer is also a link somebody can share. The
single-URL probe beside it goes through the same fetcher every scheduled run uses, so the delay,
the circuit breaker and robots.txt all apply, and it writes an audit row with the operator's name on
it. The copy says which is which *before* either is pressed.

**EXCLUDE wins, always, whatever the priority.** Folding the four pattern kinds into one ordering
would have made the priority column a way to configure a refusal away — raise a PRODUCT rule to
1000 and start fetching the paths an earlier reviewer wrote an EXCLUDE for, with nothing in the
audit trail saying a refusal had been overridden. An EXCLUDE that will not compile still excludes,
for the same reason: skipping a broken PRODUCT rule fetches less, skipping a broken EXCLUDE fetches
a path somebody wrote a rule to keep Rivya out of.

**An unmapped category is a first-class result, never a guess.** `resolveCategory` matches on a
normalised label and nothing else — no stemming, no synonyms, no defaulting to the first category —
and the dashboard counts what is left over. A row whose Rivya category is later deleted becomes
`UNRESOLVED` rather than vanishing: the observation is evidence, and the decision has to be made
again. **The obvious constraint here was written first and was wrong**, and it is recorded rather
than quietly replaced: `check (category_id is not null or is_ignored)` turned `on delete set null`
back into `on delete restrict`, so a merchandiser could not remove a category because a researcher
had once mapped a label to it. A test wrote the delete and found it.

**D5 gains its narrow, named exception (amendment A26), which was a stated blocker on this phase.**
`research_source_category_map.category_id` is the FIRST of exactly two references from the research
schema into a public one. The distinction D5 was reaching for is between a scraped VALUE and a
STAFF-AUTHORED POINTER: a category mapping is a person deciding that a label on somebody else's
website corresponds to one of Rivya's seven categories, it points at taxonomy rather than at
`products`, and it is `on delete set null`. The guard allowlists it by constraint name and fails on
a third; Phase 28 adds the second and last. The slug-as-text alternative was rejected because it
buys the appearance of isolation with the loss of referential integrity.

**Readiness and policy status are two columns because they are two questions.** A researcher marks a
source READY_FOR_REVIEW — a request, not an answer — and an owner or admin records `APPROVED`,
`RESTRICTED` or `BLOCKED` with a mandatory note naming what they read and when. Both acts need
`research.write` **and** `system.settings.write`, checked as a pair in the server action because RLS
gates a row rather than a column, with the row-level `research_sources_approval_is_attributed`
underneath. The panel carries the standing OWNER_VERIFICATION_REQUIRED statement and offers no
pre-selected decision: the first option is empty, so submitting without choosing is refused rather
than recorded as approval.

**The cron grammar left a `server-only` module and the adapter registry arrived a phase early.**
`parseCronField` and `nextCronRun` moved to `lib/scraper/core/cron.ts` — pure, no marker — because
Phase 26 needs the same grammar inside a form validator a Client Component reaches;
`workflows/schedule.ts` re-exports both so no caller changed. `lib/scraper/adapters/registry.ts`
holds a DESCRIPTOR — key, version, capabilities, `supports()` — with exactly one entry, because
FEAT §26 field 11 requires the adapter key to resolve and a picker with nothing to list is not a
picker. Selecting an adapter whose `supports()` rejects the base URL needs an explicit tick, and the
tick lands in the audit row.

**Verified**: 73 migrations apply from clean; local and hosted both report 73 / 66 tables / 230
policies, zero `anon` policies on any research table, zero anon grants on the health view, exactly
one allowlisted boundary-crossing foreign key and zero source rows. `npm run test` — **2,158
passing, none skipped**, including 334 across six new unit suites and `tests/unit/rls/phase26.test.ts`
(24 cases: the view refusing `anon` outright, the view hiding rows from an `editor` *because* it is
`security_invoker`, and every constraint a form must not be the only thing enforcing). Two new e2e
specs. `npm run check` — all **33** gates green. A production build against the seeded database
renders all three new routes.

### Phase 25 — Product Scraper Foundation

Rivya gains the machinery to read a competitor's website — politely, on a schedule, under a kill
switch — and to store what came back somewhere a visitor can never reach. It extracts nothing
structured (Phase 27) and normalises nothing (Phase 28). What it had to get exactly right is the
politeness posture and the isolation invariant, because both are far harder to retrofit than to
build.

**Nothing is fetched from anybody's website until three separate gates are open**: an owner has
recorded a policy review approving a source, that source is enabled, and the `research_enabled`
flag is on. This repository ships **zero** source rows and seeds none — a source is an assertion
that Rivya may read a real third party's site, and that judgement is the owner's, not this
software's. `research_sources_enabled_requires_approval` makes an enabled-but-unapproved source
unstorable, so the question cannot be skipped by a bug, a fixture or a migration.

**Migrations `0230`–`0234`, applied locally AND to the hosted project.** Six enums; nine tables;
the lease function; the research search index filled by trigger. `research_products` carries the
seven FEAT §23 stages with rejection as a SEPARATE column, so a rejected row keeps the stage it
reached and "how far did this get before we said no" stays answerable. `research_work_items` is the
unit of progress rather than the run, because a Vercel function is short-lived and a run must
survive a cold start halfway through. `0233` is the generated RLS and `0234` corrects a constraint
Phase 23 wrote before it could know better (**amendment A25**).

**The politeness posture, and every control fails towards fetching less.** One user agent, named
and with no fallback — a missing `SCRAPER_USER_AGENT` throws rather than crawling anonymously.
robots.txt fetched once per host per day, parsed for the Rivya token then `*`, with a `Disallow`
meaning **no request is made at all** — and `research_fetches_disallowed_has_no_response` makes a
row claiming otherwise unstorable. `Crawl-delay` honoured as a FLOOR and never a ceiling. Rate
limit, delay and concurrency enforced in the lease query rather than by `sleep()` calls a killed
function loses. Exponential backoff with jitter, `Retry-After`, and a circuit breaker at five
consecutive failures. The kill switch checked before EVERY fetch, not once per tick.

**Four permanent prohibitions, enforced by a build gate rather than by a document**: no headless
browser, no proxy rotation, no CAPTCHA solving, no browser impersonation. If a source requires any
of them to read, the answer is that Rivya does not read it.
`scripts/research/check-research-isolation.mjs` fails on an import of any of that tooling anywhere
under `lib/scraper/**`.

**Isolation invariants I1–I4, and the gate is the phase's most important artefact.** No foreign key
crosses the research/public boundary — the allowlist is EMPTY at this phase and gains its first
entry in Phase 26. No `research_*` table has an `anon` policy. No research identifier appears
anywhere under the public trees. Nothing connects `lib/scraper/**` to a catalogue write. Each was
proved to fail on a real violation — a planted foreign key, a planted anon policy, a planted
identifier, a planted `puppeteer` import, a planted cross-import — and to pass once restored.

**Verified against a real fixture HTTP server**, which is the only way the important claims can be
checked: robots.txt was requested exactly once and served from cache thereafter; `/private` was
recorded `DISALLOWED` and **never appears in the server's own request log**; the gap between two
fetches honoured the host's 1-second `Crawl-delay` over the source's configured 250 ms; the kill
switch produced zero requests; and a `429` with `Retry-After: 30` returned the item to the queue
with a two-minute backoff, because the ladder beats a number supplied by the server we are already
struggling with.

**Snapshots go to a private Supabase Storage bucket, never Cloudinary.** Gzipped,
content-addressed, date-partitioned, 180-day retention, pruned by the same cron. Cloudinary serves
from a public CDN, and a competitor's page body must not be served from a Rivya origin.

**Also fixed here**: `tests/unit/rls/function-grants.test.ts` never loaded the fixture and had been
passing on the luck of file ordering — adding one suite to the project was enough to break it. And
that same suite caught four SECURITY DEFINER trigger functions this phase had left callable by
`anon`, which is a gate written two phases ago failing on code written today.


### Phase 24 — Bulk Management

One engine, one audit trail, one undo window. Eleven registered operations across three modules —
nine for products, three for media, five for research registered unavailable until Phase 29 — all
running through `lib/bulk/run.ts`, because what stops a second bulk path being written is not a
convention but the fact that an operation without a `bulk_operations` row has no preview, no
confirmation token, no per-item snapshot and no undo.

**Migrations `0220`–`0221`, applied locally AND to the hosted project.** `bulk_operations` stores
the exact id list that was previewed, so Apply re-reads it rather than trusting the request and a
stale tab cannot apply a preview built from a different filter. `bulk_operation_items` holds the
per-item before/after that makes the 24-hour undo real and keeps the audit log readable — one
`audit_logs` row per operation, five hundred item rows behind a link. `bulk_imports` and
`bulk_import_rows` record what an uploaded file contained; the file itself is not retained after
apply. `0221` is the generated RLS: four shape-C tables, read under `bulk.execute`, and not one
write policy between them — every write goes through the service role after `requirePermission`, so
a signed-in merchandiser cannot hand-write a preview nobody previewed or edit the `before` snapshot
undo re-applies. Delete is revoked on the two record tables twice over, in policy and in grant: the
account of what somebody did to a page of live content is not erasable by the person who did it.
`0221` is one past the phase document's allocation, for the reason A23 gave for `0214` (**amendment
A24**).

**Four steps, always: Select → Preview → Confirm → Apply.** The preview writes nothing and reports
per row what would happen and why not — a product that is not ready to publish is excluded with the
readiness items it is missing named, rather than counted. A destructive operation then asks the
operator to type the ROW COUNT as digits: a fixed word becomes muscle memory inside a week, and the
number cannot, because it is different every time and it is the one fact they most need to have
registered. The dialog disables a button; `lib/bulk/run.ts` re-checks the count against one it
computes itself and refuses the request, because a Server Action is an HTTP endpoint.

**Undo, and the honest version of it.** Every applied item records the `updated_at` the operation
LEFT the row at; undo re-applies `before` only where that still matches and reports the rest by id.
Getting that value from the wrong side of the write is a bug that no unit test caught and running
the engine against a real database did: undo skipped every row it had itself changed and blamed an
edit nobody made. The regression guard is an ordering assertion — read, write, read — and the
reading is recorded in **A24**.

**New gates.** `scripts/bulk/check-bulk-registry.mjs` parses every `registerBulkOperation` literal
and fails the build on a preview that writes, a missing Zod schema or destructive flag, or any of
the four operations that must be destructive being marked otherwise. It is wired into `npm run
check` and into CI, and was proved to fail on both violations before it was trusted.
`db:check-data-layer` joined `npm run check` in the same edit — it ran in CI and not locally, which
is how Phase 23 reached main red.

**The local PostgREST shim now mints a service-role key** alongside the anon one. From this phase
onward half the write paths have no session at all, and a shim that could exercise the reading half
of the application and none of the writing half is a shim that hides exactly the bugs this phase
found.


### Phase 23 — Global Search + Product Relationships

Everything Rivya has published is findable, and the connections between things are data rather than
inference. `/search` stops returning the Phase 10 placeholder and starts returning grouped, ranked,
paginated results; the header gains an ARIA 1.2 combobox that degrades to a plain GET form; the
Studio palette gains eight entity providers; and `product_relations` — an edge with no vocabulary
since Phase 03 — gets a fixed nine-name relation model, a second table for non-product sources, four
stated suggestion rules that propose but never write, and a workspace where an editor accepts,
dismisses or removes every one of them.

**Migrations `0210`–`0214`, applied locally AND to the hosted project.** `search_documents` holds one
flattened document per indexed entity, with an `entity_type` CHECK naming the exact eight permitted
values — so a research row cannot be inserted by a bug, a migration or a well-meaning later phase —
and a second CHECK making the three Studio-only types structurally incapable of being `PUBLIC`.
`research_search_documents` is created EMPTY beside it with no `anon` policy, two phases before the
subsystem that fills it, because a boundary is far cheaper to build than to retrofit.
`search_queries` records what was typed and how many rows came back, with no IP, no user agent, and
a CHECK refusing an actor on a public search. `0213` adds `content_relations`,
`relation_suppressions` and `product_attribute_terms`, and gives `product_relations` its four new
columns and its vocabulary constraints. `0212` and `0214` are the generated RLS — two files rather
than one, because a generated policy file is rewritten whole and cannot also carry the DDL that
creates its tables (**amendment A23**; `0214` is one past the phase document's allocation).

**The index is a trigger, not a job.** `refresh_search_document()` is `security definer` and is the
only writer: `search_documents` has no INSERT or UPDATE policy for any session role, so a signed-in
member of staff cannot hand-write a search result carrying a title, a URL and a picture that the
entity itself does not say. Eleven trigger functions call it, including on the two product join
tables (a material attached later changes what the product should match) and on both category tables
(a rename changes every child's keywords).

**What an inquiry document contains, and the list is exhaustive:** reference code, enquiry kind,
related product title, pipeline status. `tests/unit/rls/phase23.test.ts` inserts an enquiry carrying
a name, a phone number, an email address, a city and a message, and asserts none of the five appears
anywhere in the indexed row. A Studio search result is the thing most likely to end up in a
screenshot.

**Four suggestion rules, and none of them writes.** `same-collection`, `shared-materials` (two
shared materials, not one — almost everything here contains resin), `journal-linked-product` (an
actual link, not a title mention) and `project-featured-product` (the forward edge already exists and
somebody made it by hand). `lib/relations/rules.ts` takes a client it only ever reads with; a test
asserts the module exports no function whose name suggests a mutation and that its source, comments
stripped, contains no `.insert(`, `.update(`, `.upsert(`, `.delete(` or `.rpc(`. Every persisted edge
carries `origin`, tied to `rule_key` in both directions by a CHECK.

**Three things running the site found that reading the migration did not.**

- `search_documents_query` is SECURITY INVOKER, so it executes as the caller — and `rv_unaccent` had
  been revoked from `anon` along with everything else, which made every public search fail with
  `permission denied for function rv_unaccent`. Granted back by name, on 0143's own reasoning for
  `is_valid_dimensions`.
- A tsquery matches whole lexemes, so typing `re` suggested nothing until the whole word was typed —
  a type-ahead that only matches finished words is not a type-ahead. `p_prefix` builds a `:*` query
  from tokens the function itself extracts (`to_tsquery` raises on malformed input, unlike
  `websearch_to_tsquery`, so no character the caller typed reaches the parser). The results page
  leaves it off and relies on the trigram fallback, as the phase document specifies.
- The generated `search_vector` refused `array_to_string`, which is STABLE because it is generic over
  every array type. `rv_keyword_text(text[])` narrows it to the one type where the claim is true.

**A bug the tests caught before anything shipped.** `inverseOf` derived the inverse edge's relation
type from the ORIGINAL TARGET, which produced a project claiming to be a portfolio project of itself
— a plausible-looking row nobody would have questioned. A relation type names what is at the far end,
and the far end of the inverse is the original SOURCE.

**And a fourth, which CI found and the local `npm run check` could not.** `db:check-data-layer`
runs in CI but was not in `npm run check`, so the first push of this phase went out with
`lib/relations/**` and the relationship workspace holding their own `.from()` calls — the Phase 03
rule that every query lives in `lib/supabase/repositories/**`. Fixed by moving all of it into
`relations.ts`, which turned out to be the better shape anyway: the filters a suggestion rule could
most easily get subtly wrong (an unpublished sibling, a collection still in concept) now sit
together beside the queries rather than being spread across four rule functions. `db:check-data-layer`
is now in `npm run check`, so the next phase cannot repeat it.

**Gates.** `npm run search:check-scope` walks the import graph from the four public search entry
points and fails on `research_`, `researchProduct`, `researchSearch` or `scraper`; it is in
`npm run check` and in CI, and it is proved to fail by adding a research identifier to
`lib/search/query.ts`. The island budget moved from five to six with `SearchCombobox` named, because
a gate whose number moves silently is not a gate. `tests/unit/rls/function-grants.test.ts` grew from
"every anon-callable function must be SECURITY DEFINER" to "must be definer-with-a-pinned-path or
invoker", which is what that rule always meant: an invoker function holds no privilege to escalate.

**What is empty, and that is the shipped state.** `product_attribute_terms` has zero rows and no seed
module writes it. Public search returns categories and journal articles on a seeded database and no
products, because the seed creates none. A published piece with no connections renders Phase 15's
honest "More in {Category}" fallback; Phase 23 gives editors a way to replace that with real edges
and does not upgrade the fallback's label.

**Not built:** drag reordering in the relationship workspace. The reorder action, its audit row and
its permission check all exist; the pointer interaction does not, and it would be that page's first
client island. Recorded in STUDIO_GUIDE §7.5 rather than implied.


### Fix — CI runs again, and what its first honest run found

The repository went public on 2026-09-10 and GitHub Actions scheduled a runner for the first time
since 9 September. Every run before that had been red — first for real reasons, then because no
runner was assigned at all — so the merge of Phases 21 and 22 was the first `verify` job to execute
in a day and a half, and it failed on things the local `npm run check` never ran. Each is fixed
here rather than waited out:

- **The unit step ran the RLS project against an unmigrated database.** `DATABASE_URL` is a
  job-level variable so the database gates can run, and `vitest run` therefore also ran the RLS
  project at step nine — twelve steps before `db:reset`. The step now runs `npm run test:unit`
  (the unit project only); the RLS project runs where it always did, after the migrations and the
  seed, with `RLS_TESTS_REQUIRED` so a skip is a failure.
- **The idempotency step asserted a shape the runner stopped reporting in Phase 09.** It required
  the second seed to report `updated` equal to the first run's `inserted`; the runner has reported
  those rows as `unchanged` since it gained that outcome, so the step could never pass. It now
  asserts inserted 0, updated 0, unchanged equal to the first run's inserted.
- **The seed failed on a database whose media rows were never imported.** The ten journal covers
  bind Higgsfield assets by `rivya_asset_id`; CI's PostgreSQL has no `media_assets` rows, because
  the Higgsfield migration needs Cloudinary credentials CI does not hold, so `seed:content` failed
  every one of them. The runner now distinguishes the two states its own comments already named:
  an id the manifest does not carry is a typo and fails the run; an id the manifest carries but
  this database does not is a `media gap` — left null, reported, never substituted — and the next
  seed after the migration binds it (`applyRecord` compares media columns on an otherwise
  unchanged row). CONTENT_GUIDE §8 says the same.
- **Three design gates were never in `npm run check`.** `design:check-tokens` found ten hex
  fallbacks in `components/three/presets.ts` (Phase 21) and two arbitrary-value classes from Phase
  19; `design:check-registry` could not find RC-401 because the viewer lives in `components/three/`;
  `design:check-utilities` found `text-tertiary` (Phase 22) and three hyphenated words in Studio
  copy that read as Tailwind prefixes. The presets now carry tokens only — `resolveTokenColour`
  returns null where the document has no value and three's own default shows the mistake — the
  registry gate knows `components/three/`, the class and the copy are corrected, and all three
  gates are in `npm run check` so this cannot recur unseen.
- **The build had never run in CI, and could not have.** `next build` pre-renders the public
  site, and pre-rendering reads content through PostgREST; the job had no
  `NEXT_PUBLIC_SUPABASE_URL`, so the first build ever to execute here (run 152) died collecting
  page data for `/collections/[slug]`. The step now runs after the seed, against the PostgREST
  that `scripts/db/local-rest.mjs` starts over the job's own database — the tool Phase 10 used
  to verify the site without a Supabase project — with the binary pinned by version and
  checksum and a throwaway key minted per run. No hosted project and no repository secret are
  involved, and `security:check-bundle` now inspects a real `.next/static` rather than a
  missing one.

### Phase 22 — Homepage / Store Merchandising

The owner takes the controls. Which products appear in Selected Works and in what order, which
collections are featured, how the store's seven categories are ordered, which pieces are pinned
inside a category, and when each arrangement starts and stops — all of it is now a Studio decision
with a schedule, and none of it is written in code. **The catalogue still ships with zero published
products, so every slot resolves to its fallback**, and the more important half of the phase is what
that looks like: editorial tiles with no price and no product link, or nothing at all, never a
placeholder card.

**Two tables, eleven slots, one ladder.** Migration `0200` creates `merchandising_slots` and
`merchandising_entries` and inserts the eleven slots as structure — four global
(`HOMEPAGE_SELECTED_WORKS`, `HOMEPAGE_FEATURED_COLLECTIONS`, `HOMEPAGE_JOURNAL_STRIP`,
`STORE_FEATURED_ROW`) and one `CATEGORY_PINNED_<SLUG>` per D3 category, the latter by a trigger on
`categories` so a category added later brings its slot with it. Each slot has exactly one surface
and exactly one owning Studio screen; there is no reusable slot. `lib/cms/merchandising.ts`
resolves a slot in five ordered steps — live entries, re-checked targets, the curated list if it
reaches the minimum, a recency top-up if the owner switched it on and wrote the rule in words, else
the fallback mode — and returns provenance (`CURATED` · `RULE_FILLED` · `FALLBACK`). There is no
sixth step, and `merchandising-register.test.ts` reads the resolver's source to keep "popular",
"trending" and "random" out of it.

**The seam held.** `selectProducts` and `selectArticles` kept their signatures and gained a slot-
backed body; no renderer changed for the swap. Afterwards, separately, `SelectedWorksSection`,
`JournalStripSection` and the new `FeaturedCollectionsSection` learned the three fallback modes:
`HIDE_SECTION` removes the band, heading included; `EDITORIAL_BLOCK` renders the seeded sentence
and tiles drawn from a named section (by default the page's own material story) with a CTA only to
`/large-format`, `/collection` or `/custom-commissions`; `SHOW_EMPTY_STATE` is the Phase 11 sentence
alone. `featured-collections` is the catalogue's 34th block (amendment A22) — a reference block
with no query of its own, addable on `/` and `/collection`, not seeded. `MerchandisedRow`
(RC-243) draws the two slots with no block to live in — the store's featured row and a category's
pinned region — beneath the page's sections, with `global_content` headings.

**The database refuses what the ladder could never keep.** An entry must name a type its slot
admits and an entity that exists; a collection still in concept is refused at the row, so a
crafted POST fails as the picker's list does; a window must close after it opens; `auto_fill`
cannot move without a rule. `merch_move_entry()` is SECURITY INVOKER and moves one place
atomically. `merch_run_schedule()` is the merchandising pass the content-schedule cron gained:
it records each window transition in `activity_events`, archives an entry whose window closed, and
returns the paths to revalidate — never putting anything on or off the site by itself, because the
resolver and the generated RLS clause honour every window on every read.

**Four Studio screens.** `/studio/merchandising/homepage` (Selected Works, the journal strip, the
featured band read-only, the hero still and the Selected Works heading under `content.write`),
`/store` (category order one place at a time, refused once with the SEED §56 warning and allowed
on an acknowledged second submit, *Restore recommended order*, and each category's pinned slot
beside it), `/featured` (published, owner-confirmed collections only, with the reason inline) and
`/scheduling` (a month table of live entries per slot per day, gaps and overflows marked, the
windows that open or close, a jump to the owning screen). One slot editor serves all three
writing screens: entries with move, pin, release, remove and window controls; a picker of
published entities; settings; and the resolver's own answer as the public preview. Every form
posts the screen it was drawn on and the action refuses a slot owned elsewhere. Every write is
audited, in the activity feed, and followed by a revalidation of the slot's surface.

**Gates and tests.** `npm run cms:check-copy` now reports a `/product/<slug>` literal in any
renderer or pattern. 1,534 tests across 116 files, none skipped — 32 new: the ladder and the
fallback output (`merchandising-resolve`), the register level with `0200` and the
no-behavioural-word rule (`merchandising-register`), and the Phase 22 RLS suite. Two e2e specs'
worth of walks in `merchandising.spec.ts`, skipping with a stated reason where the Studio
credentials or the products are absent. Migrations `0200`–`0201` applied locally and to hosted;
44 tables, 175 policies, 215 seeded strings on both.

### Phase 21 — 3D Product Experience

A visitor can pick an object up and turn it over — where a model exists, and none does yet. The
phase ships the whole capability with **zero models**: the manifest holds no GLB, none is generated
(a model has a form and dimensions, which is a product specification, D10), and the first upload
path for one now exists, inspected before it is saved.

**The viewer costs the page nothing until it is asked for.** Routes import the mount through
`LazyModelViewerMount` (`next/dynamic`, so the mount's own client half is an on-demand chunk and
not a homepage island — the island-budget gate stays at five), and `components/three/**` is reached
only through that island: a dynamic import with `ssr: false`, on a press of the poster's
control or on an intersection the capability probe allows (viewport ≥ 768 px, motion not reduced,
`saveData` off, `deviceMemory` ≥ 4, WebGL present). A new gate, `scripts/perf/check-bundle.mjs`,
walks every route's client import graph and fails on any `three`, `@react-three/*` or
`meshoptimizer` specifier — proved to fail on a planted import — and is in `npm run check` and CI.
The chunk measures **303.6 kB gzipped** against the 350 kB budget; a first measurement of 391 kB
found `zod` in the graph, so the viewer now reads a zod-free `lib/media/viewer-settings.ts` and a
unit test keeps it that way.

**Every FEAT §12 control has a pointer, touch and keyboard route.** Orbit, zoom, pan, reset,
fullscreen, finish inspection, variant switching, dimension indicators, four lighting and three
environment presets built from Phase 02 palette tokens with no HDR and no fetch. The canvas is
`role="img"` with a name and a description that lists every key; fullscreen is a fixed surface with
a focus trap; under reduced motion there is no auto-rotate, no damping and no intro. Draco is
served from `public/draco/`, the Basis transcoder from `public/basis/` (only for a KTX2 texture),
meshopt bundled — all vendored from `three@0.186.0`, licences recorded as RC-905/906/907.

**Metadata is parsed, never typed.** `lib/media/inspect.ts` reads a GLB's JSON chunk without a
decoder — bytes, extensions, declared triangles, textures, variants, self-containment — so the
browser refuses a 20 MB uncompressed file with both reasons named before anything is signed.
`saveModelAction` then reads the uploaded bytes back from the delivery origin, runs the decoder
pass (gltf-transform, the Node Draco decoder, the same meshopt module the viewer bundles), writes
`model_format`, `file_size_bytes`, `poly_count` and `texture_count` from what it read, and
destroys a refused file rather than recording it. The same ceilings are CHECK constraints in
migration `0194`.

**D10 at the finish switcher.** `model_variant_labels` gives each `KHR_materials_variants` key words
a visitor can read. A label that also names a `materials` row asserts that material is in a real
object, so the CHECK forces it to at least `OWNER_VERIFICATION_REQUIRED`, the Phase 08 authority
trigger keeps `VERIFIED` for the owner and admin, and the public read hands the material to the
viewer only at `VERIFIED`. Dimension indicators receive values the server parsed from
`products.dimensions` and the component that prints them imports no engine — asserted on its source.

**A poster gates association, not existence.** A model may be uploaded and inspected with no
poster; it may not be attached to a product or a project without one, because the poster is what
every page renders first and is the LCP element by contract. Posters are chosen from the image
library, never captured from the viewer (amendment A21). `set_model_association()` writes both
sides of a product association in one `SECURITY INVOKER` transaction, so an editor who holds
`media.write` but not `catalog.write` fails as a whole rather than leaving the asset pointing at a
product that does not know it.

**Studio.** `/studio/media/models` fills its 3D half: the uploader with the inspector in front of
it, a list of what was read, and a drawer with re-inspect, poster and thumbnail, viewer settings
with the real viewer as live preview, finish labels and association. Four mount points on the site:
the product page, the `three-d-resin` block's slot, the project page and `/collection/3d-resin`.

**Also in this phase.** Migrations renumbered to `0194`–`0195` (amendment A21); React pinned at
19.2.8 while `@react-three/fiber` caps it below 19.3; the flag is `three_d_viewer`;
`scripts/seed/emit-sql.ts` emits the runner's `global_content` INSERTs with their hashes for a
database `DATABASE_URL` cannot reach — which found and closed a 56-row gap on the hosted project
(31 Phase 17–20 strings had never been seeded there). Migrations applied to hosted through the
Supabase MCP; 42 tables, 165 policies on both.

### Phase 20 — Inquiry + WhatsApp Flow

The conversion model becomes real, and becomes safe. Every enquiry — from the contact form, from a
product page, from the Phase 19 configurator — is validated, written to the database and given a
reference code **before** anything else happens. Only then is a WhatsApp message composed from the
seeded template and the visitor offered the handoff. If the write fails the visitor stays where they
are, and there is no URL to navigate to because the failure branch of the returned union has no such
property.

**`inquiries` is the only table on this site a stranger may write, and the only write with no
session behind it.** D1 forbids customer accounts, so the person filling in the form is nobody: the
`with check` on the anon INSERT policy is doing the work `requirePermission` does everywhere else.
It pins the enquiry to the start of the pipeline, unassigned, with no claimed editor and no claimed
handoff — each of the four probed with a payload that tries to set it.

**There is no anon SELECT on any of the three tables, and that absence is the most load-bearing line
in the phase.** An enquiry carries a name, a phone number, a city and whatever a visitor chose to
say about their home; one `using (true)` and the customer list is a GET away through PostgREST with
the publishable key that ships in every browser.

**Which turned up the finding that shaped the whole write path.** PostgreSQL applies the SELECT
policy to an INSERT's RETURNING clause, so on this table the insert succeeds and the read-back is
refused — with `new row violates row-level security policy`, a message that reads exactly like a
rejected write and is not one. The right answer is not to give `anon` a select policy: "its own row"
is a claim the database cannot check. The application generates the id, and
`inquiry_reference_code()` returns the trigger-allocated code for an enquiry created in the last ten
minutes (amendment A20).

**The reference code is allocated by a trigger that OVERWRITES what arrived.** A code a caller could
choose is a code a caller could collide with, enumerate, or use to claim somebody else's enquiry in
a WhatsApp message.

**Phase 10's two-step shortener is replaced by the five-level ladder the phase document
specifies.** "The longest field" is not "the least valuable field": a 400-character requirements
note is the most valuable thing in the message and was the first thing the old version cut. Empty
label lines go first, then the summary is capped at eight with a count, then the notes are trimmed
on a word boundary, then the reference URLs become a count, and only then does the message fall back
to the essentials — which are re-rendered from the SAME template with the other tokens emptied, so
level five invents no words. The reference code survives every rung.

**The append-only log could not be deleted, and the RLS suite is what found it.**
`inquiry_events` refused UPDATE and DELETE outright — including the CASCADE from `inquiries`, which
made deleting an enquiry impossible for anybody, superuser included. "Nothing deletes an enquiry" is
a rule about the Studio and is enforced there; it was never meant to make an erasure request
impossible. Migration `0193` narrows the trigger: an event may go only when its enquiry is already
gone.

**`contact-form` is the first block in this repository to be PROMOTED from planned to built.** Its
fields are fixed and its enquiry types are not: the six inputs map to columns `inquiries` actually
has, so an editor cannot add a seventh — a form whose fields are configurable is the configurator,
which has its own tables.

**The product enquiry needs no dialog.** Phase 15's rail already links to
`/contact?product=<slug>&type=product`; the form reads the slug after mount, like the configurator's
`?step=` and for the same reason, and files the enquiry against that product. A slug that no longer
resolves files a GENERAL enquiry rather than refusing one — a piece withdrawn between the page
opening and Send is not a reason to lose a brief.

**The configurator's Submit is live, and Phase 19 needed no unpicking.** Passing the new `submit`
prop is what turns it on; without it the island still renders the disabled button. The contact
answers are read out of the brief BY FIELD TYPE rather than by key, because `contact_name` is what
the seeded templates call it and a form the owner built may call it anything.

**The export omits `ip_hash` and `user_agent`, and the omission is at the query.** Export needs
`inquiries.export`, not `inquiries.read`: reading an enquiry leaves it where it is, exporting puts
every customer's phone number in a file that leaves the building the moment somebody emails it.
Every export is audited, refusals included.

**`commission_configurator` is switched on** on both databases, which is this phase's exit
criterion. The three commission templates remain DRAFT, so nothing appears on `/custom-commissions`
until the owner publishes one — the flag says the feature is built, and publication stays editorial.

### Phase 19 — Bespoke / Custom Configurator

The studio can now be asked for something it has not made. Eleven steps, one screen each, every
question read from `customization_form_steps` and `customization_form_fields` — FEAT §15's "every
step configurable from Studio" taken literally: the component asks no question of its own, and the
validation is generated from the same rows the questions come from, so a field an owner adds is
validated without anyone writing a schema for it.

**Nothing in this group can hold a price, and the door is closed at the schema.**
`customization_form_fields.validation` carries an allowlist CHECK — nine Zod keys — so
`price_multiplier`, `surcharge` and `cost_per_mm` are rejected by the same expression that keeps the
object Zod-shaped. There is no money in the field-type enum either. `tests/unit/no-pricing.test.ts`
greps the migration for a pricing column and is itself mutation-tested, because a guard that passes
against a deliberately broken copy of the schema is not a guard.

**The whole configurator ships behind a flag that is OFF, and that is the phase working as
written.** Phase 19 ends at a validated payload; D1 requires an inquiry to be persisted before any
WhatsApp redirect, and persistence is Phase 20. So the Submit button on the review step is rendered
disabled with no handler at all — a working one would either drop the brief or hand a visitor to
WhatsApp with nothing saved — and `/custom-commissions` keeps its Phase 09 copy until Phase 20's
exit criteria switch `commission_configurator` on.

**A refusing trigger cannot survive PostgREST, so the ordering trigger repairs instead.** Studio
writes one row per statement per transaction: reordering ten steps means ten transactions, nine of
them transiently illegal, and `deferrable` does not help because "deferred" means "at commit" and
each statement commits alone. `normalise_form_step_order()` renumbers rather than refusing, and
forces the contact step last; `cms_set_form_step_order` assigns every position in ONE statement so
the repair pass has nothing to correct and a single reorder writes half the revision history.

**A form cannot be published without somewhere to reply to.** `enforce_form_publishable()` refuses
PUBLISHED for a form with no enabled `contact` step, a contact step asking for neither a phone number
nor an email address, or an enabled choice question with no choices. The builder states all three
above the publish button and re-computes them in the action, so every failure is reported at once —
the trigger stays the rule, and if the two ever disagree the trigger wins.

**`app/api/inquiries/upload-sign` is unauthenticated by design, so its rate limit could not wait for
Phase 41.** A visitor filling in a brief has no account and D1 forbids giving them one; an
unauthenticated endpoint minting upload credentials with no ceiling is an open file host with
Rivya's Cloudinary bill attached. Migration `0182` brings `rate_limit_buckets` forward in the shape
DATA_MODEL already specified, `consume_rate_limit()` counts and decides in one statement so two
concurrent callers cannot both be the last one under the limit, the bucket key is a salted hash
rather than an address, and it fails CLOSED (amendment A18).

**Feature flags are evaluated server-side and the register lives in the code.** A flag evaluated in
the browser is a flag the browser can be told to ignore; here an off feature is absent from the
response rather than hidden in it. `lib/flags/flags.ts` holds the register so a flag key is an
identifier that breaks its call sites when removed, and `feature_flags` holds only the flags
somebody has touched — absent is off, so a fresh database, a restored backup and a preview branch
behave identically with nothing seeded. `/studio/system/flags` is readable by all six roles
deliberately: the register is how anybody accounts for a surface that is missing (amendment A17).

**The builder is one collapsed column, not two panes, and there is no live preview** — amendment
A19. Mounting the real configurator inside the Studio would overwrite a visitor's `sessionStorage`
draft in the same browser and spend the rate-limit allowance protecting the upload endpoint. It
links to `/custom-commissions` instead and says so on screen. *Duplicate from template* IS built, as
`cms_duplicate_customization_form()` (`0184`): the whole copy in one transaction, because three
PostgREST writes are three transactions and the interruption between the steps and the questions
leaves a form that looks finished and asks nothing.

**Two Zod findings worth keeping.** `z.object` decides a key is optional from whether its INPUT type
admits `undefined`, and for an optional key that is MISSING it skips validation entirely — so
`z.preprocess(fn, schema.optional()).refine(v => v !== undefined)` never runs, and a required field
whose key was absent passed. `unansweredRequired()` now checks presence outside the schema. And
`\b` creates no boundary before `_`, so the pricing grep could not match `price_modifier`; both
mutations now fail the test that missed them.

**Three commission templates seeded, none published** — `FURNITURE`, `PRESERVATION` and
`THREE_D_RESIN`, the last two `OWNER_VERIFICATION_REQUIRED` because their manufacturing and
preservation options are not confirmed. 33 steps and 40 questions between them, and exactly one
SELECT: `project_type`. Every other choice is left open, because a list of options is a claim about
what the studio makes.

### Phase 18 — Journal

Rivya gains an editorial surface. Nine SEED §19 categories and ten SEED §20 article IDEAS — a title
and an angle each — and **not one line of article prose written by this repository**. §20 says it in
capitals: seed as DRAFT, do not publish automatically. Several of those titles ask questions only
Rivya can answer.

**The seed's field names were wrong, and the mistake was a publishing one.** The nineteen records
were authored in Phase 09 against a table Phase 18 had not yet created, and they put each article's
ANGLE — the studio's internal brief for whoever writes the piece — into `excerpt`. `excerpt` is what
a card renders. Those ten briefs would have appeared on `/journal` as summaries the moment anything
was published. The angle now lives in `angle_note`, which nothing renders, and `excerpt` is null:
a summary of an unwritten article is a summary of nothing.

**`reading_minutes` is derived by a trigger, which is what "never typed" has to mean.** The phase
document says the value is computed at 200 words per minute; leaving that to the application makes
it derived only on the paths that remembered. `set_article_reading_minutes()` overwrites the column
on every write from the linked page's visible sections — probed: 999 written, NULL stored. NULL
rather than 1 when there is nothing to read, because "1 min read" over an empty article is a claim
about a body that does not exist.

**An article cannot be published without a body.** The risk table assigns that guard to
`lib/cms/publishing.ts`; `enforce_article_has_body()` is the copy that cannot be bypassed. No page,
an empty page, and a page whose only section is hidden are all refused, each naming the article. It
does not judge whether the prose is any good — a trigger pretending to make that call would refuse
work for reasons nobody could predict.

**`journal_articles` is the only table on the site whose public read is gated by a date.**
`published_at <= now()` alongside the status. A piece set to appear on a given morning must not be
readable before it, and the clause is the guard that does not depend on a cron running at the right
minute. That is also the whole scheduling mechanism: publishing with tomorrow's date puts the
article live tomorrow, so there is no separate schedule button because there is no separate act.

**One automatic related rule, and `lib/cms/related.ts` is where it is written down.** Curated edges
always win; when there are fewer than three, the shortfall fills from other published articles in
the same primary category, newest first, excluding this one and anything a curated edge already
points at. No similarity scoring, no personalisation. The two groups render under separate headings
— "Related" for what a person chose, "More in {category}" for the fill, which states a fact rather
than implying a judgement nobody made.

**Categories seed PUBLISHED, articles seed DRAFT** — the one exception to Phase 09's rule, because a
category is taxonomy rather than copy and `/journal/category/materials` cannot render at all if anon
cannot read the row.

**RC-220 is `ArticleCard`, the only card on the site that changes LAYOUT rather than ratio on a
phone.** A product or project card is browsed; a list of articles is read, and a stack of full-width
16:9 images pushes three titles below the fold that a horizontal row keeps on it. Its date is a
`<time datetime>` formatted in a fixed UTC zone so server and browser agree.

**No RSS feed.** The phase lists one and then holds it behind an amendment nobody has granted; its
own verification says that if declined, assert the URL 404s and no feed is advertised. That is what
`tests/e2e/journal.spec.ts` does.

**Three guards fired on this work and all three were right.** `site-routes` caught two undeclared
route families. `seed-modules` caught a new seed-key namespace and changed the design —
`journal-ui.ts` uses `global:UI_LABEL.*` like its two most recent siblings rather than a `journal:`
prefix that would have sat one character from `journal-article:` while addressing a different table.
`studio-nav` caught `/studio/content/journal/categories`, which D4 did not list; recorded as
amendment A16 rather than added to the manifest alone.

**`Pagination` (RC-234) lost its two couplings to the catalogue.** It took a `CatalogQuery` and read
`UI_LABEL.catalog.*` itself, so a change to how the catalogue encodes `sort` would have changed the
journal's page URLs, and a screen-reader user paging the journal would have heard the region
announced as the catalogue's. It now takes `hrefFor` and four resolved labels.

Also fixes a latent hole in `sync_project_page_path` (0153): it fired on INSERT or a slug change
only, so linking an existing page to a project left it at whatever path it was created with. Nothing
was broken — Phase 17's action passes the right path at insert — but the article twin would have
inherited it.


### Phase 17 — Portfolio / Projects

Rivya gains a project archive that is structurally incapable of lying, and it ships with **zero
projects and zero testimonials** — the finished state of this phase, not an unfinished one. Neither
table is a member of the seed runner's `SeedableTable` union, so a seed record targeting one does
not compile.

**Two publish gates, and they ask different questions.** Owner verification asks *did this happen*;
consent asks *may we say whose it was*. A project can be entirely real and still not publishable
under someone's name. Both are enforced per row, in the database, by
`enforce_project_evidence_gate()` and `enforce_testimonial_evidence_gate()`.

**TWO functions, not the one the data model described.** The two tables name a person through
different columns — `client_display_name` / `client_consent` and `attributed_to` / `consent`. A
shared plpgsql function referencing both is CREATEd without complaint, because plpgsql resolves a
record field at execution, and then raises `record "new" has no field "client_display_name"` on the
first write to `testimonials`. Not on deploy, not in review — on the first row somebody tried to
save. `DATA_MODEL.md` §8.12 is corrected, and also renumbered: it carried §8.6, which
`products.specifications_omitted` already holds and two other lines cite.

**The withdrawal branch runs FIRST, and the phase document's own pseudo-code has it last.** With
that ordering, withdrawing consent on a row that is currently PUBLISHED is REFUSED — the statement
meets the publish check on its way past, the check fails, and the write is rejected, leaving the
project live under the name of the person who has just asked not to be named. Found by probing the
gate rather than by reading it. Withdrawal is unconditional and archives the row on the same
statement (amendment A15·a).

**`evidence_note` is unreadable to a visitor, and the first fix for that did nothing.** RLS filters
ROWS, not COLUMNS, so the published-rows policy served every column of a published project including
the owner's private note. A column-level `REVOKE` was measured and had no effect —
`has_column_privilege` stayed true, because a table-level `GRANT` covers it. `0152` drops anon's
table grant and re-grants a named column list. The consequence, deliberately: `select *` is now
refused for `anon` on that table, so a careless public read fails loudly instead of leaking.

**The Studio names the unmet gate before Publish is pressed.** `lib/portfolio/gates.ts` is a pure
mirror of both triggers, and `tests/unit/rls/phase17.test.ts` is an agreement test rather than a
unit test: for every combination of verification, name and consent it asks the mirror whether the
row may publish, asks the DATABASE to publish the same row, and requires the two answers to match.
A mirror tested against the thing it mirrors is a mirror that stays true. A refused publish writes a
`DENIED` audit row — the attempt is the interesting event.

**An absent consent field means "unchanged", not "NOT_APPLICABLE".** The phase document asks for the
consent controls to be disabled until the is-client-project toggle is on. A disabled control posts
nothing, so an editor who unticked that box would have submitted a form with no `client_consent` in
it — and reading that as `NOT_APPLICABLE` would erase a recorded consent, its date and its recorder,
by unticking a checkbox. The controls stay enabled and the action reads absence as silence.

**The project editor's relation action is a second copy of the collection one, deliberately.** It
first reused `setRelationAction` from the collection editor, which hardcodes
`source_type = 'COLLECTION'` — so every edge made from a project would have been stored claiming the
project's id was a collection, silently, readable as a broken link months later. Taking the source
type from the form would be worse: `entity_relations.source_id` is deliberately un-FK'd, so nothing
in the database would catch a mismatch. As a compile-time constant, the endpoint can only ever write
project edges. `ActionForm` typed its state by importing `CollectionActionState` from that same
editor, which is what let the mistake type-check; it now takes a shared `StudioFormState`.

**The testimonials screen shipped with no create form, and that guard was in the wrong place.** The
reasoning — D10 names testimonials outright, and a box to type a quote into is an invitation to
write one in-house — prevented nothing: a fabricated quote is refused at publication by the gate,
whoever typed it. What it did do was make it impossible to record a REAL quote through the Studio at
all. The screen now has create, per-row edit, consent, verification and publish; the gates are the
guard.

**The `/portfolio` empty state was rendering half of itself.** SEED §28 supplies a heading and a
body; the body came from `global_content` and the heading was seeded nowhere, so the page had shown
an explanation with nothing above it since Phase 09. Found by writing the test that asserts both
lines verbatim. Its CTA label is §7's reusable "View the Collection" rather than §28's "Explore the
Collection", recorded as amendment A15·b: one label per destination.

**RC-219 `PortfolioCard` replaces `ReferenceCards` for projects.** That component was Phase 11's
explicit placeholder and says so in its own header. It crops to 4:5 on a phone, which cuts a room
down to an object; a project card holds 3:2 at every width and carries `project_type` as an eyebrow
of text — never a colour-coded chip, which is unreadable to a colourblind visitor and invites a
taxonomy nobody agreed. It renders no date, no client and no location, and could not if asked:
`EntityCard` does not carry them.

**The gallery orders by a number rather than by dragging** (amendment A15·d). Drag-only reordering
is unreachable by keyboard and by screen reader, needs a client library, and does not work with
JavaScript off — which every other Studio form does.

**Setting `VERIFIED` requires `content.verify`, not `content.publish`** (amendment A15·c).
BUSINESS_RULES BR-H3 said the latter, which also admits `editor`; confirming that Rivya delivered a
project is a claim made on the business's own behalf. The implementation was already the stricter of
the two.

**Known limitation.** The Playwright suite still cannot execute in this sandbox: the network policy
denies the Supabase host, so every route answers 500 and no page can be measured.
`tests/e2e/portfolio.spec.ts` detects that through a baseline route and skips with the reason.


### Phase 16 — Collections as Exhibitions

A collection stops being a stub and becomes an entity with a statement, a curated set of pieces, a
graph of hand-made links and an exhibition page — and the phase ships with **zero published
collections**, which is the finished state rather than an unfinished one.

**The publish gate is the phase.** `enforce_collection_publish_gate()` refuses
`status = 'PUBLISHED'` unless `concept_state = 'OWNER_CONFIRMED'`, and
`enforce_collection_concept_authority()` refuses that confirmation to anyone but an owner or admin,
stamping who did it from the session rather than from the submission. FEAT §9's rule — a collection
is a concept until the owner says otherwise — is now a property of the row, so it holds against
`curl`, a future import and a Studio form somebody refactored.

**The sync runs page → collection, and the direction was measured rather than chosen.** Mirroring
collection → page is impossible twice over: `collections` legitimately jumps DRAFT → PUBLISHED,
which is not one of the twelve legal page edges and is refused for every actor including the service
role; and `catalog.write` (owner/admin/merchandiser) is disjoint from every page transition
permission (owner/admin/editor), which `SECURITY DEFINER` cannot bridge because `current_staff_role()`
reads `auth.uid()`. Publishing an unconfirmed concept's page therefore fails naming the COLLECTION,
and the page stays unpublished.

**Two new blocks take the catalogue to 30** (amendment A14). `collection-products` holds no product
ids — curation lives in `product_collections`, and an empty slug means "the collection this page
belongs to", answered from `collections.page_id` rather than copied into a payload that would go
stale. `signature-media` is one block used twice, FEAT §8's still and film, because that is the only
arrangement in which the film is optional at every level.

**The exhibition template inserts ten bands, not eleven.** FEAT §8's element 9 is `rich-text`, which
is declared and unbuilt; inserting it would hand an editor a band indistinguishable from one they
had not filled in. Recorded in A14, asserted by a test that sits next to the reason.

**The ten FEAT §9 concepts are seeded as a name, a slug and an order.** No statement, no media, no
products, no page — a statement describing work nobody has made is a claim about the business (D10).
`owner_verification` is `NOT_REQUIRED`, deliberately: `concept_state` is already a stronger gate, and
setting both would mean the owner confirms a concept and the collection still cannot publish,
refused by a Phase 03 constraint naming neither.

**`entity_relations` is invisible to anonymous readers entirely**, not filtered to published — it
carries editorial notes and the existence of edges pointing at unpublished work. Every write takes
an actor as a required positional argument, so the type system refuses an edge with nobody's name on
it, and every removal is a verified diff: an RLS-filtered DELETE removes zero rows and reports
success, so a "replace" written naively becomes an append.

**Reordering a curation is Move up / Move down rather than drag**, because a drag handle needs a
keyboard equivalent to be operable at all — so the buttons must exist regardless, and they are the
half that works without JavaScript.

**Known limitation.** The Playwright suite cannot execute in the current sandbox: its network policy
denies the Supabase host, so every route answers 500 and no page can be measured. The new spec
detects that by checking a baseline route and skips with the reason, never in CI. The three Phase 15
specs are in the same position.


### Phase 15 — Product Detail Experience

`/product/[slug]` renders for published products only, and renders for nobody today: `products`
holds zero rows and no seed will ever add one. That is the finished state of this phase, not an
unfinished one.

**The specification block is the strictest surface on the site, and it is strict by omission.**
There is no placeholder branch in the component at all — no em dash, no "N/A", no "Contact us for
details", because each of those tells a visitor a value exists and is being withheld. A null value
produces no row; zero rows means the block is absent from the DOM rather than rendered empty. You
cannot add a placeholder by changing a prop, because there is no prop to change. Recorded as BR-D8.

**Nothing is converted, and the database is what makes that permanent.**
`products_dimensions_shape` refuses any key outside the seven declared measurements, so
`{"length_inches": 90}` cannot be stored and no renderer ever meets a unit it would have to convert.
The unit is part of the key; `product_specs.unit` is whatever the owner typed.

**And nobody is pushed into inventing a measurement to publish.** The readiness checklist gains a
required Specifications item, which would be an incentive to estimate a number if a spec row were
the only way to satisfy it. `products.specifications_omitted` (migration `0132`) records the owner's
deliberate decision that a piece publishes no specifications, and satisfies the item with none at
all. What is required is the decision, never the value.

**The conversion rail renders exactly three actions and cannot render a fourth.** The obvious
implementation reads the `ACTION_LABEL` group and renders what it finds; that one would put `Place
Order` on the page the day somebody enabled the row, which would let the CMS add a checkout button
to a business that has no checkout. `Place Order` appears in no form — not as a button, not as a
disabled control — and no WhatsApp link appears on this route at all, because persistence is Phase
20 and D1 requires the inquiry to be saved first.

**No relation is invented.** Editor edges render as "Related"; a product with none falls back to up
to six other published products in the same category, under "More in {Category}". The two never
share a heading.

**The gallery is keyboard-complete**: roving tabindex over the thumbnails, arrows, `Home`/`End`,
`Enter` to open the lightbox, `Escape` to close it and return focus to the thumbnail it came from.
Zoom swaps instantly under reduced motion instead of animating.

**The Studio product editor gains four tabs** — Media, Materials, Specifications, Related — each a
URL rather than a pane, so a section is bookmarkable and the back button works.

Migrations `0130`–`0132` are applied to hosted Supabase and verified against local by fingerprint:
columns, constraints, policies, indexes, triggers and the `is_valid_dimensions` definition all
match, and the function refuses inches, zero, negatives, string values and arrays identically on
both.

**Also in this phase, from the Phase 14 adversarial review:** the Studio's PostgREST search no
longer breaks on a comma or a parenthesis (the term is quoted AND pattern-escaped, in the one order
that works); a price with decimals renders as entered rather than rounded; the form's minor↔major
conversion uses the currency's own exponent at BOTH ends; `og:url` follows the canonical on
paginated views; and `site:check-client-boundary` gained a third rule that walks the import graph
out of every client component and fails on a `server-only` module — the class of defect that had
just broken a deploy.

### Phase 14 — Product Catalog

The catalogue is browsable, server-rendered from the URL, and completely empty. Both of those are
correct: `products` ships with zero rows and stays that way, because a product exists when an owner
types one in (SEED §32) — and until then, an empty catalogue that says so beats a grid of invented
inventory.

**A quote-only piece can never show a number — twice over.** Three of the four price states carry no
amount at all, and the failure this phase was written against is a "Request a Quote" card rendering
as ₹0. `products_price_state_coherent` makes the combination unstorable, down to a zero;
`presentPrice` returns a label with no amount and cannot be made to return one. The database is the
guarantee and the presenter is not allowed to trust it.

**There is no price sort, and that is a decision.** An ordering across four states, three of them
numberless, would have to invent a position for "Request a Quote", and whatever it invented a
visitor would read as a statement about cost. `?sort=price` is dropped as unparseable and does not
reach the canonical URL. Recorded as BR-C5.

**The whole listing works with JavaScript disabled**, because there is nothing to disable: the
filter rail is a `<form method="get">`, the sort control is a second one, and pagination is real
anchors with `rel="prev"`/`rel="next"`. The e2e assertions for filtering, sorting and paging all run
with scripting off.

**A facet with a zero count is hidden, not disabled.** No option on the rail ever leads to an empty
page. An option currently applied always renders, whatever its count, so a filter that matched
nothing can still be cleared — and the counts beside the checkboxes are computed from the same query
as the rows, so each one describes the page it sits beside.

**Two empty states, because they are not the same statement.** "This collection is being prepared"
(SEED §27) is true of a category with nothing in it and false of one whose filters just excluded
everything; the second says so and offers the way back.

**Concept media cannot reach a product**, by trigger, by validator, and by never appearing in the
picker. A Higgsfield render may honestly illustrate a material or a process; on a product card it
becomes a photograph of an object that does not exist.

**The Studio catalogue editor is the only way a product comes into existence.**
`/studio/catalog/{products,categories,collections,materials}` create, edit and publish, all through
`withAudit()` with `catalog.write` and `catalog.publish` checked separately. The FEAT §22 readiness
list is ten named items — never a score — computed from the saved row, and publishing is refused
with the unmet items named. The products list runs the same computation per row, so what is
outstanding across the catalogue is visible without opening anything.

**Categories are edited, never created.** The seven are D3's taxonomy and the route map at once.
Collections have no publish control at all: FEAT §9 keeps every one a concept until Phase 16 adds
the owner confirmation, and a button that never enables reads as broken rather than as a rule.

Migrations `0120`–`0122`; `lib/catalog/{query,price,validation,labels,rail,listing}`; patterns
RC-217, RC-223 (renamed `FilterRail`), RC-234 and RC-237; 55 new unit assertions, 17 database guard
assertions against a real PostgreSQL, and three e2e specs. Amendment A13 records the eight places
this phase departed from what was written before it.

### Phase 13 — Large Format Experience

`/large-format` renders: a hero, a framing paragraph, six editorial groupings of which three are
confirmed, and a closing band. Twenty of the twenty-eight blocks now have renderers.

**A link is rendered only when its destination is live.** `lib/site/resolve-target.ts` is the
smallest piece of this phase and the one with the widest reach: an editor's `href` is a database
value, so `typedRoutes` cannot see it, and a page whose sections are all still DRAFT answers 404
while looking exactly like a real path. `/large-format` links twice to `/custom-commissions`, which
Phase 19 builds — so at launch both calls to action are dropped, and both reappear by themselves the
day that page publishes. Verified in both directions against a live database. The same rule now
governs every section's CTA, and the About spec's assertion was upgraded from "200 or a deliberate
404" to "every anchor in the body resolves".

**The text-only card is a designed layout.** One of the six groupings has no photograph in the
library at all — Conference & Commercial Tables, now recorded as DQ-14 — and two have a single asset
each. A card with no picture renders as a card with no picture: no reserved grey box, no borrowed
image from a neighbouring family.

**Three of the six groupings are withheld individually**, where the seed previously flagged the whole
list. SEED §12 marks two outright and leaves the third conditional on production nobody has
confirmed; flagging the section took the confirmed three off the page to withhold the other three.

**`customization-note` refuses to render unverified**, duplicating the publish trigger on purpose.
It describes what a large-format commission involves — access, weight, structural considerations —
which is a service claim, and it is the one renderer where the cost of a silent early publish
justifies a second mechanism.

### Phase 12 — About + Process

The two pages that explain who Rivya is and how a piece is made now render from the CMS, and both
are built to read as complete while the claims inside them wait for the owner.

**`scale-statement` is built**, so seventeen of the twenty-eight blocks have renderers and `/about`
needs nothing further. It is the site's one editorial 21:9 crop, paired with a separate 4:5 mobile
asset rather than a CSS crop of the wide one — 21:9 squeezed into a phone is a letterbox forty
pixels tall.

**A `/process` chapter is one section carrying one stage.** That shape is what lets the owner verify
one stage without verifying the rest, and it is why the chapter's number is now drawn from its
position among the chapters that actually rendered. Seeded as "01 — BRIEF", a page with the first,
fourth and sixth verified would have read 01, 04, 06; it now reads 01, 02, 03, and the bands
alternate on the same rendered index. `tests/unit/process-numbering.test.tsx` asserts both at 1, 3,
5 and 7 chapters through the real `SectionList`, and the page was walked through the same states
against a live database.

**A verification banner in Studio names the claim, not the rule.** An owner opening `/process` saw
seven sections all marked `OWNER_VERIFICATION_REQUIRED` with nothing to say that they are seven
different claims. Each flagged section now shows its own sentence, plus the specification's wording
where it has some — SEED §16's "Avoid specific production claims until verified" is seeded verbatim
against step 04, and the six notes this project wrote are labelled as ours rather than the
specification's.

**`ChapterMedia` (RC-216) is a Client Component and is loaded on demand.** It was planned as a
server composition; the coordination it does cannot be known on the server, because `/process` is
seven chapters and the library holds thirteen process videos, so only the chapter crossing the
middle of the viewport may hold the page's one motion slot.

### Fixed

- **The homepage would have shipped the chapter island.** `ProcessStepsSection` is imported by every
  page with a process band, so a static import of `ChapterMedia` put it in the homepage's initial
  JavaScript for a branch that page never renders. Caught by `check-island-budget.mjs` on its first
  run after the component landed. The renderer now reaches it through `next/dynamic`, and the gate
  distinguishes islands in the initial bundle from those loaded on demand rather than counting them
  alike.
- **`/process` rendered every sentence twice.** Each chapter's step repeated the section's own
  heading and body, because the block had no media fields of its own and a step was the only place
  to put a picture. The block gained the media shared fields and the chapters carry no steps.

### Phase 11 — Homepage + Material Experience

The homepage stops being thirteen correct boxes. All thirteen SEED §10 sections render from the
CMS, the ten blocks Phase 08 declared and left unbuilt have renderers, and the two things that were
withheld are withheld at the right size: a section where the claim is the section, an entry where
it is one item among several.

**Entry-level owner verification.** `page_sections.owner_verification` is a column, and the publish
trigger refuses a flagged row — right when the whole band is the claim, wrong when a published band
contains one unverified item among five. `lib/cms/entry-visibility.ts` moves the flag inside the
payload, so the homepage's category grid publishes three of five families, the material palette
three of four materials, the commission band its invitation with none of its six capability chips,
and the process band its heading and its link with none of its five draft statements. Fifteen
entries across five sections, each addressable in a test by `data-entry-key` rather than by a
position that moves.

**Three reference blocks that render nothing rather than something invented.** `selected-works`,
`portfolio-strip` and `journal-strip` ask a selector for entities that may not exist: `products` is
empty and stays empty until Phase 14, `portfolio_projects` and `journal_articles` do not exist until
Phases 17 and 18. All three render a sentence the owner wrote — not a skeleton, which says
"loading" when nothing is loading, and not a placeholder card, which is a product that does not
exist. The reason travels as far as `data-empty-reason` for whoever needs to know whether the site
is broken or merely young.

**The hero's still is the LCP element by construction.** Until this phase a hero marked `is_video`
rendered a `<video>` INSTEAD of the still, so the largest element on the page was a media element
most visitors are never allowed to play. There is now one media path and a motion layer over it:
`HeroMotion` (RC-214) mounts after paint, above 768px, under no reduced-motion preference, off Data
Saver, and only for a clip whose duration is known — and renders nothing at all otherwise, because
`MediaVideo`'s poster-and-play-button refusal would put a third call to action on top of the hero's
two.

**`MaterialSequence` (RC-215) observes scroll and never captures it.** The four stages are
server-rendered and passed in as children; the island writes one attribute. The dimming is
`data-[active=false]`, which matches nothing until the island runs, so a page without JavaScript
shows all four stages at full strength.

**An island budget that counts modules, not chunks.** `scripts/site/check-island-budget.mjs` walks
the homepage's layouts and page and fails on a client component nobody budgeted for. It found a
real cost immediately: `MediaSlot`, a Server Component nearly every renderer imports, imported
`MediaVideo` — so every route with any section at all carried the video island whether or not a
video was rendered. `BlockVideo` moved into its own module (RC-235). The budget is five rather than
the phase document's four, and the fifth is named in amendment A11.

**Structured data that names only what the owner supplied.** One `application/ld+json` block on `/`
with a `WebSite` and an `Organization`, each carrying a name and a URL. No `aggregateRating`, no
`award`, no `founder`, no `foundingDate`, no `logo` — a search engine reads structured data as the
business's own assertion and keeps showing it, so it is the worst possible place to invent a fact.

**Measured, not estimated:** 171.7 kB of gzipped client JavaScript on `/`, inside the phase's
180 kB budget. LCP, CLS and INP stay NOT YET MEASURED in `PERFORMANCE.md` §8 on purpose — with no
media bound, a Lighthouse run would measure a page whose every image is a fallback well and would
be wrong in the flattering direction.

### Fixed

- **`w-full` meant 1920px everywhere in the product.** `app/globals.css` bridged
  `--container-full` into Tailwind's `@theme`, and Tailwind v4 reads that namespace for `w-*` as
  well as `max-w-*` — so the built-in `width: 100%` utility was redefined as `width: 120rem`.
  `AspectBox` is `w-full`, so every media frame on every page was 1920px wide inside whatever
  column contained it; the homepage's document was 2672px across at a 1440px viewport, and the
  design-system gallery's own visual baseline had been recording a 2264px-wide page since Phase 02.
  The symptom was known and worked around twice — `Accordion` and `Disclosure` each carry a comment
  explaining why they avoid `w-full` — but the cause was never removed. Found by the new homepage
  spec's horizontal-overflow assertion; recorded as amendment A12; the eight design-system
  baselines were regenerated, because the old ones recorded the bug.
- **Seeded entries with no key.** Widening `tests/unit/entry-verification.test.ts` to read
  `entryArrays` from the block registry — instead of guessing that an editorial entry is "an object
  with a `title`", which missed the commission band's six `label`-carrying capabilities — found
  seven collection cards and seven process steps carrying no `key` at all.
- **A missing Cloudinary cloud name could 500 a page.** `lib/seo/metadata.ts` still called
  `requiredEnv` for the OpenGraph image, inside `generateMetadata`. Phase 10 fixed the same call in
  the layout and in `MediaSlot`; this one only fires once an SEO entry names an image, which is why
  nothing had caught it.
- **Editors' line breaks were being collapsed.** SEED §10 writes two homepage headings as line
  sequences — the hero's two beats and `LIQUID. FORM. CRAFT. OBJECT.` — and in HTML a newline is
  whitespace. `SectionCopy` now preserves them and splits blank-line-separated paragraphs into
  real `<p>` elements.
- **`ResponsiveMedia` always requested a full-viewport image.** Its `sizes` was hard-coded to
  `100vw`, which is right for a hero and wrong for a half-width portrait: the page looked correct
  and weighed several times what it should.

### Phase 10 — Public Website Foundation

Rivya becomes a website a stranger can load. One public shell, thirteen static routes, the
metadata and revalidation plumbing, and the WhatsApp module — every string in the chrome read from
the database, so the owner can reorder the navigation or rewrite the footer without a deploy.

**The shell is Server Components with three small islands.** `lib/site/chrome.ts` fetches the
announcement, both menus, the footer columns, the categories and the contact details once per
request behind `React.cache`, and the layout is its only caller. `MegaMenu` and `MobileNav` hold
open/closed state; `SiteErrorCopy` is a context provider that exists solely because Next requires
`error.tsx` to be a Client Component and a Client Component cannot query the database. The
announcement bar's dismissal is deliberately not an island — a `<form>` posting to a Server
Action, so it works with JavaScript disabled and costs the shell nothing.

**A public read client that reads no cookies.** `lib/supabase/public.ts` is the anon client for
the public site. The cookie-bound one is wrong here twice over: reading a cookie opts the route out
of static rendering, and its `setAll` swallows the write — safe only because `proxy.ts` refreshes
the session, and `proxy.ts` matches `/studio` and nothing else. All twelve CMS routes build static
as a result. `renderCmsPage` switches to the cookie-bound client only in draft mode.

**A page with no live sections is a 404, not an empty shell.** That is SEED §55 as code, and in
the seeded state it means every CMS path answers 404 — Phase 09 seeds all 53 sections `DRAFT`. The
site becomes visible when an editor publishes, which is Phase 08's workflow rather than something
this phase routes around by publishing copy the owner has never read.

**Two revalidation defects found by testing, both of which returned 200 and did nothing.** Without
`export const revalidate` on the site layout every public route builds as a pure static file and
`revalidatePath` has no cache entry to invalidate — publish a section, call the endpoint, get a
success response, and the page keeps 404ing. And `revalidatePath` must be called with **no** `type`
for a literal path; passing `'page'` alongside `/about` fails to match the cache entry. Both are in
`ARCHITECTURE.md` §6 with what proved them.

**A defect in a shared gate helper, found the same way.** `stripCommentsAndStrings(source,
{ strings: false })` did not scan strings at all, so the `//` in every URL was read as the start of
a line comment and the rest of the line was blanked. The new WhatsApp gate was built on that view
and passed a planted `https://wa.me/…` while reporting success; Phase 06's `check-video-props.mjs`
reads the same view and had the same hole. Fixed, with two regression tests.

**The D1 conversion rule, in the type system and then in the runtime.** `buildHandoffUrl` takes a
non-optional `inquiryId`, so a caller with no persisted row does not compile. Writing the test for
it showed what happens when the type is bypassed: the template renders with an empty Inquiry ID and
the customer receives a perfectly ordinary, untraceable message. It now throws as well.

**Migration `0080`** adds a `UI_LABEL` group to `global_content` — the same reason `0055` and
`0071` exist. "Open menu" is an action and stays in `ACTION_LABEL`; "Primary navigation" is not, and
filing it under a group named for actions makes it unfindable. Applied to hosted, which is current
at **28 migrations**.

**Amendments A9 and A10.** `/search` keeps its D3 address but has no `pages` row, so it renders its
own seeded copy rather than delegating. And a `notFound()` page is delivered in the RSC payload
rather than rendered into the HTML: the status is a true 404 and the page is complete with
JavaScript, blank without it. Measured on Next 16.3.4, including against a page whose entire body
is `notFound()`, and left for Phases 39 and 41 to weigh rather than paid for with a database query
in `proxy.ts` on every public request.

Two new gates in `npm run check` and CI: `site:check-client-boundary` (no `'use client'` in a
public route file) and `site:check-whatsapp` (no host literal outside `lib/whatsapp`, and
`buildDirectContactUrl` importable only by the announcement bar, the footer and `/contact`). Both
were proved by planting a violation. `cms:check-copy` now scans `components/patterns` too. 1020
unit tests and 98 e2e assertions across all eight FEAT §45 widths, axe clean.

`scripts/db/local-rest.mjs` runs a local PostgREST against the local cluster, because a bare
Postgres verifies nothing about a page: `supabase-js` speaks HTTP, so without it no route can be
requested and no e2e test can run.

### Phase 09 — Initial Website Content Seed

The empty CMS becomes a coherent draft website. Eighteen seed modules, 231 records
applied and 22 authored-and-deferred, every string taken from the specification
verbatim. Two migrations, `0070` and `0071`.

**Most of `0070` was already done**, and the migration says so rather than shipping
a shorter file silently: `content_seed_version` has been the column name on all ten
seedable tables since Phase 03, so there was no rename, and `owner_edited` already
existed. What was missing: `content_seed_runs.deferred_count`; the seed lookup
indexes — seven of ten tables had no `seed_key` index and *none* had one on the
version column, including the six Phase 08 tables this phase writes hundreds of rows
into; and `set_owner_edited` hardened to SECURITY DEFINER. `0071` adds a `BRAND`
group, because SEED §6 names "Global Content → Brand" as a Studio location and the
closed group list had no member that meant it.

**The runner gained two outcomes and a guard.** `deferred` is a declaration, not a
try/catch: a record names the tables it needs, and if any is absent it is counted and
listed rather than written or failed. It had to become per-*record*, because the two
modules that defer are mixed — `commissions.ts` writes six sections and authors three
form templates; `journal.ts` writes two sections and authors nineteen records. A
module-level declaration would have left `/custom-commissions` and `/journal` with no
copy until Phases 18 and 19, which is the outcome deferral exists to avoid.

`unchanged` is the other. A no-op re-run was UPDATEing all 231 rows, and
`write_revision` fires on any update — so each re-seed appended 231 revisions saying
nothing changed, and the history an editor scrolls to find a real change would be
almost entirely noise. It is reported separately from `skipped (owner edit)`: a skip
means a human owns the row and somebody may need to act, while unchanged is the
healthy steady state.

The third guard is a status promotion — the row a person reviewed and shipped without
changing a character, which hashes identically to what the seed wrote. It is *not* a
bare `status = 'PUBLISHED'` check: route shells and global labels seed published on
purpose, so the question is whether the row is published beyond what the module asked
for. Written the naive way it ate the runner's own output and skipped all 25 Phase 08
records on the very next run.

**Three defects the verification steps found**, each invisible without running them:

- A dry run on an empty database reported 91 failures, one per reference: it writes no
  pages, so every section's `page_id` resolved to nothing. Phantom failures on a run
  whose entire job is to report what *would* happen.
- Then 31 rows reported themselves owner-edited on a clean re-run. PostgreSQL stores
  jsonb keys by length then bytewise, not in insertion order, so a payload written as
  `{is_video, autoplay, scrim}` reads back reordered — identical data, different hash.
  `contentHash` now canonicalises nested keys. Arrays are deliberately not sorted: a
  `steps` array's order *is* the content.
- The generated inventory embedded page UUIDs, which change on every `db:reset`. A
  committed, diff-checked file cannot contain per-database values or the gate has to be
  turned off.

**What the seed will not do.** No products — `products` is not a member of the
`SeedableTable` union, so a module targeting it does not compile. No portfolio projects
and no testimonials; `/portfolio` ships §28's empty state and nothing else. No
placeholder media: a slot with no asset is left null and reported as a gap, while a
binding naming an asset that is not in `media_assets` fails the run, because those are
different mistakes. No invented business facts — §21's contact details are seeded
because the owner supplied them, in one place because §21 forbids hardcoding them in
several, and flagged; the location link §21 mentions but does not supply is null.

**80 inventory rows await owner verification and cannot be published until it is
given** — `cms_publish_section` refuses with RV002 and a check constraint refuses
underneath it. All ten FAQ answers, every process step, About's scale and bespoke
sections, three category descriptions, five homepage sections, the announcement bar,
the brand introduction, `Ready Stock` and the contact details.

`docs/content/INITIAL_CONTENT_INVENTORY.md` is generated from the **database**, not the
modules — §54 asks what is actually there, which is the only version of the question
worth answering after a run that skipped rows. 316 rows. `content:check-inventory`
regenerates and diffs, wired into CI.

23 tables, 90 policies, 27 migrations, 951 tests, 25 gates.

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
