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
> Owned by Phase 44; extended by Phase 38 (Environment page) and Phase 25 (cron entries).

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
| Function config | Raised memory/duration for `app/api/cron/research` and `app/api/uploads/sign` | Bounded work still needs headroom |
| Cron entries | Registered for **production only** | A preview must never start a scrape |

Cron routes and their schedules (owned by Phases 25 and 38; the route 404s without the platform cron
header):

| Route | Cadence | Purpose |
|---|---|---|
| `app/api/cron/research` | Per the enabled source schedules | Drains research work items in bounded, resumable slices |
| `app/api/cron/log-retention` | Daily | Purges `system_logs`, `web_vitals_samples`, `search_queries`, `rate_limit_buckets` per the retention table |
| `app/api/cron/schedule` | Every 15 minutes | Opens and closes `publish_at` / `unpublish_at` windows and revalidates the affected tags |

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
| `REVALIDATE_SECRET` | Engineer | 90 days | The publish service and the cron routes read it. Rotate in one window; a mismatch means stale pages, not an outage |
| `SCRAPER_USER_AGENT` | Engineer | On change | Not a secret. Must remain identifying and contactable |

After any rotation: redeploy, open `/studio/system/environment`, confirm every integration reports
reachable, and record the date. If a secret is believed exposed, follow `SECURITY.md` §11 (incident
response) — rotation alone is not the whole response.

---

## 10. Observability and on-call

| Source | What it answers |
|---|---|
| `system_logs` (`/studio/operations/logs`) | What the machine did and where it failed, with `request_id` and commit SHA |
| `audit_log` (`/studio/operations/audit`) | Who was allowed or refused to do what |
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

1. **No cron secret in D8.** D8 lists `REVALIDATE_SECRET` but nothing for scheduled invocation, so
   the cron routes reuse it (with Vercel's `x-vercel-cron` header as a second factor for the research
   route). One secret currently guards both cache invalidation and every scheduled job. Suggested
   amendment: add `CRON_SECRET` to D8's server-only list.
2. **Vercel system variables are not in D8.** `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA` and
   `VERCEL_GIT_COMMIT_REF` are platform-injected, are not secrets and are not configured by anyone,
   but they are read by the Environment page and by `check-env.ts`. Suggested amendment: note in D8
   that platform-injected variables are permitted and are not project-set.
3. **Deployment region is not a canonical decision.** `bom1` is recorded here as a reversible setting
   dependent on an owner fact. If it should be fixed, it belongs in D1 alongside "Hosting: Vercel".
