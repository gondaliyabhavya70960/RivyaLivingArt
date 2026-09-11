---
doc: DEPLOYMENT
status: CURRENT
owning_phase: 44
last_reviewed: 2026-09-07
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# DEPLOYMENT — environments, migrations, releases and rollback

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/ops/ENVIRONMENT.md` (every variable and where it is set),
> `docs/ops/SECURITY.md` (headers, secrets, rotation blast radius),
> `docs/ops/TESTING.md` (what must be green before a release),
> `docs/media/CLOUDINARY.md` (the media migration this document sequences).
> Owned by Phase 44; extended by Phase 38 (Environment page) and by every phase that adds a cron
> route — 09, 25, 31, 32, 36, 37, 38 (§3.1).

**Implementation status.** Nothing is deployed. No Vercel project, no Supabase project, no domain.
This document is the procedure Phase 44 implements and the drills it must execute; the rows marked
**OWNER_VERIFICATION_REQUIRED** cannot be filled in by an engineer.

**The property this document buys** is not "it is deployed". It is: **a bad deploy can be undone in
under five minutes without data loss.**

---

## 1. Environments

Three environments, two Supabase projects. A preview deployment **never** connects to production.

| Environment | Git source | Vercel | Supabase project | Cloudinary | Data |
|---|---|---|---|---|---|
| **Production** | `main`, promoted manually | Production deployment | `rivya-prod` | Rivya account, `rivya/**` folders | Real content and real enquiries |
| **Preview** | Every pull-request branch | Preview deployment, access-protected | `rivya-staging` | Same account, same folders (read-only usage) | Fixture data only |
| **Development** | Local working tree | `next dev` | Local `supabase start` | Same account or unset | Fixture data only |

Rules that make the separation real:

1. `scripts/ops/check-env.ts` compares the configured Supabase project ref against the value expected
   for the current `VERCEL_ENV` and **fails the build** if a preview points at production.
2. Production data is never copied downward (`BUSINESS_RULES.md` BR-I3). Staging is seeded from the
   Phase 42 fixture.
3. Preview and development use a **test** WhatsApp number. `check-env.ts` fails if the preview number
   equals the production number, so a reviewer cannot message the owner's phone from a draft.
4. Every non-production response carries `X-Robots-Tag: noindex, nofollow`, Vercel deployment
   protection is on, and `components/patterns/EnvironmentRibbon.tsx` renders a visible ribbon from
   `VERCEL_ENV`.

---

## 2. Branch strategy

```
feature/<phase>-<slug>   →  PR  →  main  →  (manual promote)  →  production
```

| Rule | Detail |
|---|---|
| Trunk | `main` is always deployable. It is protected: no direct pushes, no force pushes |
| Branch naming | `feature/<nn>-<slug>` where `nn` is the owning phase, e.g. `feature/20-inquiry-flow`; `fix/<slug>`; `docs/<slug>` |
| One phase per branch | A branch implements one phase or one coherent slice of it. A branch that touches three phases cannot be reviewed against a phase's exit criteria |
| Required checks | `npm run check`, unit, integration, docs-contract, e2e (4 shards), visual, Lighthouse, a11y sweep, secret scan. `docs/ops/TESTING.md` §8 is the authoritative list |
| Merge style | Squash merge; the squash message is the changelog entry |
| Merging to `main` | Deploys nothing to production. It builds a production-grade deployment and runs the staging migration; promotion is a separate human act |
| Tagging | `v<year>.<n>` on each promoted release, annotated with the phase(s) it completes |
| Reverting | Revert the merge commit for code. **Never** revert a migration — see §5 |

---

## 3. Platform configuration

`vercel.json` is committed and holds:

| Setting | Value | Why |
|---|---|---|
| Framework | `nextjs` | — |
| Install command | `npm ci` | The lockfile is the only accepted resolution source |
| Build command | `npm run build` | Which **never** contacts a database (§4) |
| Region | `bom1` (default) | Chosen for the expected audience. **The audience geography is OWNER_VERIFICATION_REQUIRED**; the region is a reversible setting recorded here, never a claim rendered anywhere |
| Function config | Raised memory/duration for `app/api/cron/research` (`maxDuration = 60`, a 50-second work budget) and for `app/api/media/sign` | Bounded work still needs headroom |
| Cron entries | **All seven**, registered for **production only** | A preview must never start a scrape, publish a scheduled window, or write to the owner's spreadsheet |

### 3.1 The cron registry — all seven routes

`ARCHITECTURE.md` §3 fixes the set at seven. Every one of them must have a `vercel.json` entry: a
route with no entry is a scheduled job that silently never runs, which is the failure mode this table
exists to prevent. Vercel evaluates cron expressions in **UTC**.

| Route | `vercel.json` schedule | Cadence | Auth | Owning phase | Purpose |
|---|---|---|---|---|---|
| `app/api/cron/content-schedule` | `*/5 * * * *` | Every 5 minutes | `REVALIDATE_SECRET` | 09 (extended by 22) | Opens and closes `publish_at` / `unpublish_at` windows through the same `publishSection()` a manual publish uses, runs the merchandising pass, and revalidates the affected tags and paths |
| `app/api/cron/research` | `*/5 * * * *` | Every 5 minutes | **`x-vercel-cron` header only**; 404 without it | 25 | Drains research work items in bounded, resumable slices; per-source `research_source_schedules` (minimum 6-hour interval) decide which sources are due. Also prunes snapshots at 180 days |
| `app/api/cron/research-analytics` | `30 18 * * *` | Nightly | `REVALIDATE_SECRET` | 31 | Writes the dated `research_analytics_snapshots` and `research_metric_coverage` rows |
| `app/api/cron/research-score` | `30 19 * * *` | Nightly, **after** research-analytics | `REVALIDATE_SECRET` | 32 | Recomputes opportunity scores and components against the active scoring model |
| `app/api/cron/sheets-sync` | `0 * * * *` | Hourly | `CRON_SECRET` (A25, A37) — **built, Phase 36** | 36 | Runs the `sheets_export_definitions` whose own `schedule` has fired since their last run (minimum interval hourly; `MANUAL` is the default and is skipped), skips paused and disabled definitions, and answers `skipped: flag_off` without writing anything while `google_sheets` is off |
| `app/api/cron/analytics-snapshot` | `30 20 * * *` | Daily | `REVALIDATE_SECRET` | 37 | One first-party metric row per metric per day, idempotent per date |
| `app/api/cron/log-retention` | `30 21 * * *` | Daily | `REVALIDATE_SECRET` | 38 | Purges `system_logs`, `web_vitals_samples`, `search_queries`, `rate_limit_buckets` and orphaned `inquiry_attachments` per the `BUSINESS_RULES.md` §I retention table |

**The only ordering constraint is `research-score` after `research-analytics`** — a score computed
before the night's snapshot exists is a score against yesterday's coverage. The rest of the wall-clock
placement is a preference, not a requirement: the four nightly and daily jobs are spaced an hour apart
so a slow one cannot overlap the next, and 18:30–21:30 UTC (00:00–03:00 local to the `bom1` region) is
off-peak there. That region choice rests on the audience assumption already recorded as
**OWNER_VERIFICATION_REQUIRED** in §3; if the assumption changes, these four times move and nothing
else does.

**Two authentication schemes, deliberately.** Six routes carry `REVALIDATE_SECRET`. `research` carries
Vercel's `x-vercel-cron` header **alone** and returns `404` — not `401` — to anything else, so a prober
cannot confirm the route exists; it does not reuse `REVALIDATE_SECRET` because that secret guards cache
invalidation and this is the one route that contacts third-party hosts (`SCRAPER.md` §7). The cost is
that `research` cannot be exercised outside Vercel. §13 item 1 proposes normalising all seven onto a
`CRON_SECRET`; both schemes must move in one change, not one route at a time.

**Verification that the registry is complete**, run as part of §7.1 step 8: `scripts/ops/check-env.ts`
compares the route directories present under `app/api/cron/**` against the `crons` array in
`vercel.json` and fails the build on either a route with no entry or an entry with no route.

`next.config.ts` additionally holds the `www` → apex 308 redirect, the image configuration and the
`ANALYZE=1` analyzer wiring.

---

## 4. The central decision: builds never migrate

`next build` never touches a database. Migration is a separate, explicit, gated job. This is what
makes a rollback safe, because code and schema move independently.

| Step | Trigger | Runs | Gate |
|---|---|---|---|
| 1. Replay proof | Every PR | `supabase db reset` against an ephemeral Postgres, then the full suite | CI required |
| 2. Staging migrate | Merge to `main` | `supabase db push --linked` against `rivya-staging`, then e2e smoke against the staging deployment | CI required |
| 3. Production migrate | Manual `workflow_dispatch` | `pg_dump` snapshot, then `supabase db push --linked` against `rivya-prod` | **Human approval** in a GitHub Environment |
| 4. Promote | Manual | Vercel promotes the already-built deployment to production | Human, only after step 3 reports success |

### 4.1 Migration discipline

| Rule | Detail |
|---|---|
| Forward-only | Numbered files in `supabase/migrations/`, one subject per file, never edited after they have run anywhere |
| **No `down` migrations** | A down migration that has never run against production data is untested code executing at the worst possible moment. Forward-fix is the only supported path |
| Expand / contract | Every change is additive first. Add the column, backfill, switch reads, and only remove in a later release. Consequence: the code deployed *before* step 3 keeps working *after* it, and the code deployed *after* step 4 also worked against the pre-migration schema — which is exactly what makes step 4 reversible |
| Numbering | Four digits, allocated per phase as `DATA_MODEL.md` §12 records. A collision is a merge conflict, resolved by renumbering the later branch |
| Verification | `tests/integration/migrations-replay.test.ts` applies every migration to an empty database in order, every PR. This is D9 point 10 made mechanical |

---

## 5. Seeding on first deploy

Seeding is an **offline script** (runtime R6), run deliberately by a human against a named database.
It is never part of the build, never part of a request, and never automatic.

### 5.1 The order, once, for a brand-new environment

```
1. npm run db:migrate               apply every migration to the empty project
2. npm run db:types                 regenerate lib/supabase/database.types.ts; expect no diff
3. npm run seed:content             SEED §4 idempotent seed, content_seed_version = "rivya-v1"
4. npm run manifest:verify          prove the 250-asset manifest is unchanged before it is imported
5. npm run media:migrate:higgsfield manifest → media_assets → Cloudinary
6. npm run seed:content             run it a second time; expect zero changed rows
7. (owner)                          invite staff, set contact details, review the verification backlog
8. (owner)                          publish what they have verified
```

| Step | What it must do | What it must never do |
|---|---|---|
| 3 | Insert missing rows keyed by `seed_key`; update rows whose `seed_content_hash` still matches what the runner last wrote; report `inserted / updated / skipped_owner_edited` | Delete a row; change `status`; change `owner_verification`; overwrite an owner-edited row |
| 5 | Create one `media_assets` row per manifest entry with `source = 'HIGGSFIELD'`, `is_ai_generated = true`, `is_concept = true`, `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`, `alt_text` from `alt_text_draft`, `rivya_asset_id` as identity, `status = 'DRAFT'` | Regenerate anything; rename a `rivya_asset_id`; write a second row for an existing `higgsfield_generation_id` |
| 6 | Prove idempotency on the real database, not only in tests. A non-empty `skipped_owner_edited` list on a live environment is the healthy outcome | Force-write anything it reports as skipped |

### 5.1.1 Running step 1 against the hosted project

`db:migrate` (`scripts/db/migrate.mjs`) is forward-only. It records a SHA-256 per migration in
`public.schema_migrations`, applies only what the target has not recorded, and commits each
migration together with its ledger row in one transaction so a failure leaves neither. It refuses
outright on two conditions: a migration **edited after it was applied**, and a version present in
the database but absent from this repository. `--plan` (the default) reports and changes nothing.

**Do not use `db:reset` here.** It drops schema `public`; it exists for development databases and
refuses a non-loopback host without an explicit flag.

Two ways to run it:

| | |
|---|---|
| **From a machine with egress** | `DATABASE_URL=<session pooler string> npm run db:migrate -- --allow-remote` to plan, then add `--apply` |
| **From GitHub Actions** | Actions → **Database migrate (hosted)** → Run workflow. `workflow_dispatch` only. Needs the repository secret `SUPABASE_DB_URL`. `mode: plan` is the default; `mode: apply` additionally requires typing the project ref, checked against the secret |

**The connection string must be the Session Pooler**, from Supabase → Project Settings → Database:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Not `db.<ref>.supabase.co` — that endpoint is IPv6-only, and anywhere without an IPv6 route
(GitHub-hosted runners included) it times out after minutes in a way that reads like a firewall
problem. Not port 6543 — transaction mode cannot hold the session DDL needs. `migrate.mjs` rejects
the first mistake by name rather than letting it time out.

Note that `supabase/local/00-auth-shim.sql` is **never** applied to a hosted project. It stands in
for the `auth` schema, the roles and the grants that Supabase provisions itself; applying it to a
live project would redefine `auth.uid()` and re-grant roles Supabase manages. `db:migrate` reads
only `supabase/migrations/`, so it cannot pick the shim up.


### 5.2 Re-running the seed on an environment that already has content

Permitted and expected — that is what idempotency is for. The runner:

1. computes `sha256` over the seedable fields it is about to write;
2. inserts when the row is absent;
3. updates when the stored `seed_content_hash` matches (nobody has touched it since);
4. **skips and reports** when the hashes differ, because a human edited it;
5. never deletes, and never changes `status` on an existing row.

A run prints a table of `seed_key → action`. A non-empty `skipped_owner_edited` list is the normal,
healthy outcome on a live environment; it is not a failure.

### 5.3 Zero products, zero projects, zero testimonials

The seed creates **no** `products`, `product_specs`, `portfolio_projects` or `testimonials` rows,
ever (SEED §32, BR-D1). A first deploy therefore shows the seeded empty states, which is the correct
and honest result — not a defect to be "fixed" with sample data.

---

## 6. Rollback

### 6.1 Decision table

| Symptom | Lever | Time | Data loss |
|---|---|---|---|
| Bad code; schema unchanged or expand-only | Vercel instant rollback: promote the previous deployment | < 2 min | None |
| Bad migration; no data written under it | Forward-fix migration reversing the change, then steps 3–4 | < 30 min | None |
| Bad migration; data written under it | Forward-fix **with a backfill**; never a `down` migration | Hours | None if the backfill is correct |
| Data corruption or a destructive mistake | Supabase point-in-time restore to a chosen timestamp | Plan-dependent | Up to the RPO |
| Cloudinary asset deleted in error | Cloudinary backup restore for the affected public id | Minutes | None if backups are enabled |
| A bulk Studio action went wrong | The Phase 24 24-hour undo, from `bulk_operations` snapshots | Minutes | None within the window |
| Cache serving stale or wrong content | Re-publish the entity, or POST `/api/revalidate` with the affected tags | Seconds | None |

**OWNER_VERIFICATION_REQUIRED:** the Supabase plan's PITR window and the Cloudinary backup retention
setting. The procedure above is complete; the retention numbers are the owner's to supply.

### 6.2 Drills — executed, timed and recorded

Both drills run during Phase 44 and again after any change to the deployment pipeline.

| Drill | Procedure | Target | Last run |
|---|---|---|---|
| Rollback | Deploy a deliberately broken build to staging, promote it, roll back by promoting the previous deployment | < 5 minutes | NOT YET RUN |
| Forward-fix | Apply an expand migration to staging, deploy code that uses it, roll the **code** back only, confirm the older code still functions against the newer schema | Passes | NOT YET RUN |

Record the elapsed time and the date in this table. A drill that has never been run is not a
capability.

---

## 7. Release checklist

Run top to bottom. `scripts/ops/preflight.ts` automates steps 1–8 and prints one summary table; the
rest are human acts.

### 7.1 Before merge

- [ ] 1. `npm run check` — types, lint, client-boundary, tokens, data-layer, research isolation, asset IDs.
- [ ] 2. `npm run test` — unit and integration, including `migrations-replay` and `seed-idempotency`.
- [ ] 3. `npm run build && npx playwright test` — e2e and visual across the eight QA widths.
- [ ] 4. Lighthouse CI over the route matrix, within `perf/budgets.json`.
- [ ] 5. Axe sweep — zero critical, zero serious; `tests/e2e/a11y/exceptions.json` empty.
- [ ] 6. `node scripts/security/check-secret-exposure.mjs`, `gitleaks`, `npm audit --audit-level=high`.
- [ ] 7. `node scripts/docs/check-doc-contract.mjs` — every touched path has its required document change.
- [ ] 8. `npx tsx scripts/ops/check-env.ts` — every required variable present for the target environment; **no value printed**.
- [ ] 9. Review the phase's exit criteria in `docs/project/phases/PHASE-*.md`. Every box ticked, with evidence.
- [ ] 10. `PROJECT_STATE.md`, `CHANGELOG.md`, `docs/SESSION-STATE.md`, `docs/project/ROADMAP.md` updated (D9).

### 7.2 Merge and staging

- [ ] 11. Squash-merge to `main`. Confirm the preview deployment built.
- [ ] 12. `migrate-staging` ran `supabase db push` against `rivya-staging` and reported success.
- [ ] 13. `tests/e2e/deploy-smoke.spec.ts` green against the staging deployment.
- [ ] 14. Open the staging site: homepage, one category, one product, the inquiry form, `/studio`. Nothing 500s.

### 7.3 Production migration

- [ ] 15. Trigger `migrate-production`. Confirm it stops at the approval gate.
- [ ] 16. Approve. Confirm the workflow log shows the `pg_dump` snapshot **and** the push.
- [ ] 17. `/studio/system/environment` on the previous production deployment still reports healthy (the old code runs against the new schema — expand/contract).

### 7.4 Promote

- [ ] 18. Promote the built deployment in Vercel.
- [ ] 19. `curl -sI https://<apex>/` — HSTS with `preload`, the full Phase 41 header set, **no** `noindex`.
- [ ] 20. `curl -sI https://www.<apex>/` — 308 to apex.
- [ ] 21. `/studio/system/environment` — commit SHA matches `git rev-parse HEAD`; every integration reachable; migration state current; **no value, prefix or length anywhere**.
- [ ] 21a. The Vercel project's Cron Jobs view lists **all seven** §3.1 routes at the schedules in that table, and lists none that is not in it. A route missing here never runs and never errors.

### 7.5 Post-deploy verification

- [ ] 22. Walk the conversion path on a real device: `/` → category → product → enquire → submit → confirm the `inquiries` row exists → confirm the WhatsApp URL carries the persisted reference.
- [ ] 23. Read every public page once for tone and factual integrity against SEED §55. No fabricated fact, no concept media presented as delivered work.
- [ ] 24. Publish one content change from the Studio and confirm it appears within its revalidation window.
- [ ] 25. `/studio/operations/logs` — no `ERROR` or `SECURITY` entries from the deploy window.
- [ ] 26. Record the release in `CHANGELOG.md` and update `PROJECT_STATE.md` phase status.

---

## 8. Domain, DNS and TLS

**The domain is owner-supplied: OWNER_VERIFICATION_REQUIRED.** The steps below are written so the
owner or their registrar can act without an engineer present.

| Step | Action |
|---|---|
| 1 | Add the apex domain and `www` to the Vercel project |
| 2 | At the registrar, create the records Vercel displays: an `A` (or `ALIAS`/`ANAME`) record for the apex and a `CNAME` for `www` |
| 3 | Wait for verification; Vercel issues and renews TLS automatically |
| 4 | Confirm `www` 308-redirects to the apex (configured in `next.config.ts`, not at the DNS layer) |
| 5 | Confirm HSTS is served with `includeSubDomains; preload`. **Only submit to the preload list once the apex and every subdomain are permanently HTTPS** — the entry is slow to reverse |
| 6 | Set `NEXT_PUBLIC_SITE_URL` to the apex, with protocol and no trailing slash, and redeploy |

---

## 9. Secret rotation runbook

Order of operations, always: **create new → set in Vercel → redeploy → verify → revoke old.** Never
revoke first. `docs/ops/ENVIRONMENT.md` §5 holds the per-variable detail; the blast radius is in
`docs/ops/SECURITY.md`.

| Secret | Rotated by | Cadence | Procedure notes |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **Owner** | 90 days | Requires a redeploy. Full-database bypass if leaked — rotate immediately on any suspicion |
| `DATABASE_URL` | **Owner** | 90 days | Contains credentials. Rotate the database password, update the pooled URL, redeploy |
| `CLOUDINARY_API_KEY` / `_API_SECRET` | **Owner** | 180 days | Rotate as a pair. Signed uploads fail until the redeploy completes |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Owner** | 180 days | Create the new key, set it, redeploy, verify a Sheets sync, then delete the old key in Google Cloud |
| `REVALIDATE_SECRET` | Engineer | 90 days | Read by `app/api/revalidate` and by **six of the seven** cron routes (`app/api/cron/research` uses the platform header instead — §3.1). Rotate in one window; a mismatch means stale pages and skipped scheduled jobs, not an outage. Confirm afterwards that a `content-schedule` tick has run |
| `SCRAPER_USER_AGENT` | Engineer | On change | Not a secret. Must remain identifying and contactable |

After any rotation: redeploy, open `/studio/system/environment`, confirm every integration reports
reachable, and record the date. If a secret is believed exposed, follow `SECURITY.md` §11 (incident
response) — rotation alone is not the whole response.

---

## 10. Observability and on-call

| Source | What it answers |
|---|---|
| `system_logs` (`/studio/operations/logs`) | What the machine did and where it failed, with `request_id` and commit SHA |
| `audit_logs` (`/studio/operations/audit`) | Who was allowed or refused to do what |
| Vercel runtime logs | Platform-level failures the application never saw |
| `/studio/system/environment` | Is it up, what is deployed, which migration is applied |
| Lighthouse CI history + `web_vitals_samples` | Whether performance moved |

There is **no on-call rotation**, no paging, no third-party APM, RUM or uptime vendor. That is a
deliberate scope decision, stated plainly here so nobody assumes coverage that does not exist. If
the owner wants monitoring, it is an amendment with a named provider and its variables added to D8.

---

## 11. Out of scope

Multi-region deployment, edge replicas, active-active topology · blue/green or canary releases
(Vercel's atomic deploy plus instant rollback covers the risk at this scale) · infrastructure as code
for Supabase or Cloudinary (both are dashboard-configured and documented here) · automated production
migration on merge (a production schema change requires a human) · a staging copy of production data
(forbidden by BR-I3) · uptime vendors, status pages and on-call tooling.

---

## 12. Owner-verification backlog for this document

| # | Item | Needed for |
|---|---|---|
| 1 | The domain name and registrar access | §8 |
| 2 | Supabase plan and its PITR window | §6.1 |
| 3 | Cloudinary backup enablement and retention | §6.1 |
| 4 | Production WhatsApp number (and a separate test number) | §1, `ENVIRONMENT.md` |
| 5 | Audience geography, to confirm or change the `bom1` region | §3 |
| 6 | Whether MFA is enforced for `owner` and `admin` in Supabase | `SECURITY.md` |
| 7 | Who holds the Vercel, Supabase, Cloudinary and Google Cloud accounts, and who may rotate each secret | §9 |

---

## 13. Open questions for the canonical decisions

1. **No cron secret in D8, and two schemes in one deployment.** D8 lists `REVALIDATE_SECRET` but
   nothing for scheduled invocation, so six of the seven §3.1 routes reuse it and one secret guards
   both cache invalidation and every scheduled job. The seventh, `app/api/cron/research`, authenticates
   on Vercel's `x-vercel-cron` header **alone** — it does not reuse `REVALIDATE_SECRET` at all — which
   leaves the route with the widest reach on the only scheme that cannot be exercised outside Vercel.
   Suggested amendment: add `CRON_SECRET` to D8's server-only list and normalise all seven onto it.
   `SCRAPER.md` §16 item 4, `ARCHITECTURE.md` open question 3 and `SECURITY.md` §16 item 2 point at
   this same amendment and must be resolved together.
2. **Vercel system variables are not in D8.** `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA` and
   `VERCEL_GIT_COMMIT_REF` are platform-injected, are not secrets and are not configured by anyone,
   but they are read by the Environment page and by `check-env.ts`. Suggested amendment: note in D8
   that platform-injected variables are permitted and are not project-set.
3. **Deployment region is not a canonical decision.** `bom1` is recorded here as a reversible setting
   dependent on an owner fact. If it should be fixed, it belongs in D1 alongside "Hosting: Vercel".
