---
doc: SECURITY
status: CURRENT
owning_phase: 41
last_reviewed: 2026-09-07
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# SECURITY — threat model and posture

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/ops/ENVIRONMENT.md` (variables and the status-page contract),
> `docs/ops/DEPLOYMENT.md` (rotation and rollback), `docs/project/BUSINESS_RULES.md` (§F, §G, §I, §J),
> `docs/architecture/ARCHITECTURE.md` (runtime boundaries, §8 logging, §9 posture summary),
> `docs/architecture/SCRAPER.md` (the research subsystem's own rules).
> Owned by Phase 41; the auth section is established by Phase 04 and the redactor by Phase 38.

**Implementation status.** No application code exists. This document is the posture Phase 04, 38 and
41 implement against, and the evidence a reviewer or a commissioned auditor would examine.

**Not claimed anywhere:** that this system is secure, certified, audited or compliant. No ISO, SOC 2
or PCI claim may be made (PCI is meaningless here — there is no payment surface). A published
security or compliance statement is an assertion about an organisation and is
**OWNER_VERIFICATION_REQUIRED**.

---

## 1. What we are protecting

| # | Asset | Why it matters | Worst realistic outcome |
|---|---|---|---|
| A1 | Enquirer personal data (`inquiries`, `inquiry_attachments`) | The only personal data in the system: name, phone, optional email, city, message, uploaded photos of people's homes | Disclosure of private contact details and interior photographs |
| A2 | Studio write access | Publishing controls what the public reads as Rivya's word | Defacement, fabricated claims published under the brand, destructive bulk edits |
| A3 | The service-role key and `DATABASE_URL` | Total bypass of every policy | Full read/write of every table, including A1 |
| A4 | Cloudinary credentials | The media library is the brand's visual identity | Arbitrary upload, deletion and transformation against the account |
| A5 | Content integrity | An unverified claim published under Rivya's name is a business and legal risk, not a cosmetic one | A capability, certification or durability claim nobody can stand behind |
| A6 | Research isolation | Competitor data reaching a public surface is a legal and reputational failure | Third-party content republished as Rivya's |
| A7 | Availability of the public site | The site is the front door | Outage or defacement during a campaign |
| A8 | The Google service-account identity | It can reach whatever Google Cloud grants it | Lateral access beyond one spreadsheet |

---

## 2. Actors

| Actor | Capability by design | Trusted for |
|---|---|---|
| Public visitor (`anon`) | Read `status = 'PUBLISHED'` rows; insert exactly one inquiry | Nothing. Every input is hostile until Zod parses it |
| Staff (`viewer` → `owner`) | Exactly one role's permissions | What the matrix grants, re-checked per action |
| Deployment operator | Vercel, Supabase, GitHub Actions | Rotation, migration approval, promotion |
| Third-party sites (research targets) | Serve HTML to our fetcher | **Nothing.** B6 is the most hostile boundary in the system |
| Upstream services (Supabase, Cloudinary, Google) | Return data and errors | Their data, once schema-validated; **never** their error strings |
| Automated scanners and bots | Whatever the internet does | Nothing |

---

## 3. Trust boundaries and entry points

Six runtimes (`ARCHITECTURE.md` §2) and nine Zod boundaries (B1–B9). Every externally reachable
entry point, with its guard chain:

| Entry point | Auth | Guard chain |
|---|---|---|
| `GET app/(site)/**` | None | RLS (`status = 'PUBLISHED'`) → cached render → headers |
| `POST submitInquiry` (server action) | None | Origin check → Zod (B1) → honeypot → 3 s floor → rate limit → transaction → typed result |
| `POST /api/inquiries` | None | Same chain, as a route handler (B3) |
| `GET /api/search/suggest` | None | Zod → rate limit → public index only → `s-maxage=60` |
| `POST /api/vitals` | None | Zod (rejects any extra key) → rate limit → service-role insert |
| `POST /api/revalidate` | `REVALIDATE_SECRET` | Secret → Zod → tag/path invalidation only |
| `app/api/cron/**` | `REVALIDATE_SECRET` + platform cron header | 404 without the header; bounded, resumable work |
| `GET /studio/**` | Session | Middleware redirect → session resolve → `requirePermission()` **per page** → RLS |
| Studio server actions | Session | Origin → Zod (B2) → session → permission → work → audit |
| `POST /api/uploads/sign` | Session | Permission → folder allowlist → MIME allowlist → size ceiling → per-user rate limit → signature |
| `POST /api/auth/sign-out` | Session | POST only → clear → audit |

**Middleware redirects; it never authorises.** A page that relies on navigation not showing a link is
unprotected. Every Studio page and every mutation re-checks server-side (D4).

---

## 4. Threat model

Ranked by expected impact. Each threat names its mitigation **and** the artefact that proves the
mitigation works.

### T1 — Enquirer data disclosure (A1)

| | |
|---|---|
| Vectors | An `anon` `select` policy added to `inquiries`; personal fields leaking into the search index, vitals, logs or audit blobs; a preview environment seeded with production data; an attachment served from a public bucket |
| Mitigations | RLS-INQUIRY: `anon` has `insert` only and **no `select` policy at all** · attachments in a **private** bucket, reached only through a short-lived signed URL with `Content-Disposition: attachment` · `search_documents` excludes inquiry personal fields · the vitals schema rejects any extra key · `redactDeep` over audit blobs and every error path · production data never travels downward (BR-I3) |
| Proof | `tests/unit/rls/inquiries.test.ts`, `tests/unit/pii-scope.test.ts`, `scripts/ops/check-env.ts` |

### T2 — Privilege escalation inside the Studio (A2)

| | |
|---|---|
| Vectors | Calling a server action directly with a lower role; a page that trusts navigation; a self-service role change; a crafted inquiry insert that assigns itself |
| Mitigations | Two enforcement nets — RLS (role-level, in the database) and `requirePermission()` (permission-level, per action) · the role list is generated from `lib/auth/permissions.ts` with a CI drift check, so the nets cannot disagree · role changes require `system.users.manage`; `system.owner.transfer` is `owner`-only · the inquiry insert policy pins `pipeline_status`, `assigned_to` and `updated_by` |
| Proof | `tests/e2e/studio-authz.spec.ts` (as `viewer`, direct POSTs to publish, bulk-apply, media-delete and role-change all return 403 **and** each writes an `audit_log` row with `result = 'DENIED'`), `scripts/security/check-action-guards.mjs` |

### T3 — Secret exposure (A3, A4, A8)

| | |
|---|---|
| Vectors | A secret imported into a client component; printed in a log or an error; rendered on the Environment page; committed to git; pasted into an issue or a screenshot |
| Mitigations | Four independent layers — §5 |
| Proof | Each layer ships with a seeded counter-example that must fail it |

### T4 — Publication of an unverified or fabricated claim (A5)

| | |
|---|---|
| Vectors | Publishing a row that carries `OWNER_VERIFICATION_REQUIRED`; a seed run overwriting an owner's correction; concept media attached as product photography; a named client published without consent |
| Mitigations | Database triggers and constraints, not interface politeness: publication is unreachable while `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`; the concept-media trigger; the consent gate; the seed runner never changes `status` or `owner_verification` |
| Proof | `tests/integration/publish-gates.test.ts`, `tests/integration/seed-idempotency.test.ts` |
| Note | This is a *security* threat, not only an editorial one: the harm is a claim nobody can stand behind, published under the brand |

### T5 — Research data escaping isolation (A6)

| | |
|---|---|
| Vectors | An `anon` policy on a `research_*` table; a public route importing a research repository; a public search document with a research `entity_type`; an automated import into `products` |
| Mitigations | RLS-RESEARCH has no `anon` policy, ever · `check-research-isolation.mjs` fails the build if one is added · `check-data-layer.mjs` fails if anything under `app/(site)/**` references a `research_` identifier · exactly two allowlisted FKs cross into public tables, both to `categories`; `research_confirmations.created_product_id` deliberately has no FK · `research.confirm` is a human permission |
| Proof | `tests/unit/rls/research.test.ts`, both build guards with seeded counter-examples |

### T6 — Malicious upload (A2, A4, A7)

| | |
|---|---|
| Vectors | SVG carrying script; a polyglot file whose extension lies; an oversized file exhausting quota; EXIF GPS in a visitor's reference photo; a malformed GLB crashing the parser |
| Mitigations | §7 |
| Proof | `tests/unit/upload-validation.test.ts` |

### T7 — Abuse of public endpoints (A7)

| | |
|---|---|
| Vectors | Inquiry spam; suggest-endpoint scraping; vitals flooding; sign-in brute force |
| Mitigations | §8 rate limits, honeypot, 3-second floor, `Retry-After` responses rendering seeded copy |
| Proof | Six submissions in ten minutes: five persist, the sixth is 429 with a `SECURITY` log |

### T8 — Cross-site scripting and content injection (A2, A7)

| | |
|---|---|
| Vectors | CMS copy rendered as raw HTML; a Markdown document rendering embedded HTML in the docs browser; a research page title displayed unescaped in the Studio; a `cta_url` pointing at `javascript:` |
| Mitigations | React escapes by default and `dangerouslySetInnerHTML` is prohibited outside a reviewed, sanitised Markdown renderer that **disallows raw HTML** · the docs browser renders from a build-time allowlist with HTML disabled · URL fields are validated to `http`/`https`/`mailto`/relative · a nonce-based CSP with `object-src 'none'` and `base-uri 'self'` |
| Proof | `tests/e2e/security-headers.spec.ts`, `tests/unit/docs-allowlist.test.ts`, a URL-validation unit test |

### T9 — CSRF and forced actions (A2)

| | |
|---|---|
| Mitigations | Server actions carry Next.js's built-in origin check; every mutating route handler verifies `Origin`/`Sec-Fetch-Site`; session cookies are `SameSite=Lax`; `form-action 'self'`; `frame-ancestors 'none'` plus `X-Frame-Options: DENY` |
| Proof | `tests/e2e/security-headers.spec.ts`; a cross-origin POST is rejected |
| Note | The WhatsApp handoff is a link navigation, not a form submission, so `form-action 'self'` does not affect it |

### T10 — SSRF through the research subsystem (A3, A7)

| | |
|---|---|
| Vectors | A single-URL probe or a source URL pointed at `localhost`, `169.254.169.254`, a private range, or a `file://` scheme |
| Mitigations | Fetch targets are restricted to `http`/`https`; the resolved address is checked against private, loopback, link-local and metadata ranges **after** DNS resolution and again on each redirect; redirects are capped and cross-scheme redirects refused; requests carry a hard timeout and a response-size ceiling; every fetch is attributable to a source with a policy status of `APPROVED` |
| Proof | `tests/unit/scraper-fetch-guard.test.ts` covers each blocked range and the redirect-rebinding case |

### T11 — Supply chain (A2, A3)

| | |
|---|---|
| Mitigations | `npm ci` from the lockfile as the only resolution source · `npm audit --audit-level=high` in CI · Dependabot weekly · `scripts/security/check-licenses.mjs` rejects a copyleft licence entering `dependencies` · **no third-party origin is contacted by any public route**, so no CDN can inject script at runtime |
| Proof | CI jobs; `scripts/perf/check-third-party.mjs` |

### T12 — Denial of the deploy pipeline / bad release (A7)

| | |
|---|---|
| Mitigations | Builds never migrate; migration is a gated job with a snapshot; expand/contract keeps old code working; instant rollback; both drills executed and timed (`DEPLOYMENT.md` §6) |
| Proof | The recorded drill times |

### T13 — Session theft (A2)

| | |
|---|---|
| Mitigations | Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, rotated on privilege change; idle timeout 8 hours, absolute 30 days; re-authentication required for a destructive action if the session is older than 30 minutes; HSTS with `preload`; no token in `localStorage` |
| Proof | A cookie-attribute assertion in `tests/e2e/security-headers.spec.ts` |
| Open | MFA for `owner` and `admin` is **strongly recommended**, configured in the Supabase dashboard — **OWNER_VERIFICATION_REQUIRED** |

### T14 — Insider error (A1, A2, A5)

| | |
|---|---|
| Mitigations | Every privileged mutation **and every denial** is audited, append-only · destructive and bulk actions require typed confirmation, a per-item snapshot and a 24-hour undo · `media.delete` is blocked while a `media_usages` row references the asset · role-scoped, not record-scoped, permissions keep the model comprehensible |
| Proof | `tests/e2e/bulk.spec.ts`, `tests/integration/rls-policies.test.ts` |

---

## 5. Secrets: the never-expose list

These values must never reach a client bundle, a client-visible response, a log line, an error
message, a Studio screen, a screenshot, a support email or the Environment page. D8 forbids showing
even a prefix or a length.

| Variable | Class | Client bundle | Logs | Environment page shows |
|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Secret — full database bypass | Never | Never | Reachability boolean only |
| `DATABASE_URL` | Secret — contains credentials | Never | Never | Migration state only |
| `CLOUDINARY_API_SECRET` | Secret — signs uploads and deletions | Never | Never | Reachability boolean only |
| `CLOUDINARY_API_KEY` | Sensitive — paired with the secret | Never | Never | Reachability boolean only |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Secret — impersonates an identity | Never | Never | Reachability boolean only |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Sensitive — identifies private data | Never | Never | Configured / not configured |
| `REVALIDATE_SECRET` | Secret — forces invalidation and cron | Never | Never | Configured / not configured |
| `SCRAPER_USER_AGENT` | Server-only, not secret | Never | Value permitted | Value permitted |
| `NEXT_PUBLIC_*` (five names) | Public by design | Yes | Yes | Value permitted |

### 5.1 Four independent enforcement layers

| # | Layer | Mechanism | Seeded counter-example |
|---|---|---|---|
| 1 | Module boundary | Every module reading a server secret carries `import 'server-only'`; only `lib/supabase/admin.ts` may construct the admin client | Importing it from a client component fails the build |
| 2 | Build output | `scripts/security/check-secret-exposure.mjs` greps `.next/static` for each server-only name **and** for high-entropy strings matching known key shapes | `console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)` in a client component must fail the build, naming the chunk |
| 3 | Runtime redaction | `lib/logging/redact.ts` (`redact`, `redactDeep`) over every log write, environment-check result, documentation render, `audit_log` before/after blob and server-action error path | A nested payload containing each never-expose name must come back `[redacted]` |
| 4 | Repository | `gitleaks` scans history and the diff in CI, with `.gitleaks.toml` | A planted fake key must fail the scan |

**How the redactor redacts.** By **name**: every D8 server-only variable and any key matching
`/(secret|token|key|password|credential|authorization|cookie)/i`. By **shape**: JWT-like strings,
`-----BEGIN … PRIVATE KEY-----` blocks, Cloudinary URLs containing credentials, and
`postgres(ql)?://user:pass@` connection strings. It substitutes a fixed `[redacted]` — never a
prefix, never a suffix, never a length, never a hash. D8's "never a value, prefix or length" is taken
literally.

### 5.2 Never logged, by policy

Any secret value · any visitor's raw IP · any `ip_hash` in a user-facing surface · any WhatsApp
message body · any inquiry free text · any competitor page body · any upstream error message that has
not been mapped to a fixed code.

---

## 6. Authentication and authorization

### 6.1 Authentication

| Property | Decision |
|---|---|
| Provider | Supabase Auth, email + password, **staff only** |
| Public sign-up | **Disabled at the project level.** A deploy checklist item, verified by attempting a sign-up |
| Provisioning | Invitation from `/studio/system/users` using the service-role client. There is no self-registration path in the application |
| Default on provision | `role = 'viewer'`, `status = 'INVITED'`. Elevation is explicit and audited |
| Session | `HttpOnly`, `Secure`, `SameSite=Lax`; rotated on privilege change; idle 8 h, absolute 30 d |
| Sign-in rate limit | 10 per 15 minutes, keyed on email hash + `ip_hash` |
| MFA | Recommended for `owner` and `admin`, configured in the Supabase dashboard — **OWNER_VERIFICATION_REQUIRED** |
| Customer accounts | None, ever (BR-A3) |

### 6.2 Authorization — two nets, on purpose

**RLS is the coarse net.** On for every table in `public`; a table with no policy is unreachable,
which is the intended default for anything new. A leaked anon key reads published rows and nothing
else. Six named profiles cover the schema: RLS-PUBLIC, RLS-STAFF, RLS-APPEND, RLS-SERVICE,
RLS-RESEARCH, RLS-INQUIRY (`DATA_MODEL.md` §1.5).

**`requirePermission()` is the fine net.** Permission-level, in the server, per action. Names use the
dot form `<domain>.<action>`, owned by `lib/auth/permissions.ts` and generated into SQL by
`scripts/auth/gen-role-sql.ts` with a CI drift check, so the two nets cannot disagree about which
roles exist. The matrix is in `BUSINESS_RULES.md` §G.

Helper functions are `security definer`, `stable`, with `set search_path = public, pg_temp`, to avoid
recursion and search-path attacks.

`scripts/auth/check-rls.ts` fails if any table in `public` has `rowsecurity = false` or zero
policies.

---

## 7. Upload safety

Every upload path — visitor reference images and staff media alike — passes the same contract.

| Control | Rule |
|---|---|
| Signing | The browser never sees `CLOUDINARY_API_SECRET`. `/api/uploads/sign` returns a signature after session, permission, folder allowlist, MIME allowlist, byte ceiling and per-user rate limit |
| Type detection | **Magic bytes, never the extension or the declared MIME.** A JPEG renamed `.glb` is rejected |
| Allowlist | Images (JPEG, PNG, WebP, AVIF), video (MP4, WebM), models (GLB, GLTF), documents (PDF). Nothing else |
| **SVG** | **Rejected outright on every path, staff included.** A sanitiser is a permanent liability and no Rivya surface needs an uploaded SVG |
| Size ceilings | 25 MB image · 200 MB video · 50 MB model |
| Metadata | EXIF and GPS stripped on ingest — a visitor's reference photo of their home must not carry its coordinates |
| 3D models | Parsed with `@gltf-transform/core` before acceptance; rejected on parse failure |
| Visitor attachments | Stored in a **private** bucket; served only through an authenticated, short-lived signed URL, always with `Content-Disposition: attachment`; orphans purged at 30 days |
| Storage of record | `media_assets` rows carry `alt_text`, `is_ai_generated`, `is_concept`; a visitor upload is `source = 'USER_UPLOAD'`, `status = 'DRAFT'`, never returned by a public read path |

Proof: `tests/unit/upload-validation.test.ts` — extension-lie rejection, SVG rejection, size
rejection, EXIF stripping, GLB parse failure.

---

## 8. Rate limiting

Fixed-window counters in PostgreSQL (`rate_limit_buckets`). No Redis exists in the stack (D1), and
adding one would be an amendment.

| Surface | Limit | Key |
|---|---|---|
| `POST /api/inquiries` (and `submitInquiry`) | 5 per 10 min | `ip_hash` + form fingerprint |
| Inquiry file upload | 10 per hour | `ip_hash` |
| `POST /api/uploads/sign` (Studio) | 20 per hour | staff `user_id` |
| `GET /api/search/suggest` | 60 per min | `ip_hash` |
| `POST /api/vitals` | 60 per min | `ip_hash` |
| `POST /api/revalidate` | 30 per min | secret |
| Studio sign-in | 10 per 15 min | email hash + `ip_hash` |
| Research fetches | Per-source rate limit, delay and concurrency | source |

`ip_hash` is `hmac(ip, server_salt)`; the raw address is never stored. A limited request returns
**429 with `Retry-After`**, renders the seeded form-error copy (SEED §49), and writes a `SECURITY`
system log — never an `audit_log` row, because it has no actor.

**Known limitation, accepted and documented:** a fixed window permits a 2× burst at a window
boundary. The threat here is abuse volume, not precision; a sliding window would require Redis.

---

## 9. Response headers

Set in `middleware.ts` for every response and asserted by e2e.

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<per-request>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; media-src 'self' blob: https://res.cloudinary.com; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (belt and braces with `frame-ancestors`) |
| `X-Robots-Tag` | `noindex, nofollow` on every non-production deployment and on `/studio/**` |
| `Cache-Control` | `private, no-store` on `/studio/**` and every `app/api/**` response |

**Two documented exceptions, with reasons.** `style-src 'unsafe-inline'` is required by Next.js's
inline style injection and Tailwind's runtime style element. `worker-src blob:` is required by the
Draco and meshopt decoders the 3D viewer loads. `payment=()` is deliberate and permanent — there is
no payment surface (D1). Fonts are self-hosted through `next/font`, so `font-src 'self'` needs no
external origin.

**Rollout:** CSP ships `Report-Only` for one week against a preview deployment, with reports
collected into `system_logs`, then enforced.

---

## 10. Logging, audit and observability

Three logs, three jobs. They are never merged.

| Log | Table | Written by | Read by | Answers |
|---|---|---|---|---|
| Audit | `audit_log` | Every privileged mutation **and every denial** | `owner`, `admin` | Who was allowed or refused to do what |
| Activity | `activity_events` | Human Studio actions worth a feed | Any staff member | What has been happening in the Studio |
| System | `system_logs` | Background jobs, integrations, cron, workflow runs | `owner`, `admin` | What the machine did and where it failed |

`audit_log` is append-only (`revoke update, delete`), carries an `actor_role` snapshot so a later
role change cannot rewrite history, and stores `before`/`after` blobs **after** `redactDeep`.
`system_logs` separates `level` (`INFO · WARNING · ERROR · SECURITY`) from `channel`
(`WORKFLOW · SCRAPER · MEDIA · CONTENT · AUTH · SHEETS · ANALYTICS · SYSTEM`), so "SECURITY events in
the last hour" is one query.

**Correlation.** `middleware.ts` assigns a `request_id` threaded into `audit_log`, `system_logs` and
every server-action error, so one incident is one query.

**Volume control.** Every log call carries a `dedupe_key`; identical events within five minutes
increment `occurrence_count`. Retention: `INFO`/`WARNING` 90 days, `ERROR`/`SECURITY` 400 days.

**Security events that must always be logged:** permission denial · rate-limit trip · upload
rejection with its reason class · sign-in failure · role change · destructive action and its undo ·
CSP violation report · research fetch refused by policy or by the SSRF guard.

---

## 11. Incident response

No on-call rotation exists (`DEPLOYMENT.md` §10). This is the procedure for whoever is present.

| Step | Action |
|---|---|
| 1. Contain | If a secret may be exposed: rotate it **first** (`DEPLOYMENT.md` §9). If Studio access may be compromised: suspend the affected `staff_profiles` rows. If a public surface is affected: roll back the deployment |
| 2. Preserve | Do not delete logs. `audit_log` and `system_logs` are append-only by design; capture the `request_id` range and the time window before anything is purged by retention |
| 3. Assess | Which asset in §1? Which threat in §4? Was A1 (personal data) reachable? Search `audit_log` by actor and by `result = 'DENIED'`; search `system_logs` by `level = 'SECURITY'` |
| 4. Eradicate | Fix forward. Never a `down` migration. If data was corrupted, use point-in-time restore to a chosen timestamp |
| 5. Verify | Re-run `scripts/security/check-secret-exposure.mjs`, `gitleaks`, the RLS suite and `studio-authz.spec.ts`. Confirm `/studio/system/environment` is healthy |
| 6. Record | Write the timeline into `CHANGELOG.md` and, if a rule or guard was missing, add it here **and** add the test that would have caught it |
| 7. Notify | Whether and whom to notify after a personal-data incident depends on the legal entity and jurisdiction — **OWNER_VERIFICATION_REQUIRED**. The technical facts are prepared by steps 3 and 6; the decision is the owner's |

---

## 12. Research-subsystem specifics

The scraper is the only part of this system that deliberately consumes hostile input at scale.
`SCRAPER.md` owns the mechanics; these are the security-relevant rules.

| Concern | Rule |
|---|---|
| Identification | Every fetch sends `SCRAPER_USER_AGENT`, which names Rivya and provides a contact route. Without it, no run can start |
| Robots and policy | `research_fetches.robots_decision` (`ALLOWED · DISALLOWED · NO_ROBOTS · ERROR`) is recorded per fetch. A source whose `research_policy_status` is not `APPROVED` cannot run |
| Rate and concurrency | Per-source rate limit, request delay and concurrency cap. A circuit breaker opens after five consecutive failures |
| Parsing | B6 is the most hostile boundary in the system. Third-party HTML is parsed into a Zod-validated `RawProductDraft`; a failure marks the work item `FAILED` and the run continues. An adapter never evaluates remote code, never builds a selector from remote input, and never follows a link outside its source's URL patterns |
| SSRF | §4 T10 — scheme restriction, post-resolution private-range checks, redirect caps, timeouts, response-size ceiling |
| Images | **URLs only, never downloaded.** No `research_product_images` table exists; `research_image_extraction_mode` has no value that fetches bytes |
| Snapshots | Evidence, not media: a **private** Supabase Storage bucket outside the `MediaProvider` seam, never publicly deliverable, retained 180 days |
| Isolation | No `anon` policy, ever; no FK to `products`; no public search document; two build guards |
| Blast radius of an adapter bug | One source. Adapters are isolated so a broken one cannot fail its siblings |
| Legal posture | Data is used for internal comparison and direction only. Nothing scraped is republished, re-hosted or presented as Rivya content (BR-F1, BR-F4). Whether a specific source's terms permit collection is recorded per source as a policy review — a human decision, not an inference |

---

## 13. Out of scope

A penetration test or formal audit (an engagement the owner commissions; this posture is what they
would review) · any compliance certification claim · WAF, bot management and DDoS tuning beyond the
platform default · a cookie consent banner — no third-party script, analytics cookie or advertising
identifier exists, so the site sets only a session cookie and a dismissal preference; whether a
banner is nonetheless legally required is **OWNER_VERIFICATION_REQUIRED** · encryption at rest beyond
what Supabase and Cloudinary provide · third-party observability or alerting.

---

## 14. Verification checklist

Run before any release that touches auth, RLS, uploads, headers or the research subsystem.

- [ ] `npm run build && node scripts/security/check-secret-exposure.mjs` exits 0; the seeded counter-example still fails it.
- [ ] `npm run test:unit -- redact rate-limit-window upload-validation pii-scope` green.
- [ ] `curl -sI <origin>/` shows every §9 header; `/studio` additionally `private, no-store` and `X-Robots-Tag: noindex, nofollow`.
- [ ] `tests/e2e/security-headers.spec.ts` — the CSP nonce differs per request; the 3D viewer produces zero violations.
- [ ] `tests/e2e/studio-authz.spec.ts` — every forbidden action returns 403 and writes a `DENIED` audit row.
- [ ] Six inquiry submissions in ten minutes: five persist, the sixth is 429 with `Retry-After`.
- [ ] SVG rejected; oversize rejected; extension-lie rejected.
- [ ] `node scripts/auth/check-rls.ts` — no table in `public` without RLS and at least one policy.
- [ ] `check-research-isolation.mjs` and `check-data-layer.mjs` green, each with its counter-example.
- [ ] `gitleaks detect --redact` and `npm audit --audit-level=high` clean.
- [ ] `/studio/system/environment` shows no value, prefix or length — asserted by `deploy-smoke.spec.ts`.

---

## 15. Owner decisions still outstanding

| # | Decision | Consequence while unresolved |
|---|---|---|
| 1 | MFA for `owner` and `admin` | T13 mitigation is password-only |
| 2 | Supabase plan and PITR window | The restore lever in `DEPLOYMENT.md` §6 has no stated RPO |
| 3 | Cloudinary backup enablement and retention | An accidental asset deletion may be unrecoverable |
| 4 | Legal entity, jurisdiction, controller and statutory basis | `/privacy` and `/terms` stay `DRAFT`; incident notification duties are undefined |
| 5 | Whether a cookie banner is required | None is implemented; none is technically necessary |
| 6 | Whether to commission a penetration test | The posture is untested by an adversary |
| 7 | Who holds each platform account and who may rotate each secret | Rotation ownership in `ENVIRONMENT.md` §5 is nominal |

---

## 16. Open questions for the canonical decisions

1. **Retention for `audit_log`, `activity_events` and `content_revisions` is unspecified.**
   `system_logs`, vitals, search queries, rate-limit buckets and research snapshots all have stated
   retention; these three do not. Suggested amendment: a retention table in D5.
2. **No cron secret in D8** — the cron routes reuse `REVALIDATE_SECRET`, so one secret guards both
   cache invalidation and every scheduled job. Suggested amendment: add `CRON_SECRET`.
3. **`GOOGLE_SHEETS_SPREADSHEET_ID` is classed as sensitive rather than secret** by this document and
   `ENVIRONMENT.md`, while D8 has one undifferentiated server-only list. Suggested amendment: record
   the Secret / Sensitive / Server tiers in D8.
4. **Where research snapshots live.** D1 fixes Cloudinary behind `MediaProvider` and D6 governs media;
   snapshots are evidence and are placed in a private Supabase Storage bucket outside that seam.
   Suggested amendment: record the snapshot store in D6 so a later phase does not route it through
   Cloudinary. (Also `ARCHITECTURE.md` open question 5.)
