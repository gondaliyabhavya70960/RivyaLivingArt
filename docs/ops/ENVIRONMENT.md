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
| Without it | The signing endpoint `/api/uploads/sign` fails; Studio uploads and the media migration stop. **Delivery of existing assets is unaffected** — delivery URLs need only the cloud name |
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

### `GOOGLE_SHEETS_SPREADSHEET_ID`

| | |
|---|---|
| Class | Sensitive — not a credential, but it identifies a private document |
| Purpose | The target spreadsheet for research exports |
| Set in | Vercel (server scope) per environment; a **test** sheet outside production |
| Read by | `lib/sheets/**` |
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
| Purpose | Guards `POST /api/revalidate` (the only cache-invalidation entry point) and the cron routes |
| Set in | Vercel (server scope) per environment, unique per environment; `.env.local` |
| Read by | `app/api/revalidate/route.ts`, `app/api/cron/**`, `lib/cms/publishing.ts` |
| Without it | Publishing still writes, but the cache is not invalidated: pages stay stale for at most their `revalidate` window and a `WARNING` is written to `system_logs` on channel `CONTENT`. Cron routes reject every invocation |
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

### 5.1 Platform-injected variables

`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF` are injected by the
platform, are not secrets, and are configured by nobody. They are read for the Environment page's
build panel, the environment ribbon and `check-env.ts`. D8 does not list them because D8 lists
variables the **project** sets; this is raised in §9 so a reader does not treat their use as a
divergence. `NODE_ENV` is set by the tooling. `ANALYZE=1` is a local-only bundle-analyzer switch.

---

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
| `REVALIDATE_SECRET` | Stale pages for at most the `revalidate` window | Publish succeeds; a `WARNING` names the uncleared tags | `system_logs`, channel `CONTENT` |

---

## 9. Open questions for the canonical decisions

1. **Platform-injected variables are not in D8.** `VERCEL_ENV`, `VERCEL_URL`,
   `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF` are read by the Environment page and
   `check-env.ts`. Suggested amendment: note in D8 that platform-injected variables are permitted
   and are not project-set.
2. **No cron secret.** The cron routes currently reuse `REVALIDATE_SECRET`. Suggested amendment: add
   `CRON_SECRET` to D8's server-only list so one secret does not guard two unrelated capabilities.
3. **Two tiers inside "server-only".** D8 has one server-only list, but `SCRAPER_USER_AGENT` is not a
   secret (its value is displayed, deliberately) and `GOOGLE_SHEETS_SPREADSHEET_ID` is an identifier
   rather than a credential. Suggested amendment: record the Secret / Sensitive / Server distinction
   in D8 so the Environment page's display rules follow from the canonical text rather than from this
   document.
4. **Contact details are content, not configuration.** SEED §21 places phone, email and map location
   in Site Settings while D8 holds only the WhatsApp number. That split is deliberate and works, but
   it is not stated canonically. Suggested amendment: one line in D8 recording that displayed contact
   details are `global_content`, never environment variables.
