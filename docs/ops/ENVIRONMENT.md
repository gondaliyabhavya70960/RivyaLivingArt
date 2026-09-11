---
doc: ENVIRONMENT
status: CURRENT
owning_phase: 38
last_reviewed: 2026-09-07
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# ENVIRONMENT — variables, scopes and the status page contract

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`, section **D8**. D8 fixes the variable
> names; this document fixes their meaning, scope, ownership and failure mode. Where the two differ,
> D8 wins and this document is wrong.
> Companion documents: `docs/ops/DEPLOYMENT.md` (where values are set and how they are rotated),
> `docs/ops/SECURITY.md` (the never-expose list and its guards),
> `docs/architecture/ARCHITECTURE.md` §8 (redaction).
> Owned by Phase 38 (the status page) and Phase 44 (the per-environment table).

**The rule that governs this entire document, stated once:** the project never prints, logs, renders
or returns the *value* of a variable — **not the value, not a prefix, not a suffix, not a length, not
a hash** (D8). Everything below reasons about variables by **name** and by **presence**.

**Implementation status.** No environment is provisioned. No D8 variable is set anywhere in this
repository or its tooling. The tables below are the contract Phase 38 and Phase 44 implement against.

---

## 1. How a variable is declared

Adding a variable is a four-step act, in this order. A variable that skips any step is a defect.

| Step | Artefact | What it does |
|---|---|---|
| 1 | `CANONICAL-DECISIONS.md` D8 | The name is added by **amendment**. D8 is the register of names |
| 2 | `.env.example` | The name with an **empty value**, committed. This is the only committed reference |
| 3 | `lib/env.ts` | A Zod schema entry declaring required/optional per runtime, and whether it is public or server-only |
| 4 | This document, §3 or §4 | Purpose, scope, where set, consumer, failure mode, rotation owner |

`scripts/docs/check-doc-contract.mjs` enforces step 4: a PR touching `.env.example` or any `lib/**`
file reading `process.env` must also touch this document.

**Access rule.** No module reads `process.env` directly except `lib/env.ts` and
`lib/ops/env-checks/**`. Everything else imports the parsed, typed object. A server-only variable is
reachable only from a module that carries `import 'server-only'`.

---

## 2. Classification

Three classes, and the class decides what may ever be displayed.

| Class | Meaning | May appear in the client bundle | May appear in a log | Environment page may show |
|---|---|---|---|---|
| **Public** | Compiled into client JavaScript by design; assume the whole world reads it | Yes | Yes | The value |
| **Sensitive** | Not a credential, but identifies private data or a real person | Never | Never | `configured` boolean only |
| **Secret** | A credential. Possession grants access | Never | Never | `configured` boolean only |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is public **by design and safely so**: it is a role token whose
entire authority is bounded by RLS. Its safety is a property of the policies, not of secrecy — which
is why `BUSINESS_RULES.md` BR-F1 and the RLS test suite matter as much as the never-expose list.

---

## 3. Public variables (five, D8)

Compiled into the client bundle. Never put anything here that is not intended to be world-readable.

### `NEXT_PUBLIC_SITE_URL`

| | |
|---|---|
| Class | Public |
| Purpose | The canonical absolute origin. Used for canonical tags, OpenGraph URLs, `sitemap.xml`, `robots.txt`, JSON-LD `@id` values and absolute links inside WhatsApp messages |
| Format | Origin with protocol, **no trailing slash** — e.g. `https://example.com` |
| Set in | Vercel per environment; `.env.local` for development |
| Read by | `lib/seo/**`, `app/sitemap.ts`, `app/robots.ts`, `lib/whatsapp/**` |
| Without it | Canonical and OG URLs become relative or wrong; the sitemap is invalid; social previews break; a reference URL in a WhatsApp message is unusable. The Zod schema treats it as **required** — the build fails rather than shipping wrong canonicals |
| Values | Production: apex domain · Preview: the deployment URL · Development: `http://localhost:3000` |
| Rotation | Engineer, on domain change |

### `NEXT_PUBLIC_SUPABASE_URL`

| | |
|---|---|
| Class | Public |
| Purpose | The Supabase project endpoint used by both the browser client and the server client |
| Set in | Vercel per environment; `.env.local` |
| Read by | `lib/supabase/browser.ts`, `lib/supabase/server.ts`, the CSP `connect-src` allowance |
| Without it | No database access at all. Every public route falls to the site error boundary; the Studio cannot authenticate. **Required** |
| Values | Production: `rivya-prod` · Preview: `rivya-staging` · Development: local `supabase start` URL |
| Guard | `check-env.ts` asserts a preview never carries the production project ref |

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| | |
|---|---|
| Class | Public (bounded by RLS) |
| Purpose | The anonymous role token for browser and server reads of published content, and for the single public write (an inquiry insert) |
| Set in | Vercel per environment; `.env.local` |
| Read by | `lib/supabase/browser.ts`, `lib/supabase/server.ts` |
| Without it | Identical to the previous row: no data. **Required** |
| Safety | Its authority is exactly the RLS policy set: read `status = 'PUBLISHED'`, insert an inquiry, and nothing else. It reads **no** `research_*` row and **no** inquiry |
| Rotation | Engineer, with the project; rotating it invalidates browser sessions and needs a redeploy |

### `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

| | |
|---|---|
| Class | Public |
| Purpose | The cloud name in every delivery URL, `https://res.cloudinary.com/<cloud>/...` |
| Set in | Vercel (all environments share the account); `.env.local` |
| Read by | `lib/media/providers/cloudinary.ts` URL builder, `next.config.ts` image config, the CSP `img-src`/`media-src` allowance |
| Without it | Every image and video URL is malformed. Pages render structurally intact with `MediaSlot` fallbacks in their reserved aspect boxes (`ARCHITECTURE.md` §7 rule 4) — degraded, not collapsed. **Required** |
| Rotation | Only if the Cloudinary account changes; this is effectively permanent |

### `NEXT_PUBLIC_WHATSAPP_NUMBER`

| | |
|---|---|
| Class | Public, and a **real business contact** |
| Purpose | The `wa.me` destination for every handoff and every "Enquire on WhatsApp" affordance |
| Format | Digits only, international, no `+`, no spaces — e.g. `917096036250` |
| Set in | Vercel per environment; `.env.local` |
| Read by | `lib/whatsapp/**` only. It is never read in more than one place (SEED §21) |
| Without it | The handoff cannot be built. The inquiry still persists and the success state renders, but the WhatsApp action is unavailable and `whatsapp_state` records `UNAVAILABLE`. **The inquiry is never lost because the handoff is broken** (BR-B1) |
| Values | Production: the owner's number — **OWNER_VERIFICATION_REQUIRED** · Preview and Development: a **test** number |
| Guard | `check-env.ts` fails if the preview number equals the production number, so a reviewer cannot message the owner from a draft |
| Rotation | **Owner** |

The displayed phone, email and map location are **not** environment variables — they are
`global_content` rows edited at `Studio → System → Site Settings → Contact` (SEED §21). Only the
`wa.me` destination is configuration, because it is consumed by a URL builder rather than rendered as
copy.

---

## 4. Server-only variables (eight, D8)

Never compiled into client JavaScript. Every module that reads one carries `import 'server-only'`.

### `SUPABASE_SERVICE_ROLE_KEY`

| | |
|---|---|
| Class | **Secret** — full database bypass, ignores every RLS policy |
| Purpose | The admin client used by: staff invitation, RLS-SERVICE writes (search index, snapshots, counters, `rate_limit_buckets`), retention crons, and the seed and migration scripts |
| Set in | Vercel (server scope) per environment; `.env.local` |
| Read by | `lib/supabase/admin.ts` **only**. No other module may import the admin client — R2 client components may never reach it |
| Without it | Staff invitation, search indexing, rate limiting, vitals ingestion and the retention crons fail. Public reads and the inquiry insert continue, because they use the anon key. The Environment page reports `NOT_CONFIGURED` |
| Blast radius if leaked | Total: read and write every table, including every enquirer's personal data, bypassing all policy. Rotate immediately and follow `SECURITY.md` §11 |
| Rotation | **Owner**, 90 days; requires a redeploy |

### `DATABASE_URL`

| | |
|---|---|
| Class | **Secret** — contains credentials in the URL itself |
| Purpose | Direct PostgreSQL access for migrations (`supabase db push`) and offline scripts (seeding, media migration, anonymisation, recomputation) |
| Set in | GitHub Actions secrets for the migration workflows; the operator's shell for a manual run; **not required by the running application** |
| Read by | `scripts/**` (runtime R6) and the CI migration jobs |
| Without it | Migrations and seed scripts cannot run. The deployed application is unaffected — it uses the Supabase client, not a raw connection |
| Blast radius if leaked | Full database access outside Supabase's API, including a connection string usable from anywhere |
| Rotation | **Owner**, 90 days (rotate the database password, update the pooled URL) |
| Note | Use the **pooled** connection string for anything that opens many short connections |

### `CLOUDINARY_API_KEY`

| | |
|---|---|
| Class | Sensitive — meaningless alone, dangerous paired with the secret |
| Purpose | Identifies the account when signing uploads and calling the Admin API |
| Set in | Vercel (server scope); `.env.local` for media work |
| Read by | `lib/media/providers/cloudinary.ts` (server half) |
| Without it | Both signing endpoints fail — `app/api/media/sign` (Studio) and `app/api/inquiries/upload-sign` (visitor reference images) — so Studio uploads, visitor attachments and the media migration all stop. **Delivery of existing assets is unaffected** — delivery URLs need only the cloud name |
| Rotation | **Owner**, 180 days, as a pair with the secret |

### `CLOUDINARY_API_SECRET`

| | |
|---|---|
| Class | **Secret** — signs uploads, transformations and deletions |
| Purpose | Computes the upload signature server-side. **The browser never sees it**; the client receives a signature, never the secret |
| Set in | Vercel (server scope); `.env.local` for media work |
| Read by | `lib/media/providers/cloudinary.ts` (server half) only |
| Without it | Same as the key: uploads and migration fail, delivery continues |
| Blast radius if leaked | Arbitrary upload into and deletion from the Rivya media library, plus arbitrary transformation URLs against the account's quota |
| Rotation | **Owner**, 180 days |

### `GOOGLE_SERVICE_ACCOUNT_JSON`

| | |
|---|---|
| Class | **Secret** — a private key that impersonates a service identity |
| Purpose | Authenticates the Google Sheets export/sync (Phase 36) |
| Format | The service-account JSON, whole, as a single-line string |
| Set in | Vercel (server scope) for production and staging; optional in development |
| Read by | `lib/sheets/**` only |
| Without it | Sheets sync is unavailable; `/studio/research/sheets` shows a `NOT_CONFIGURED` state. Nothing else degrades — Sheets is an export path, not a dependency |
| Blast radius if leaked | Everything that identity can reach in Google Cloud. Grant it access to exactly one spreadsheet and nothing else |
| Rotation | **Owner**, 180 days: create the new key, set it, redeploy, verify a sync, then delete the old key in Google Cloud |

**Setup (Phase 36, owner).** (1) In Google Cloud, create a project (or use an existing one), enable
the *Google Sheets API*, and create a **service account** with no roles. (2) Create a JSON key for
it and paste the whole file, as one line, into `GOOGLE_SERVICE_ACCOUNT_JSON`. (3) Create the
spreadsheet in Google Sheets and **share it with the service account's email** (the `client_email`
in the JSON; `/studio/research/sheets` shows it) as an editor — the integration requests the
`spreadsheets` scope only and can reach nothing that is not shared with it. (4) Set
`GOOGLE_SHEETS_SPREADSHEET_ID` to the id in the spreadsheet's URL. (5) Turn `google_sheets` on in
`/studio/system/flags`. A run that fails with `AUTH` means step 3 was skipped or the key was
rotated. **That a Google Workspace account and a spreadsheet exist for Rivya is
OWNER_VERIFICATION_REQUIRED.**

### `GOOGLE_SHEETS_SPREADSHEET_ID`

| | |
|---|---|
| Class | Sensitive — not a credential, but it identifies a private document |
| Purpose | The target spreadsheet for research exports |
| Set in | Vercel (server scope) per environment; a **test** sheet outside production |
| Read by | `lib/sheets/client.ts` (`defaultSpreadsheetId()`); a definition may override it with an id an admin types |
| Without it | Sync is unavailable with a `NOT_CONFIGURED` state; nothing else changes |
| Environment page shows | `configured` boolean only — never the id, because the id plus a leaked credential is a complete address |
| Rotation | **Owner**, on change |

### `SCRAPER_USER_AGENT`

| | |
|---|---|
| Class | Server-only, **not secret** |
| Purpose | The identifying User-Agent every research fetch sends. It must name Rivya and provide a contact route, so an operator can identify and reach us |
| Set in | Vercel (server scope), all environments; `.env.local` |
| Read by | `lib/scraper/core/**` |
| Without it | The scraper **refuses to run**. Fetching a third-party site without identifying yourself is a conduct failure, not a configuration nicety (BR-F6). The Environment page reports `NOT_CONFIGURED` and no run can be started |
| Environment page shows | **The value**, because it is not secret and an operator needs to confirm what is being sent |
| Rotation | Engineer, on change |

### `REVALIDATE_SECRET`

| | |
|---|---|
| Class | **Secret** — grants cache invalidation and scheduled-job invocation |
| Purpose | Guards `POST /api/revalidate`, the only cache-invalidation entry point. **As built, it guards nothing else.** The paragraph this row used to carry — six of seven cron routes reusing it, and `app/api/cron/research` authenticating on `x-vercel-cron` alone — described a plan that Phase 25 settled the other way: `CRON_SECRET` now exists, and **both** cron routes that have been built (`content-schedule`, `research`) authenticate with it. See §6 open question 2, and amendment A25 |
| Set in | Vercel (server scope) per environment, unique per environment; `.env.local` |
| Read by | `app/api/revalidate/route.ts`, and nothing else. `lib/cms/publishing.ts` was listed here and does NOT read it: it takes `revalidate` as an injected dependency (Next's `revalidatePath` in production, a spy in tests), so publishing invalidates in-process without a secret. The five research and ops cron routes named here previously do not exist yet (Phases 31–38); when they are built they take `CRON_SECRET`, like the two that do |
| Without it | Publishing still writes, but the cache is not invalidated: pages stay stale for at most their `revalidate` window and a `WARNING` is written to `system_logs` on channel `CONTENT`. Those six cron routes reject every invocation — scheduled publication, nightly snapshots, scoring, the Sheets sync and log retention all stop silently; the research drain keeps running |
| Blast radius if leaked | Forced cache invalidation (a cost and availability nuisance, not a data breach) and the ability to trigger scheduled jobs |
| Rotation | Engineer, 90 days. Rotate the publish service and the routes in the same window |

---

## 5. Per-environment matrix

Values live in the Vercel dashboard or CLI, set by the owner or an admin, and in `.env.local` for
development. `.env.local` is git-ignored and is never committed, pasted into an issue, or shared in
a screenshot.

| Variable | Class | Production | Preview | Development | Rotation owner |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public | apex domain | preview URL | `http://localhost:3000` | Engineer |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `rivya-prod` | `rivya-staging` | local | Engineer |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | prod key | staging key | local key | Engineer |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public | same account | same account | same account | Engineer |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Public | owner's number **(OWNER_VERIFICATION_REQUIRED)** | test number | test number | **Owner** |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | prod | staging | local | **Owner**, 90 d |
| `DATABASE_URL` | Secret | prod pooled (CI only) | staging pooled (CI only) | local | **Owner**, 90 d |
| `CLOUDINARY_API_KEY` | Sensitive | same account | same account | same account | **Owner**, 180 d |
| `CLOUDINARY_API_SECRET` | Secret | same account | same account | same account | **Owner**, 180 d |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Secret | prod SA | staging SA | optional | **Owner**, 180 d |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Sensitive | prod sheet | test sheet | test sheet | **Owner** |
| `SCRAPER_USER_AGENT` | Server | set | set | set | Engineer |
| `REVALIDATE_SECRET` | Secret | unique | unique | any | Engineer, 90 d |

### 5.2 Setting these in Vercel — the actual list, as of Phase 25

The matrix above is the full D8 set, including variables whose subsystems do not exist yet. This
section is narrower on purpose: it is what to paste into the Vercel dashboard **today**, so nobody
goes hunting for a Google service account that no phase has created.

**No value appears here, in `.env.example`, or in any other committed file.** Copy each from the
dashboard named in the last column, straight into Vercel. Never through a chat window, a commit, or
a screenshot — see §7.4.

**Set all six now. The app reads exactly these** (`grep requiredEnv lib/ app/ components/`):

| # | Variable | Vercel type | Environments | Copy it from |
|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | Plain | Production, Preview, Development | Supabase → Project Settings → **Data API** → Project URL |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plain | Production, Preview, Development | Supabase → Project Settings → **API Keys** → `anon` / publishable |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | **Sensitive** | Production, Preview | Supabase → Project Settings → **API Keys** → `service_role` |
| 4 | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Plain | Production, Preview, Development | Cloudinary → Dashboard → Cloud name |
| 5 | `CLOUDINARY_API_KEY` | **Sensitive** | Production, Preview | Cloudinary → Settings → API Keys |
| 6 | `CLOUDINARY_API_SECRET` | **Sensitive** | Production, Preview | Cloudinary → Settings → API Keys |

Mark 3, 5 and 6 **Sensitive** in Vercel. That makes them write-only: they cannot be read back out
of the dashboard afterwards, by anyone, including the account owner. It costs nothing and it is the
difference between a leaked browser session exposing a build log and exposing the database.

**Two more worth setting at the same time**, though nothing reads them until later phases:

| Variable | Vercel type | Value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Plain | The apex domain in Production; leave unset in Preview so `VERCEL_URL` is used |
| `REVALIDATE_SECRET` | **Sensitive** | Any long random string you generate — it is a shared secret with nobody but this app (`openssl rand -base64 32`) |

#### Added by Phase 25 — set these before the research cron can do anything

Both are read by `app/api/cron/research/route.ts`, which Vercel Cron calls every five minutes from
the moment this phase deploys. Until they are set the tick refuses itself, which is the intended
behaviour and not a failure to fix in a hurry: **nothing is fetched from anybody's website until an
owner has both configured these AND approved a source AND switched the `research_enabled` flag on.**
Three separate gates, deliberately.

| # | Variable | Vercel type | Environments | Value |
|---|---|---|---|---|
| 7 | `CRON_SECRET` | **Sensitive** | Production | Any long random string (`openssl rand -base64 32`). **The name is fixed by Vercel** — it attaches `Authorization: Bearer <value>` only for a variable spelled exactly this way, so renaming it makes the header silently absent and every tick 401s with nothing logged anywhere |
| 8 | `SCRAPER_USER_AGENT` | Plain — **not secret** | Production, Preview | A string naming Rivya and a contact route, e.g. `Rivya-Research/1.0 (+https://<your-domain>/contact)`. It is the opposite of a secret: its whole job is to identify us to the sites we read, so an operator can see who we are and reach us |

`SCRAPER_USER_AGENT` has no fallback anywhere in the code and a missing one throws rather than
defaulting. That is deliberate: a default would mean an unconfigured deployment crawling
anonymously, which is precisely the conduct this subsystem is built to avoid, arriving through a
convenience.

**The snapshot bucket is not an environment variable.** Fetched page bodies are gzipped into a
PRIVATE Supabase Storage bucket named `research-snapshots`, in the project `SUPABASE_SERVICE_ROLE_KEY`
already points at — so there is no new vendor, no new credential and no new line here. It is not
Cloudinary on purpose: Cloudinary serves from a public CDN, and a competitor's page body must not be
served from a Rivya origin. See `docs/architecture/SCRAPER.md`.

**Do NOT put these in Vercel:**

| Variable | Why not |
|---|---|
| `DATABASE_URL` | **The application never uses it.** Reads and writes go through PostgREST over HTTPS via `supabase-js`; only migrations and operations scripts open a direct connection, and those run in CI (§5's matrix says "CI only"). Putting it in Vercel adds the most powerful credential in the system to a place that has no use for it. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | It is the owner's real number, it is `OWNER_VERIFICATION_REQUIRED`, and no page renders it before Phase 10. A real number in a public preview build is a number that gets scraped. |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID` | The Sheets export is Phase 36. No credential exists to paste. (`SCRAPER_USER_AGENT` used to be on this list and moved to §5.2's Phase 25 table when the fetcher shipped.) |

**One project, two Vercel environments, today.** §5's matrix anticipates `rivya-prod` and
`rivya-staging`; only one Supabase project exists (`ccvarsmzickdkryoakdg`), so Production and
Preview point at the same database for now. That is a deliberate temporary state, not a
misconfiguration — but it means **a preview deployment writes to real data**, which is worth
knowing before someone tests an upload against it.

**Rotate before you paste, not after.** Four Supabase secrets were exposed in a chat transcript
earlier in this project and are compromised until rotated (§7.4's rule exists because of it).
Rotating first means entering each value into Vercel once; rotating afterwards means doing the
whole list twice.

#### Checking it worked without printing anything

After saving, redeploy — **Vercel does not apply new variables to an existing deployment.** Then:

```
curl -sS -o /dev/null -w '%{http_code}\n' https://<deployment>/studio/media/all
```

`307`/`302` to `/studio/login` is correct: the route resolved, the Supabase client constructed, and
`proxy.ts` found no session. A `500` means a variable is missing or misspelled — the failure is at
**request** time, not build time, which is why a green Vercel build proves nothing about this.

### 5.1 Platform-injected variables

`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF` are injected by the
platform, are not secrets, and are configured by nobody. They are read for the Environment page's
build panel, the environment ribbon and `check-env.ts`. D8 does not list them because D8 lists
variables the **project** sets; this is raised in §9 so a reader does not treat their use as a
divergence. `NODE_ENV` is set by the tooling. `ANALYZE=1` is a local-only bundle-analyzer switch.

---

### 5.x Repository secrets for the dispatch-only workflows

GitHub Actions never runs against the hosted project on push. Two workflows do, on manual dispatch,
and each reads repository secrets the owner sets under *Settings → Secrets and variables → Actions*:

| Workflow | Secret | Same value as |
|---|---|---|
| `Database migrate (hosted)` | `SUPABASE_DB_URL` | the session-pooler connection string (see the workflow's own note) |
| `Media hash backfill (hosted)` (Phase 33) | `NEXT_PUBLIC_SUPABASE_URL` | the Vercel variable of the same name |
| | `SUPABASE_SERVICE_ROLE_KEY` | the Vercel variable of the same name (Sensitive) |
| | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | the Vercel variable of the same name |

The media workflow exists because the development containers cannot reach `res.cloudinary.com`; a
GitHub-hosted runner can. A `plan` run lists the work and fetches nothing.

## 6. Validation

`lib/env.ts` parses the environment once, with Zod, at module load. Two rules keep it honest:

1. **Presence and shape only.** The schema checks that a name exists and that it is a non-empty
   string of the right shape (a URL is a URL; the WhatsApp number is digits). It never asserts a
   length, never logs a prefix, and never includes a received value in an error.
2. **Fail where failing is cheapest.** A missing *public* variable fails the **build**. A missing
   *server* variable fails **at first use**, as a `ConfigurationError` that names the variable and
   degrades the dependent surface — because Sheets being unconfigured must not take the homepage
   down.

`scripts/ops/check-env.ts` is the operator-facing form, run in preflight:

```
npx tsx scripts/ops/check-env.ts
```

| It does | It never does |
|---|---|
| Reports each name as present or absent for the target environment | Prints a value, a prefix, a suffix or a length |
| Asserts a preview never carries the production Supabase project ref | Connects to production to "check" |
| Asserts the preview WhatsApp number differs from production | Writes anything |
| Exits non-zero, naming the failing variable | Guess at a default |

`tests/unit/env-schema.test.ts` asserts the schema rejects a missing required name and that no
failure message contains any part of a value.

---

## 7. The Environment status page contract

`Studio → System → Environment` (`/studio/system/environment`, permission `system.environment.read`,
effectively `owner` and `admin`). Read-only. It offers **no** "fix it" action; nothing on this page
writes anything.

### 7.1 The shape every check returns

```ts
{ id, configured: boolean, status, latency_ms, checked_at, code }
```

| Field | Vocabulary |
|---|---|
| `status` | `OK · DEGRADED · UNREACHABLE · NOT_CONFIGURED · UNKNOWN` |
| `code` | A fixed enum. **An upstream error message is never rendered**, because upstream messages quote request URLs and occasionally credentials |
| `configured` | Computed from the **presence of the variable name** in the process environment — never from its content |

Checks run in parallel server-side with a 3-second per-check timeout. The page is server-rendered;
results are never fetched from the client.

### 7.2 The checks

| Check | What it does | What it must never do |
|---|---|---|
| `supabase_db` | `select 1` through the server client, timed | Print the connection string, host or credentials |
| `supabase_auth` | A `getSession()` round-trip against the project URL | Print any key |
| `cloudinary` | Signed ping of the account usage endpoint | Print the API secret or a signed URL |
| `google_sheets` | Token mint only — **no spreadsheet read** | Print the service-account private key or the spreadsheet id |
| `vercel` | Reads the generated build-info module | Require a Vercel API token |
| `higgsfield` | Manifest presence and asset count from `data/higgsfield/asset-manifest.json` | Call the Higgsfield API — the manifest is the record of truth (D6) |
| `migrations` | Applied count and latest version from `supabase_migrations.schema_migrations` versus the files in `supabase/migrations/` | Run, repair or roll back a migration |
| `build` | Commit SHA, branch, build time, environment from `lib/build-info.generated.ts` | Expose any variable value |
| `security` (Phase 41) | Header presence, CSP mode, rate-limit configuration, last dependency-audit result | Show a secret, a limit key, or an `ip_hash` |

### 7.3 What the page may display

```
booleans · the five status values · latency in milliseconds · timestamps · fixed error codes
counts (assets, applied migrations, log volumes) · identifiers (commit SHA, branch,
migration version, environment name) · the value of SCRAPER_USER_AGENT · variable NAMES
```

### 7.4 What the page may NEVER display — the explicit list

```
SUPABASE_SERVICE_ROLE_KEY   DATABASE_URL                CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET       GOOGLE_SERVICE_ACCOUNT_JSON GOOGLE_SHEETS_SPREADSHEET_ID
REVALIDATE_SECRET           NEXT_PUBLIC_SUPABASE_ANON_KEY (rendered nowhere on this page)
any password, private key, session token, JWT, cookie or Authorization header
any raw upstream error message · any connection string · any signed URL
any value, prefix, suffix, length or hash of the above
any enquirer's name, phone, email, message or attachment
any raw IP address · any ip_hash · any competitor page content
```

The page carries a permanent line stating that it reports **reachability only** and never displays a
value. `lib/logging/redact.ts` runs over every check result before render, so a value cannot leak
through a `context` blob even if a check module is written carelessly.

### 7.5 Proof

| Guard | Asserts |
|---|---|
| `tests/unit/env-checks-no-secrets.test.ts` | Every check's return object contains no value-shaped string; a check that tries to return one fails the test |
| `tests/e2e/deploy-smoke.spec.ts` | Scrapes the rendered page for every server-only variable name **and** for value-shaped strings (JWT-like, PEM blocks, `postgres://user:pass@`, long high-entropy runs) |
| `scripts/security/check-secret-exposure.mjs` | Greps the built `.next/static` output for every server-only name and for known key shapes |
| `tests/unit/redact.test.ts` | The redactor removes every never-expose name from a nested payload, substituting a fixed `[redacted]` — never a prefix, never a length |

---

## 8. Failure-mode summary

What a visitor and an operator see when each variable is missing or wrong.

| Missing | Public site | Studio | Where it shows |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Wrong canonicals, broken sitemap and OG | Unaffected | Build failure (required) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Site error boundary with seeded copy; cached routes serve until their window expires | Cannot authenticate | Build failure (required) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Layout intact, `MediaSlot` fallbacks in reserved boxes | Media library cannot render previews | Build failure (required) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Enquiries still persist; the handoff button is unavailable; `whatsapp_state = 'UNAVAILABLE'` | Inquiry rows show the state | Environment page |
| `SUPABASE_SERVICE_ROLE_KEY` | Unaffected for reads and inquiry inserts | Invitations, search indexing, rate limiting, crons fail | Environment page `NOT_CONFIGURED` |
| `DATABASE_URL` | Unaffected | Unaffected | Migration and seed jobs fail in CI |
| `CLOUDINARY_API_KEY` / `_API_SECRET` | Existing media still delivers | Uploads and media migration fail with a named reason | Environment page |
| `GOOGLE_SERVICE_ACCOUNT_JSON` / `_SPREADSHEET_ID` | Unaffected | Sheets sync unavailable | Environment page `NOT_CONFIGURED` |
| `SCRAPER_USER_AGENT` | Unaffected | **No research run can start** | Environment page `NOT_CONFIGURED` |
| `REVALIDATE_SECRET` | **As built: nothing breaks.** `POST /api/revalidate` answers `503 not_configured` and nothing in the application calls it — publishing revalidates in-process through an injected `revalidatePath`. It is worth setting for the external invalidation path it exists to provide, not to keep the site correct | Publish succeeds; a `WARNING` names the uncleared tags. A scheduled job that never fires writes nothing at all, so the absence shows as a gap in `system_logs`, not as an error | `system_logs`, channel `CONTENT`; the Vercel Cron Jobs view |

---

## 9. Open questions for the canonical decisions

1. **Platform-injected variables are not in D8.** `VERCEL_ENV`, `VERCEL_URL`,
   `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF` are read by the Environment page and
   `check-env.ts`. Suggested amendment: note in D8 that platform-injected variables are permitted
   and are not project-set.
2. **~~No cron secret, and two schemes for seven routes.~~ RESOLVED IN PRACTICE, NOT YET IN D8.**
   The question was whether cron routes should reuse `REVALIDATE_SECRET` or get their own secret,
   and whether `app/api/cron/research` should authenticate on Vercel's `x-vercel-cron` header alone.
   Both halves are now settled by what shipped: `CRON_SECRET` exists, and **both** built cron routes
   — `content-schedule` (Phase 08) and `research` (Phase 25) — authenticate with it through
   `checkCronAuth`, returning `503` when it is unset and `401` when it is wrong. `REVALIDATE_SECRET`
   guards `/api/revalidate` and nothing else. Amendment A25 records why the research route answers
   `401` rather than the phase document's `404`: two cron endpoints answering differently to the same
   mistake is worse than either answer, and a `404` misleads an operator debugging a missed tick into
   hunting a routing problem that is not there.

   **What remains open is only the paperwork**: `CRON_SECRET` is not in D8's server-only list, so
   the code and the canonical decision disagree about whether it exists. A D8 amendment adding it
   closes this. (`DEPLOYMENT.md` §13 item 1, `SECURITY.md` §16 item 2, `ARCHITECTURE.md` open
   question 3 and `SCRAPER.md` §16 item 4 are the same item seen from five sides and should be
   updated together.)
3. **Two tiers inside "server-only".** D8 has one server-only list, but `SCRAPER_USER_AGENT` is not a
   secret (its value is displayed, deliberately) and `GOOGLE_SHEETS_SPREADSHEET_ID` is an identifier
   rather than a credential. Suggested amendment: record the Secret / Sensitive / Server distinction
   in D8 so the Environment page's display rules follow from the canonical text rather than from this
   document.
4. **Contact details are content, not configuration.** SEED §21 places phone, email and map location
   in Site Settings while D8 holds only the WhatsApp number. That split is deliberate and works, but
   it is not stated canonically. Suggested amendment: one line in D8 recording that displayed contact
   details are `global_content`, never environment variables.


---

## Network reality in the Claude Code sandbox

Measured 2026-09-08, not assumed. This decides what can be *verified* in this environment
versus only written, and it is the reason several phases can be built but not tested here.

| Destination | Reachable | Evidence |
|---|---|---|
| `registry.npmjs.org`, pypi, crates, Go proxy | **yes** | on the proxy's `noProxy` allowlist |
| `raw.githubusercontent.com` | **yes** | the Phase 02 licence audit read every LICENSE this way |
| MCP servers (Cloudinary, Higgsfield, GitHub) | **yes** | routed via `mcp-proxy.anthropic.com`, which is allowlisted |
| `*.supabase.co` (REST, auth) | **no** | `curl: (56) CONNECT tunnel failed, response 403` |
| Supabase Postgres `:5432` and `:6543` | **no** | raw TCP refused; npm `:443` open in the same test, so the test is sound |
| `res.cloudinary.com` (delivery) | **no** | `connect_rejected` from the egress proxy |
| Higgsfield CDN (`d8j0ntlcm91z4.cloudfront.net`) | **no** | HEAD returns `000` |

**The rule this produces:** anything reachable only over direct HTTPS from the shell cannot be
exercised here — migrations cannot be applied, the app cannot be run against Supabase, and a
delivered Cloudinary URL cannot be fetched back to confirm it renders. Anything exposed through
an **MCP server** can be, which is why the Phase 06 canaries below were uploadable even though
the shell can reach neither Higgsfield nor Cloudinary: Cloudinary fetched the source itself,
server to server, with this environment never touching the bytes.

Migrations, seeds and integration checks therefore run from a machine with ordinary egress, or
from CI, which has executed since the repository went public on 2026-09-10 (next section).

---

## GitHub Actions — resolved 2026-09-10

**From 2026-09-08 until the repository went public on 2026-09-10, no run of the `CI` workflow was
assigned a runner.** Every job died about two seconds after creation with `runner_id: 0`, no steps
and `HTTP 404` for its logs — the signature GitHub emits when Actions is refused at the account
layer. The repository was private, so its minutes were metered against the account's allowance,
and that allowance was spent; adding a payment method did not change it. Making the repository
public did: public repositories get standard runners unmetered, and the next run executed. The
diagnosis that ruled out the code, the workflow file, the Actions permissions and a flake is kept
in this section's git history and on PR #3, and is not repeated here.

The first runs that did execute were red for real reasons — the unit step ran the RLS project
before `db:reset`, the idempotency step asserted a pre-Phase-09 shape, the seed failed on a
database without the Higgsfield media rows, three design gates were outside `npm run check`, and
the build had nothing to pre-render from. All five are fixed (`CHANGELOG.md`, "CI runs again").

### What the CI build reads

`next build` pre-renders the public site, and pre-rendering reads content — page data for every
static route, `generateStaticParams` on the dynamic ones, the sitemap — through PostgREST, never
through `DATABASE_URL`. CI holds no Supabase project, and it should not: a build gate that read
hosted content would change its answer with the owner's edits. So the `verify` job builds against
`scripts/db/local-rest.mjs`, the PostgREST shim Phase 10 wrote for running the site without a
Supabase project, pointed at the PostgreSQL service container the job has just migrated and
seeded. The binary is pinned by version and SHA-256 in the workflow; the shim mints a throwaway JWT
secret per run and prints the anon key for the build step to read. The only variables the build
receives are `NEXT_PUBLIC_SUPABASE_URL` (the shim), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the minted
key) and `NEXT_PUBLIC_SITE_URL`; none of the secrets in §5 is set in CI, and none is needed. What
the build sees is what the seed wrote, which is what a fresh deployment sees.

Playwright still does not run in CI (`docs/ops/TESTING.md`); every browser figure is from a local
run.

---

## Running a database locally

Phase 03 is verified against a real PostgreSQL, not a mock. Supabase's own CLI is not usable here
— `supabase start` and `supabase gen types` both require Docker, and no Docker daemon is available
in this environment — so the local database is a plain PostgreSQL cluster.

PostgreSQL 16.13 is installed in the image, with all four extensions the schema needs
(`pgcrypto`, `citext`, `pg_trgm`, `unaccent`). To bring one up:

```bash
PGROOT=/var/lib/postgresql/rivya
mkdir -p "$PGROOT" && chown postgres:postgres "$PGROOT"
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $PGROOT/data --encoding=UTF8 --locale=C.UTF-8"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGROOT/data \
  -o '-p 5433 -c listen_addresses=127.0.0.1' -l $PGROOT/server.log start -w"
psql -h 127.0.0.1 -p 5433 -U postgres -c "create database rivya;"

export DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5433/rivya"
npm run db:reset      # applies the auth shim, then migrations 0001-0012
npm run db:types      # regenerates lib/supabase/database.types.ts
npm run seed:content  # applies the taxonomy seed
```

**Seeding a database `DATABASE_URL` cannot reach.** `npx tsx scripts/seed/emit-sql.ts [--only=key,…]`
prints the runner's `global_content` INSERTs as SQL — the module's fields, the same
`seed_content_hash` over the same fields, the same version stamp, guarded by `where not exists` on
the seed key — for applying through the Supabase MCP or a SQL console. A row applied this way and a
row applied by the runner are indistinguishable afterwards, which is what a hand-written INSERT
cannot promise: without the hash, every later run reads the row as owner-edited and skips it for
ever. `global_content` only, and only records with no `refs` and no `media`; the rest is the
runner's job. Phase 21 used it to bring the hosted project level with local (56 rows).

**`DATABASE_URL` is the only variable these scripts read**, and they read it from the environment
rather than from `.env.local`. That is deliberate: `.env.local` points at the hosted Supabase
project, and `db:reset` DROPS EVERY OBJECT in the target schema. `scripts/db/reset.mjs` additionally
refuses any host that is not loopback unless `--allow-remote` is passed, so a misconfigured shell
fails loudly instead of destroying a real database.

**`db:reset` is for development databases only, and there is no supported reason to pass it
`--allow-remote`.** The script for a real database is **`db:migrate`**, which never drops anything:
it applies only what the target has not recorded, and refuses if a migration was edited after being
applied or if the database carries a version this repository does not have. See DEPLOYMENT.md §5.1.

### What the local database is NOT

It has no PostgREST, so `@supabase/supabase-js` cannot talk to it. That splits Phase 03's
verification cleanly, and the split is worth knowing before trusting either half:

| Proven against a real database | Proven with a fake client |
|---|---|
| Migrations apply to an empty database | Which table each repository queries |
| Every constraint accepts and rejects what it should | Which filters and ordering it applies |
| RLS is on with no policy, on every table | PostgREST error code → typed error mapping |
| Column tiers, enum values, D10 gates | Zod schema rejects a malformed row |
| The seed runner's whole idempotency contract | |

What NEITHER half proves is that RLS behaves as intended for a given role — no policy exists yet,
and Phase 04 is where that becomes testable.

### The `auth.users` shim

Every `updated_by`, `published_by`, `created_by` and `uploaded_by` column references
`auth.users(id)`. Supabase provisions that table before any migration runs; a plain cluster does
not have it. `supabase/local/00-auth-shim.sql` creates the minimum the foreign keys point at, and
`db:reset` applies it before migration 0001.

It lives **outside** `supabase/migrations/` so it can never be picked up by `supabase db push`.
The point of the shim is that the migrations stay production-accurate — they are not weakened to
"uuid with no foreign key" in order to be testable, and the entire difference between local and
hosted is one file.
