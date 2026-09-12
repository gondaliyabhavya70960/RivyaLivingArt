---
doc: SECURITY
status: CURRENT
owning_phase: 41
last_reviewed: 2026-09-12
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

**Implementation status.** §6 (authentication and authorisation) is **IMPLEMENTED** as of Phase 04
and verified against a real PostgreSQL cluster — see §6.5 for what was proved and how. Everything
else in this document remains the posture Phases 38 and 41 implement against, and the evidence a
reviewer or a commissioned auditor would examine.

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

Six runtimes (`ARCHITECTURE.md` §2) and nine Zod boundaries (B1–B9). Every externally reachable entry
point, with its guard chain and the §4 threats it carries. The route names are `ARCHITECTURE.md` §3's,
verbatim; a path that appears here and in no route map is a defect in this document, not a route.

| Entry point | Auth | Guard chain | Threats |
|---|---|---|---|
| `GET app/(site)/**` | None | RLS (`status = 'PUBLISHED'`) → cached render → headers | T4, T7, T8 |
| `submitInquiry` — `app/(site)/_actions/submit-inquiry.ts` (server action) | None | Origin check → rate limit → Zod (B1) → honeypot → 3 s floor → one transaction → typed result. **There is no `/api/inquiries` route handler and one must never be added** — the limiter runs inside the action because `proxy.ts` has no path to match | T1, T7, T9 |
| `POST app/api/inquiries/upload-sign` | **None — the most hostile authenticated-adjacent surface in the product** | Origin check → Zod (B3) → per-`ip_hash` rate limit (10/hour, 3/min) → MIME narrowing (`image/jpeg · image/png · image/webp · image/heic · application/pdf`) → 10 MB and 5-file ceiling → **server-issued** folder `rivya/inquiries/incoming/<uuid v4>`, never client-chosen → short-TTL signature. The response carries no credential; magic-byte sniffing and EXIF stripping happen on ingest (§7) | T1, T6, T7 |
| `POST app/api/studio/models/inspect` (Phase 21) | Session, `media.write` | Session → permission → multipart `file` → size cap (30 MB, twice the model ceiling) → format from MIME and name → `inspectModel()`: the JSON chunk first, a decoder only for a file the JSON does not condemn. **Parses and reports; writes nothing, uploads nothing, fetches nothing** — a `.gltf` naming an external buffer or image is refused, never fetched | T6, T7 |
| `saveModelAction` and the four model Server Actions — `app/(studio)/studio/(shell)/media/models/actions.ts` | Session, `media.write` (+ `content.verify` to mark a label VERIFIED, + `catalog.write` to attach to a product) | Permission → Zod → the bytes are read back **from the delivery origin only** (`res.cloudinary.com`, the model's own public id) → inspected with the same decoders the viewer serves → a refused file is destroyed at the provider and gets no row → metadata written from the parse, never from the request. Association is one `SECURITY INVOKER` transaction under the caller's row policies | T4, T6, T14 |
| `GET app/api/search/suggest` | None | Zod (2–64 chars, ≤ 8 results) → rate limit → **public index only**, never `research_search_documents` → `s-maxage=60` | T5, T7 |
| `POST app/api/vitals` | None | Zod, rejecting any extra key → rate limit → service-role insert of route **pattern** only | T1, T7 |
| `POST app/api/revalidate` | `REVALIDATE_SECRET` | Secret → Zod → tag/path invalidation only. The **only** cache-invalidation entry point | T3, T7 |
| `GET app/api/preview` | Signed token | Token verify → `draftMode().enable()` → redirect to a real public path. Draft mode bypasses every cache layer, so an unsigned or expired token must not reach the redirect; the target is validated as a D3 path, never an open redirect | T4, T8 |
| `app/api/cron/research` | Platform cron header **only** | `x-vercel-cron` present, else **404** (not 401 — a prober cannot confirm the route exists). Deliberately does **not** reuse `REVALIDATE_SECRET`: this is the one route that contacts third-party hosts, and widening that secret across two unrelated systems was rejected (`SCRAPER.md` §7) | T10, T11 |
| `app/api/cron/**` (the other six) | `REVALIDATE_SECRET` | Secret → bounded, resumable, idempotent-per-period work. §16 item 2 proposes normalising all seven onto a `CRON_SECRET` | T3, T7 |
| `GET /studio/**` | Session | `proxy.ts` redirect → session resolve → `requirePermission()` **per page** → RLS | T2, T13 |
| Studio server actions | Session | Origin → Zod (B2) → session → permission → work → audit (success **and** denial) | T2, T9, T14 |
| `app/api/studio/**` — `search`, `inquiries/export`, `models/inspect` | Session | Session → `requirePermission()` (`research.read`/`catalog.read`, `inquiries.export`, `media.write` respectively) → Zod → work → `private, no-store`; the export is audited and carries no raw IP; `models/inspect` parses the GLB server-side (§7). **No media or competitor-image proxy exists here or anywhere under `app/api/**`** | T1, T2, T5, T6 |
| `POST app/api/media/sign` | Session | Session → `media.write` → folder allowlist (`lib/media/folders.ts`) → MIME allowlist per kind → byte ceiling per kind → per-user rate limit (20/hour) → signature | T4, T6 |
| `POST app/api/auth/sign-out` | Session | POST only → clear → audit | T9, T13 |

**Two unauthenticated signers, not one.** `app/api/media/sign` requires a session and `media.write`;
`app/api/inquiries/upload-sign` requires neither, because a visitor attaching a reference photo has no
account and never will (BR-A3). They are separate routes with separate ceilings and separate rate-limit
keys precisely so the visitor path can be narrowed without narrowing the staff path — see §7.

**`proxy.ts` redirects; it never authorises.** A page that relies on navigation not showing a link is
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
| Proof | `tests/e2e/studio-authz.spec.ts` (as `viewer`, direct POSTs to publish, bulk-apply, media-delete and role-change all return 403 **and** each writes an `audit_logs` row with `result = 'DENIED'`), `scripts/security/check-action-guards.mjs` |

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
| Mitigations | RLS-RESEARCH has no `anon` policy, ever · `check-research-isolation.mjs` fails the build if one is added · `check-data-layer.mjs` fails if anything under `app/(site)/**` references a `research_` identifier · **every** research→public foreign key is allowlisted by constraint name in that guard, and the guard asserts *equality* with the allowlist, so a missing entry fails as loudly as an extra one — today the allowlist holds **two** constraints, both to `categories` (`research_source_category_map.category_id`, Phase 26; `research_products.matched_category_id`, Phase 28), and `research_confirmations.created_product_id` deliberately has no FK at all · `research.confirm` is a human permission |
| Proof | `tests/unit/rls/phase25.test.ts`, `tests/unit/research-isolation.test.ts`, and `scripts/research/check-research-isolation.mjs` with seeded counter-examples |
| As built (Phase 25) | The allowlist is **empty**, not two: neither of the two allowlisted constraints exists yet — `research_source_category_map` arrives in Phase 26 and `research_products.matched_category_id` in Phase 28 — and the guard asserts the live schema rather than the plan. `tests/unit/research-isolation.test.ts` asserts the allowlist is empty at this phase, so an early or a third entry fails the build. The nine tables shipped here carry **no** foreign key across the boundary at all. Each of the four invariants was proved to fail on a real violation — a planted foreign key, a planted `anon` policy, a planted identifier under `lib/catalog`, a planted `puppeteer` import, a planted cross-import — and to pass once restored. |
| Also enforced here | The politeness posture, because a subsystem that reads other people's servers is a conduct risk as much as a disclosure one: `SCRAPER_USER_AGENT` has no fallback and a missing one throws rather than crawling anonymously; robots.txt is honoured with a refusal recorded and **no request made**, and `research_fetches_disallowed_has_no_response` makes a row claiming otherwise unstorable; `Crawl-delay` is a floor and never a ceiling; and the guard fails the build on an import of any browser-automation, proxy-rotation or CAPTCHA-solving package anywhere under `lib/scraper/**`. `docs/architecture/SCRAPER.md` states the whole posture and its permanent prohibitions. |
| Divergence | `DATA_MODEL.md` §1.1 rule 7 and §11 state *three*, naming `research_direction_briefs.target_category_id` as the third. `PHASE-31-38.md`, which owns Phase 34 and its migrations, specifies that column as `target_category_slug text` with a check constraint and **no** foreign key, and verifies that converting it to a real reference makes the guard fail. This document, `BUSINESS_RULES.md` BR-F2 and the guard's allowlist therefore hold at two and move together. `BUSINESS_RULES.md` §M open question 7 states the two ways to close it; changing the number here without changing them all is a BR-K4 violation |

### T6 — Malicious upload (A2, A4, A7)

| | |
|---|---|
| Vectors | SVG carrying script; a polyglot file whose extension or declared MIME lies; an oversized file exhausting quota; EXIF GPS in a visitor's reference photo; a malformed GLB crashing the parser; a client-chosen upload folder escaping its prefix |
| Mitigations | §7. Both signing routes are in scope, and the unauthenticated one (`app/api/inquiries/upload-sign`) carries the narrower allowlist and the smaller ceiling because it has no session to attribute abuse to |
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
| Proof | `tests/unit/rls/phase24.test.ts`, `tests/unit/bulk-undo.test.ts`, `tests/e2e/bulk-destructive-confirm.spec.ts`, `tests/e2e/bulk-undo.spec.ts` |

**As implemented in Phase 24.** Bulk is one engine (`lib/bulk/run.ts`) and there is no second
loop: an operation without a `bulk_operations` row has no preview, no confirmation token, no
per-item snapshot and no undo, and `scripts/bulk/check-bulk-registry.mjs` fails the build on a
mutation inside a `preview` body. Four properties are load-bearing here.

- **Apply cannot widen what was previewed.** The exact id list is a column on the row, and Apply
  re-reads it rather than trusting the request. A stale tab holds a token for a preview built from
  a different filter and is refused; a changed filter produces a new preview and a new token. The
  token is cleared when it is spent, so a double-submitted form cannot run the same operation
  twice.
- **The typed confirmation is enforced at the server, not at the dialog.** A Server Action is an
  HTTP endpoint. `run.ts` re-checks `roleHasPermission` for `bulk.execute` and, for a destructive
  operation, `destructive.execute`, and compares the typed count against one it computes itself
  from the stored selection. The disabled button is what makes an operator stop and read the
  number; it is not what stops the request.
- **No session may write the record of what was done.** All four bulk tables are shape C with a
  read policy and no write policy for any session role: the engine writes through the service role
  after `requirePermission`. Without that, a signed-in merchandiser could hand-write a preview
  carrying a selection nobody previewed, or edit the `before` snapshot undo re-applies — writing
  anything they liked into a live row while the audit log recorded a restoration. Delete on the two
  record tables is absent from RLS *and* revoked at the grant.
- **Undo cannot overwrite somebody else's later edit.** Each item stores the `updated_at` the
  operation left the row at; undo re-applies `before` only where that still matches and reports the
  rest by id. Undoing a destructive operation needs `destructive.execute` too — an un-archive is a
  bulk write over live content that nobody previewed.

Two things bulk can never do, by construction rather than by rule: hard-delete anything (no
operation kind removes a row, and permanent deletion stays a single-row action on its own surface),
and publish through an import (`status` is absent from `bulk-import`'s writable column allowlist,
so an imported row takes the column's `DRAFT` default and an update leaves the row's own status
alone).

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
| `CRON_SECRET` | Secret — authorises every scheduled job | Never | Never | Configured / not configured |
| `IP_HASH_SALT` | Secret — knowing it makes every stored `ip_hash` reversible by guessing addresses | Never | Never | Configured / not configured |
| `RATE_LIMIT_SALT` | Secret — knowing it makes a bucket key predictable, and a predictable key can be exhausted on somebody else's behalf | Never | Never | Configured / not configured |
| `SCRAPER_USER_AGENT` | Server-only, not secret | Never | Value permitted | Value permitted |
| `NEXT_PUBLIC_*` (five names) | Public by design | Yes | Yes | Value permitted |

### 5.1 Four independent enforcement layers

| # | Layer | Mechanism | Seeded counter-example |
|---|---|---|---|
| 1 | Module boundary | Every module reading a server secret carries `import 'server-only'`; only `lib/supabase/admin.ts` may construct the admin client | Importing it from a client component fails the build |
| 2 | Build output | `scripts/security/check-secret-exposure.mjs` greps `.next/static` for each server-only name **and** for high-entropy strings matching known key shapes | `console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)` in a client component must fail the build, naming the chunk |
| 3 | Runtime redaction | `lib/logging/redact.ts` (`redact`, `redactDeep`) over every log write, environment-check result, documentation render, `audit_logs` before/after blob and server-action error path | A nested payload containing each never-expose name must come back `[redacted]` |
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
| Provisioning | Invitation from `/studio/system/users` using the service-role client. There is no self-registration path in the application. The FIRST owner, which that surface cannot create, comes from `npm run auth:create-user` or, from an environment, `npm run auth:bootstrap` (amendment A43) |
| Default on provision | `role = 'viewer'`, `status = 'INVITED'`. Elevation is explicit and audited |
| Session | `HttpOnly`, `Secure`, `SameSite=Lax`; rotated on privilege change; idle 8 h, absolute 30 d |
| Sign-in rate limit | 10 per 15 minutes, keyed on email hash + `ip_hash` |
| Password reset | **Self-service since amendment A43**: `/studio/forgot-password` → an emailed link → `/api/auth/confirm` → `/studio/reset-password`. The request page answers identically for an address with an account and one without — an enumeration oracle is the cost of being helpful here. Setting the password ends **every** session globally |
| Password reset rate limit | 5 per hour, keyed on email hash + `ip_hash`; 20 per hour on the confirm route, keyed on `ip_hash` alone — never on the token, which would give each guess a fresh allowance |
| Forgotten sign-in ID | **No self-service path, by design.** The ID is the email address, so any such form would answer an identifier with an address. Behind a credential only: `/studio/system/users`, or `npm run auth:list-users` |
| Recovery session | Authenticates an auth account and grants no Studio access: every page resolves `getStaffSession()` separately and admits only an `ACTIVE` profile |
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

### 6.5 As implemented in Phase 04 — and how it was proved

Two enforcement layers, and the reason for each is that neither can do the other's job.

| | RLS — the coarse net | `requirePermission()` — the fine net |
|---|---|---|
| Where | In PostgreSQL, per table, always on | In the server, per action |
| Answers | *may this role see this table at all* | *may this role take this action, now* |
| Survives | a forgotten permission check, an unexpected query path, a leaked anon key | nothing below it — it is application code |
| Cannot express | "may publish, as opposed to edit" | anything, once a query reaches the database another way |

**The rule that keeps them in step.** A table's staff-select role list must equal the set of roles
holding that table's `*.read` permission. It is declared once in `lib/auth/table-permissions.ts`;
`scripts/auth/gen-role-sql.ts` generates migration `0011` from it, and `scripts/auth/check-rls.ts`
reads `pg_policies` back out of the migrated database and fails on any difference.

Without that rule the pattern is not merely loose, it is dangerous. `using (is_staff())` copied onto
`inquiries` in Phase 20 would let a **researcher** — who does not hold `inquiries.read` — read every
customer name, phone number and email address straight through PostgREST with their own session,
never touching `requirePermission()`. The same copy onto `audit_logs` hands every role the security
log. Neither is caught by review; both are caught by the gate.

**Three policy shapes**, and every table matches one or carries a declared deviation with a stated
reason:

| Shape | Tables | Anon leg |
|---|---|---|
| A — content | `categories` `collections` `materials` `products` `media_assets` | `status = 'PUBLISHED'` |
| B — join | `product_collections` `product_materials` `product_media` `product_relations` | derived from the parent rows (amendment A5·a: **every** named parent must be published, except `product_media`, whose asset is filtered by its own Shape-A policy) |
| C — staff-only | `staff_profiles` `audit_logs` `content_seed_runs` | none, ever |

**What was proved, against a real database rather than a mock**

- The full six-role read and write matrix, on every table. 62 tests, with the expectations
  **derived** from `lib/auth/permissions.ts` rather than restated — a test that restates the matrix
  only proves two hand-written copies agree.
- An anonymous visitor sees published rows and nothing else; cannot insert; and cannot update or
  delete anything.
- A **SUSPENDED** admin sees exactly what an anonymous visitor sees. Suspension is enforced by the
  database — `current_staff_role()` filters on `status = 'ACTIVE'` — not by hiding a button.
- A non-manager cannot promote themselves. If this failed, every other policy would be advisory.
- `audit_logs` cannot be inserted through any session, nor updated or deleted by anyone: `update`
  and `delete` are revoked at the privilege level, which must be granted back visibly rather than
  merely re-policied.
- The last active `owner` cannot be demoted, suspended or deleted — enforced by a deferred
  constraint trigger, so an atomic hand-over in one statement still works while leaving the project
  ownerless does not.
- `check-rls` was shown to fail on five separate failure modes: RLS switched off, a drifted role
  list, the `is_staff()` shorthand on a table not read by all six roles, an unregistered table, and
  a policy gating on `auth.role()`.

**Three ways an RLS test lies, and what stops each here.** Recorded because each produces a green
suite that proves nothing, and two of the three were reproduced on the cluster before the harness
was written:

1. **Missing grants.** On Supabase, `anon` holds full DML on every table in `public` — GRANT is not
   the security boundary there, RLS is the whole of it. A local harness that creates the roles but
   omits the grants turns every deny assertion vacuous: the refusal comes from a missing GRANT that
   *does not exist in production*, and a table shipped without `enable row level security` looks
   safe. `assertHarnessIsHonest()` runs before the suite and fails if a table with RLS disabled is
   not visible to anon.
2. **Forgetting to switch role.** `DATABASE_URL` connects as `postgres`, which is superuser and
   table owner — both bypass RLS. Every block asserts `current_user` is the role it asked for.
3. **Confusing "no error" with "allowed".** An `UPDATE` whose `USING` clause matches nothing affects
   zero rows and *succeeds*. A test watching only for exceptions reports every role as able to
   update everything. The suite asks how many rows were affected.

**Still unproved, and honestly so.** The local cluster has no PostgREST, so nothing here tests that
a visitor cannot forge a `role: service_role` claim — that guarantee lives in PostgREST's JWT
verification, which is why policies gate on the `TO` grantee list and never on `auth.role()`
(amendment A5·c). Nor is the HTTP status mapping tested: PostgREST turns a `USING` miss into 204/404
and a `WITH CHECK` violation into 403, and only an end-to-end test against a hosted project covers
that seam.

### 6.6 The two standing advisor findings on the hosted project, and why they stay

Supabase's database linter reports two things against `ccvarsmzickdkryoakdg`. Both are deliberate.
They are written down here because an unexplained WARN gets "fixed" by the next reader, and one of
these two fixes takes the whole Studio down.

**`authenticated` can execute `current_staff_role()`, `is_staff()` and `has_role()` (WARN, ×3).**
The linter's point is that all three are `security definer` and therefore reachable as PostgREST
RPC at `/rest/v1/rpc/<name>`. The grant is not removable: a policy expression is evaluated with the
*caller's* privileges, so every policy that calls `has_role()` needs `authenticated` to hold
EXECUTE on it. That is not a deduction from the manual — it was run:

```
begin;
revoke execute on function public.has_role(variadic user_role[]) from authenticated;
set local role authenticated;
select count(*) from media_usages;   -- ERROR: permission denied for function has_role
rollback;
```

Note the failure mode. It is not a quiet denial that returns zero rows; it is a hard error, so
revoking the grant does not tighten the Studio, it breaks every read in it.

What is left, then, is whether the RPC exposure leaks anything — and it does not, for a reason
visible in the signatures: **none of the three takes a user identifier.** All three resolve the
subject from `auth.uid()` alone (0010). So the most a caller can learn by invoking them is their
own role, their own staff status, and whether their own role is in a list they supplied — three
facts they necessarily already hold. There is no argument that would let them ask about somebody
else. Moving the functions out of the exposed schema would close the RPC route, but the policies in
0011, 0021 and 0031 reference them as `public.has_role(...)`, and those files have shipped.

**`public.schema_migrations` has RLS enabled and no policy (INFO).** Correct as it stands: that is
the migration ledger `db:migrate` maintains, it exists only on hosted projects, and RLS on with no
policy is precisely the state that makes it invisible to `anon` and `authenticated` while
`service_role` keeps working. Adding a policy — the linter's suggested remediation — would publish
the project's migration history. The finding is INFO rather than WARN because the linter cannot
tell a deliberately unreachable table from a forgotten one.

## 7. Upload safety

Two signing routes, one contract. Both apply the same controls; they differ only in who may call them
and how far the allowlist and the ceiling are narrowed.

| Control | Rule |
|---|---|
| Signing | The browser never sees `CLOUDINARY_API_SECRET`. `app/api/media/sign` returns a signature after session, `media.write`, folder allowlist, MIME allowlist, byte ceiling and per-user rate limit. `app/api/inquiries/upload-sign` returns one after origin check, Zod, per-`ip_hash` rate limit and the narrowed visitor allowlist below — **no session**, because a visitor has no account (BR-A3). Signature TTL 10 minutes; `overwrite: false` on every upload |
| Type detection | **Magic bytes, never the extension or the declared MIME.** A JPEG renamed `.glb` is rejected, and so is a JPEG whose declared MIME says `application/pdf` |
| Folder | Server-chosen on both paths. The visitor route forces `rivya/inquiries/incoming/<uuid v4 issued by the server>`; the staff route accepts only a key from `lib/media/folders.ts` |
| Metadata | **Not yet stripped from the stored original — see §7.5.** Every PUBLIC delivery is a transformed derivative and Cloudinary drops EXIF, IPTC and XMP from derivatives by default, so nothing a visitor's browser receives carries coordinates. The ORIGINAL keeps them, and a visitor's reference photo is served to staff as its original through a signed URL. Phase 41 corrected this row rather than leaving a control documented as built when it is not |
| 3D models | Parsed with `@gltf-transform/core` before acceptance; rejected on parse failure. The same parser backs `app/api/studio/models/inspect` |
| Visitor attachments | Stored in a **private** bucket; served only through an authenticated, short-lived signed URL, always with `Content-Disposition: attachment`; orphans purged at 30 days |
| Storage of record | `media_assets` rows carry `alt_text`, `is_ai_generated`, `is_concept`; a visitor upload is `source = 'USER_UPLOAD'`, `status = 'DRAFT'`, `is_ai_generated = false`, `is_concept = false`, never returned by a public read path |
| Duplicate guard (Phase 33) | Before a `media_assets` row is written for an image or video, the save action fetches the original back, hashes it in memory, and refuses a byte-identical file already in the Rivya library or the research hash table, or an image within six pHash bits of one — destroying the Cloudinary object and writing a DENIED audit row that names the match. The reads run under the service role so an editor's session cannot bypass the research comparison. `lib/media/hashes.ts` is the only module that may decode image bytes (`media:check-decoder`) |

### 7.1 Allowlist and ceiling, per path and per kind

These values are `CLOUDINARY.md` §4's, not a second opinion, with **one deliberate exception**: the
`BRAND` row, which §7.2 explains and `PHASE-39-46.md` fixes. `CLOUDINARY.md` owns the media seam, so on
every other row a difference means this table is the one to correct.

| Path | Kind | MIME allowlist | Ceiling | Count |
|---|---|---|---|---|
| `app/api/media/sign` (staff) | `IMAGE` | `image/jpeg`, `image/png`, `image/webp`, `image/avif` | 25 MB | — |
| `app/api/media/sign` (staff) | `VIDEO` | `video/mp4` **only** — H.264. WebM is not accepted; delivery re-encoding is Cloudinary's job, not the uploader's | 200 MB | — |
| `app/api/media/sign` (staff) | `MODEL_3D` | `model/gltf-binary`, `model/gltf+json` | 50 MB at the signature; **the Phase 21 inspector then refuses above 15 MB**, requires Draco or meshopt compression above 5 MB, refuses > 250,000 triangles, any texture over 2048 px, and any `.gltf` that references a buffer or image outside itself — and a refused upload is destroyed, not recorded | — |
| `app/api/media/sign` (staff) | `DOCUMENT` | `application/pdf` | 25 MB | — |
| `app/api/media/sign` (staff) | `BRAND` | `image/png`, `image/jpeg`, `image/vnd.microsoft.icon` — see §7.2 | 5 MB | — |
| `app/api/inquiries/upload-sign` (visitor) | reference attachment | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf` | **10 MB per file** | 5 files per submission |

The visitor ceiling is a quarter of the staff image ceiling and is not an oversight: an unauthenticated
signer is rate-limited by `ip_hash` alone, so the product of ceiling × rate limit is the whole quota
exposure, and 10 MB × 10/hour is the number this document accepts.

### 7.2 SVG, and the brand marks that would otherwise have no format

**SVG is rejected outright on every path, staff and owner included.** An SVG is XML the browser
executes in the same origin; a sanitiser must be right forever, and no Rivya surface needs an uploaded
one. The ban is unconditional and is not a validator option.

That ban would otherwise block the one case where a designer normally hands over SVG — the brand
marks Phase 43 asks the owner for at `/studio/media/brand` — so the accepted formats are fixed here,
and `/studio/media/brand` states them **before** the owner chooses a file rather than after the
validator rejects one:

| Brand asset | Accepted upload | Minimum |
|---|---|---|
| Logo | PNG with alpha | ≥ 2× the largest rendered size, ≥ 1024 px long edge |
| Wordmark | PNG with alpha | ≥ 2× the largest rendered size, ≥ 1024 px long edge |
| Favicon | ICO **or** PNG | ICO containing 16/32/48 px, or a 512 × 512 PNG from which the ICO is derived |
| Default OG asset | PNG or JPEG | 1200 × 630 exactly — the Phase 06 `og` preset's output size |

A raster mark at 2× is indistinguishable at every D6 ratio the site uses, and it costs one upload
validator instead of a sanitiser. If the owner holds only an SVG, the answer is a PNG export at 2×
made by whoever supplies the mark — never a sanitiser, and never an exception in
`lib/media/validate-upload.ts`.

**Pending correction in two companion documents.** `CLOUDINARY.md` §4 and `MEDIA_GUIDE.md` §3 both
still list `image/svg+xml` for the `BRAND` kind. `PHASE-39-46.md` (Phase 43) owns correcting those two
rows to the table above; until it does, this section and `PHASE-39-46.md` are the pair that state what
`lib/media/validate-upload.ts` will actually accept, and an engineer implementing the validator from
`CLOUDINARY.md` alone would ship the one file type §4 T6 exists to keep out.

Proof: `tests/unit/upload-validation.test.ts` — extension-lie rejection, declared-MIME-lie rejection,
SVG rejection on **both** signing routes, per-path size rejection, visitor file-count rejection and
GLB parse failure. **That suite is written in Phase 42** with the rest of the deferred test work; the
validator itself shipped in Phase 41 and is exercised by the save path described next.

### 7.3 Where the byte check actually runs, and why it is not at the signature (Phase 41)

`lib/media/validate-upload.ts` is a pure function over a buffer, and the awkward fact about this
product is that **the server never holds the buffer**. Uploads go from the browser straight to
Cloudinary against a signature — that is what keeps `CLOUDINARY_API_SECRET` out of the client and what
lets a 200 MB video avoid a round trip through a serverless function with a 4.5 MB body limit. By the
time any code of ours could read a byte, Cloudinary already has the file.

So the check runs where the consequence is, in `saveUploadedAssetAction`:

1. The action fetches the stored original back with a `Range: bytes=0-4095` request.
2. `validateUpload` runs on that prefix, with the length the delivery origin reported passed in
   separately — every rule except the size ceiling reads only the first bytes, and the ceiling needs
   a number rather than the bytes themselves.
3. A refusal **destroys the Cloudinary object** and writes a `DENIED` audit row naming the rule and
   the sniffed type. No `media_assets` row is written.

**Refusing the ROW is the control, not refusing the upload.** Nothing in this product reads Cloudinary
except through `media_assets`: every renderer takes a row, and an object with no row is unreferenced
storage. So a file whose bytes are not what the upload claimed never becomes an asset, which is the
property that matters, even though it briefly existed in the account.

**An unreadable original is refused, not waved through.** A verdict that fell open on a network error
would make this gate absent exactly when the delivery origin is misbehaving.

The visitor path is unchanged and is guarded differently: `app/api/inquiries/upload-sign` applies the
narrowed allowlist and the 10 MB ceiling at the signature, and the attachments live in a private
bucket that no public read path touches.

### 7.4 What the Phase 41 validator refuses, in order

`EMPTY` → `MARKUP_REJECTED` → `UNRECOGNISED_FORMAT` → `TYPE_NOT_ALLOWED` → `DECLARED_TYPE_MISMATCH` →
`TOO_LARGE`. The order is deliberate: markup is sniffed **before** the allowlist so a polyglot cannot
pass by also satisfying a raster signature; an unrecognised signature is refused rather than accepted;
and size is last, so a 200 MB file that was never going to be accepted is refused for what it is
rather than for how big it is. One disagreement is tolerated — a GLB declared `model/gltf+json`,
because that is what a browser reports for a `.gltf` and both names describe the same acceptable
thing.

### 7.5 EXIF stripping: outstanding, with the mechanism identified

**This is not implemented, and Phase 41 says so rather than shipping an untested change to a signed
upload path.** The exposure is narrow and specific: a visitor's reference photograph is stored as its
original and handed to staff through a signed URL, so its GPS coordinates are readable by whoever
opens it. Public delivery is unaffected — every public URL is a transformation, and Cloudinary drops
metadata from derivatives.

The mechanism is an **incoming transformation** on the visitor signature, which re-encodes the stored
original and drops its metadata with it. It was not done in this phase because every signed parameter
must also be sent by the browser, byte for byte, or Cloudinary rejects the upload — so the change
spans `lib/media/providers/cloudinary.ts`, `components/patterns/Configurator/ReferenceUpload.tsx` and
`components/studio/MediaUploader.tsx`, and it cannot be verified anywhere but against the real
Cloudinary account. Shipping it blind risks breaking every upload in production to fix a staff-only
metadata leak. It is recorded in §15 as outstanding with an owner-visible reason.

---

## 8. Rate limiting

Fixed-window counters in PostgreSQL (`rate_limit_buckets`). No Redis exists in the stack (D1), and
adding one would be an amendment.

| Surface | Limit | Key |
|---|---|---|
| `submitInquiry` — `app/(site)/_actions/submit-inquiry.ts` (server action) | **5 per 10 minutes AND 10 per hour** — two windows, see below | `ip_hash` alone — a "form fingerprint" would be a second identifier derived from what the visitor typed, which is more data about them, not less |
| `POST app/api/inquiries/upload-sign` (visitor reference images) | 10 per hour, 3 per min | `ip_hash` |
| `POST app/api/media/sign` (Studio) | 20 per hour | staff `user_id` |
| `GET app/api/search/suggest` | 60 per min | `ip_hash` |
| `POST app/api/vitals` | 60 per min | `ip_hash` |
| `POST app/api/revalidate` | 30 per min | secret |
| Studio sign-in | 10 per 15 min | email hash + `ip_hash` |
| Studio password reset — `/studio/forgot-password` | 5 per hour | email hash + `ip_hash` |
| Recovery link — `GET app/api/auth/confirm` | 20 per hour | `ip_hash` alone |
| Research fetches | Per-source rate limit, delay and concurrency | source |

The inquiry limiter is called from **inside the server action** — there is no `/api/inquiries` route
handler for `proxy.ts` to match, and none may be added.

**Built in Phase 20, and the order is one line after the Zod parse rather than before it.** The
payload is parsed first so a malformed submission is refused as malformed; the limit is then
consumed BEFORE the spam signals, so a flood that trips the honeypot on every request still costs
its sender their hourly allowance. Short-circuiting on the cheap check would make the expensive one
unreachable.

**Spam control is a honeypot and a clock, and no third-party captcha** (§13). A captcha is a tracker
on a page that collects a phone number. The honeypot is a field hidden from sight AND from assistive
technology — either alone leaves somebody meeting an input nobody can explain — and a submission
completed in under three seconds is not a person reading a form. A machine gets the ordinary
save-error copy rather than a specific one: naming the honeypot tells its author what to change, and
returning success would tell a real person whose password manager filled a hidden field that their
enquiry arrived when nothing was written.

`ip_hash` is a salted SHA-256 of the address; the raw address is never stored, and
`inquiries.ip_hash` carries a CHECK that makes a raw IP written there by mistake fail at the insert
rather than sit in the column for a year looking like a hash. A limited SERVER ACTION cannot return
429 — it is not an HTTP handler — so it returns `{ ok: false, code: 'rate_limited' }` and the form
renders the seeded refusal (`FORM_COPY.error.too_many`, added in Phase 20 because SEED §49 predates
the limiter). The `/api` surfaces above still answer 429.

**The inquiry limit is TWO windows, and this table said one until Phase 42's test caught it.** The
row read "5 per hour", which is the phase document's figure; the code has shipped
`5 per 10 minutes` plus `10 per hour` since Phase 20, with the reasoning in
`lib/security/rate-limit.ts`. Five an hour refuses a second enquiry from a shared address the same
afternoon — a household, an office, a hotel — and the person on the other end has no way to learn
why. Five per ten minutes catches the flood a script produces just as well, and the hourly ten is a
ceiling a patient script cannot walk past. The code is right; this row was wrong, and
`tests/unit/rate-limit-window.test.ts` now pins both windows so the two cannot drift again.

**Known limitation, accepted and documented:** a fixed window permits a 2× burst at a window
boundary. The threat here is abuse volume, not precision; a sliding window would require Redis.

### 8.1 What Phase 41 changed in the limiter

**Every row in the table above is now wired.** Phase 20 built the limiter and used it on the two
inquiry surfaces; Phase 40 added the vitals beacon; Phase 41 connected the remaining five — search
suggestions, the Studio signing route, the revalidate endpoint, the CSP report endpoint and Studio
sign-in — so the table describes the code rather than the intention.

**The bucket key is an HMAC, not a hash.** `createHash('sha256')` over an address is reversible by
enumeration: there are four billion IPv4 addresses and a laptop walks them in minutes, so an
unsalted digest of an IP is the IP. The key is now `hmac(RATE_LIMIT_SALT, …)`, and `ip_hash` on an
inquiry is `hmac(IP_HASH_SALT, …)`. **Two salts rather than one**, because they protect different
things with different lifetimes: rotating the rate-limit salt should cost nothing but a cleared
window, while rotating the inquiry salt breaks the ability to recognise a returning enquirer's
address and is therefore a decision, not maintenance.

**A limited surface answers with `Retry-After`.** `retryAfterSeconds(windows)` returns the SHORTEST
window in force, which is the soonest a caller could legitimately try again — a longer figure would
be a lie in the polite direction and would keep a legitimate visitor waiting.

**Degrading rather than failing, where that is the honest answer.** Search suggestions return
`{ error, groups: [] }` instead of 429: a suggestion list is an enhancement, and a type-ahead that
throws at the tenth keystroke is worse than one that quietly stops suggesting. Sign-in does the
opposite — it refuses with a seeded message and writes a `SECURITY`-level log — because silently
failing a sign-in is how somebody concludes their password is wrong.

---

## 9. Response headers

Set in `proxy.ts` for every response and asserted by e2e.

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<per-request>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; media-src 'self' blob: https://res.cloudinary.com; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (belt and braces with `frame-ancestors`) |
| `X-Robots-Tag` | `noindex, nofollow` on every non-production deployment, on `/studio/**` and on `/api/**` — **delivered by Phase 39** through `next.config.ts` `headers()` (the preview case keys on `VERCEL_ENV` at build time); the rest of this table is Phase 41 |
| `Cache-Control` | `private, no-store` on `/studio/**` and every `app/api/**` response |

**Two documented exceptions, with reasons.** `style-src 'unsafe-inline'` is required by Next.js's
inline style injection and Tailwind's runtime style element. `worker-src blob:` is required by the
Draco and meshopt decoders the 3D viewer loads. `payment=()` is deliberate and permanent — there is
no payment surface (D1). Fonts are self-hosted through `next/font`, so `font-src 'self'` needs no
external origin.

### 9.1 The rollout, and how to finish it (Phase 41)

**The policy ships `Content-Security-Policy-Report-Only` and that is the shipped state, not an
oversight.** A policy that breaks the 3D viewer or a Cloudinary video breaks it in production, on
somebody's device, and the first report is usually a person saying the page is blank. So it is
collected before it is enforced.

| Step | State |
|---|---|
| Header applied to every matched response | Done — `proxy.ts`, including the redirect it may return, because a redirect is a response a browser acts on |
| Per-request nonce | Done — minted in `proxy.ts`, written onto the REQUEST as `x-rivya-nonce` so `requestNonce()` can read it during render. It is never a response header: a nonce the client can read is a nonce an injected script can reuse |
| Violations collected | Done — `POST /api/csp-report`, rate-limited before the body is read, six capped fields, query strings stripped from every path, always 204, logged at `level: SECURITY, channel: SYSTEM` |
| Soak on a deployment | **Outstanding — owner action.** Run the site with real traffic and read `/studio/operations/logs` filtered to `SECURITY` |
| Flip to enforced | **Outstanding — owner action.** Set `CSP_ENFORCE=1` in Vercel and redeploy. The variable is the only switch; `/studio/system/environment` shows which header is in use |

**The default is report-only, which is the safe direction**: forgetting the variable costs
enforcement, not availability.

**Two documented exceptions live in code, not prose.** `CSP_EXCEPTIONS` in `lib/security/headers.ts`
carries `style-src 'unsafe-inline'` and `worker-src blob:` each with its reason, and the Security
section of `/studio/system/environment` renders them — so the policy's weak points are named on the
page somebody opens after an incident, rather than only here.

**The proxy matcher was widened to reach them.** It previously matched only what the Studio guard
needed; a header set that does not run on the public site is not a header set. It now matches
everything except `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, `sitemap.xml` and
`sitemaps/`, and the Supabase session call is scoped by `STUDIO_GUARDED` so a visitor's page view
still costs no auth round trip.

---

## 10. Logging, audit and observability

Three logs, three jobs. They are never merged.

| Log | Table | Written by | Read by | Answers |
|---|---|---|---|---|
| Audit | `audit_logs` | Every privileged mutation **and every denial** | `owner`, `admin` | Who was allowed or refused to do what |
| Activity | `activity_events` | Human Studio actions worth a feed | Any staff member | What has been happening in the Studio |
| System | `system_logs` | Background jobs, integrations, cron, workflow runs | `owner`, `admin` | What the machine did and where it failed |

`audit_logs` is append-only (`revoke update, delete`), carries an `actor_role` snapshot so a later
role change cannot rewrite history, and stores `before`/`after` blobs **after** `redact`.
`system_logs` (Phase 38, `0360`) is append-only the same way, written only by the service role
through `system_log_write()`, read by `operations.logs.read`, and every write passes
`lib/logging/redact.ts` — **three layers, one fixed `[redacted]` token**: by key (secret- and
person-shaped names and every D8 server-only variable name), by value (the current value of every D8
server-only variable, wherever it appears in a string) and by shape (a JWT, a PEM private-key block,
a Cloudinary URL with credentials, a `postgres://user:pass@` connection string, a bearer token).
Never a prefix, a suffix, a length or a hash (`tests/unit/redact.test.ts`).
`system_logs` separates `level` (`INFO · WARNING · ERROR · SECURITY`) from `channel`
(`WORKFLOW · SCRAPER · MEDIA · CONTENT · AUTH · SHEETS · ANALYTICS · SYSTEM`), so "SECURITY events in
the last hour" is one query.

**Correlation.** `audit_logs` and `system_logs` both carry a `request_id` column and the logs page
filters on it. **`proxy.ts` does not yet assign one**: Phase 41 gave the proxy a per-request nonce
and the header set, and threading an id from there into every server action means a mechanism for
carrying request-scoped state into a Server Action, which the nonce solves for RENDER only. Recorded
here as outstanding rather than described as done. Until it exists, a workflow run's lines are joined
by `workflow_run_id` (`/studio/operations/workflows` links each run to its lines).

**Volume control.** Every log call carries a `dedupe_key`; identical events within five minutes
increment `occurrence_count`. Retention: `INFO`/`WARNING` 90 days, `ERROR`/`SECURITY` 400 days.

**Security events that must always be logged:** permission denial · rate-limit trip · upload
rejection with its reason class · sign-in failure · role change · destructive action and its undo ·
CSP violation report · research fetch refused by policy or by the SSRF guard.

---

## 10.1 Personal data: retention, access and erasure (Phase 41)

`inquiries` is the only personal data in the system (§1 A1). There are no customer accounts (D1), so
an enquirer has no login, no stable id and no self-service anything — every request they make is a
request to a person at the studio, and this is what that person does.

| Field | On erasure |
|---|---|
| `name` | `[erased]` |
| `phone` | `[erased]` |
| `email` | null |
| `city` | null |
| `message` | null |
| `ip_hash` | null |
| `answers` | null — the configurator's free-text map, a brief in the enquirer's own words, which routinely names their house or their street. There is no way to erase the person from it and keep it useful |

**The row survives, the person does not.** Status, dates, reference code and pipeline history stay,
so the studio's record of what happened is not rewritten and a deleted enquiry cannot be used to hide
one. That is the difference between erasing a person's data and deleting evidence.

**Two sentinels rather than nulls for name and phone.** A null name renders as an empty cell that
looks like a data-entry failure; `[erased]` says a decision was made.

| Surface | Who | What it does |
|---|---|---|
| `/studio/inquiries/all` — Data request panel | `inquiries.export`; erasure additionally the **owner's own role** | Preview (dry run), download what is held, erase |
| `npm run ops:anonymise-inquiries` | Whoever holds the service role | The same three acts from a terminal, plus the scheduled retention pass |

**Matching is by contact detail, which is why the preview is mandatory.** There is no stable id, so an
enquirer is found by the email or phone they typed and a mistyped digit finds somebody else. The
preview returns the REFERENCE CODES it would touch and writes nothing; the erasure sends those codes
back, the server re-runs the dry run, and it refuses if the set has moved. Without that, "I read the
list before I confirmed" would mean nothing.

**The CLI refuses to write without `--apply`**, and that is the most important line in the file. It
prints reference codes and never contact details, because a terminal is a place text gets pasted into
tickets. `--export` is the exception, and it writes JSON to stdout so it is redirected to a file
rather than read in a scrollback.

**Retention is 24 months from LAST ACTIVITY, not from creation.** An enquiry that became an
eighteen-month commission is live correspondence; one created the same day and never answered is not.
`updated_at` moves on every status change and every note, so it is the right clock. An already-erased
row is skipped rather than written again, so a repeated run reports zero and the operator can tell
"nothing was due" from "it ran and did nothing".

**The scheduled pass is not yet scheduled.** `anonymiseExpired` exists and the CLI runs it; wiring it
to a cron route is Phase 44's deployment work, and until then the retention window is a procedure
rather than a guarantee.

**`--months` has a floor of one, never zero.** `--months=0` would match every row in the table, which
is the accident the floor exists to refuse.

---

## 11. Incident response

No on-call rotation exists (`DEPLOYMENT.md` §10). This is the procedure for whoever is present.

| Step | Action |
|---|---|
| 1. Contain | If a secret may be exposed: rotate it **first** (`DEPLOYMENT.md` §9). If Studio access may be compromised: suspend the affected `staff_profiles` rows. If a public surface is affected: roll back the deployment |
| 2. Preserve | Do not delete logs. `audit_logs` and `system_logs` are append-only by design; capture the `request_id` range and the time window before anything is purged by retention |
| 3. Assess | Which asset in §1? Which threat in §4? Was A1 (personal data) reachable? Search `audit_logs` by actor and by `result = 'DENIED'`; search `system_logs` by `level = 'SECURITY'` |
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
| Images | **URLs only, never downloaded — the owner's decision, amendment A33 (Phase 33).** No `research_product_images` table exists; `research_image_extraction_mode` has no value that fetches bytes; `research_image_hashes` exists and holds no rows because nothing fetches them; `research_image_hashing` and `research_sources.image_hashing_enabled` are false everywhere and no code path reads either to start a fetch |
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
- [ ] On **both** signing routes: SVG rejected; extension-lie and declared-MIME-lie rejected; oversize rejected at each path's own ceiling (25 MB staff image, 10 MB visitor attachment); a sixth visitor file rejected.
- [ ] `check-research-isolation.mjs` allowlist and `BUSINESS_RULES.md` BR-F2 name the same constraints, in the same number, and the equality assertion passes.
- [ ] `node scripts/auth/check-rls.ts` — no table in `public` without RLS and at least one policy.
- [ ] `check-research-isolation.mjs` and `check-data-layer.mjs` green, each with its counter-example.
- [ ] `gitleaks detect --redact` and `npm audit --audit-level=high` clean.
- [ ] `/studio/system/environment` shows no value, prefix or length — asserted by `deploy-smoke.spec.ts`.

### 14.1 The Phase 41 gates

Five new gates, each of which found something real the first time it ran. They are listed with
what they actually refuse, because a gate described only by its name teaches nobody what it protects.

| Gate | Refuses | Current reading |
|---|---|---|
| `security:check-secret-exposure` **(needs a build; not in `npm run check`)** | A D8 server-only name used as an `env` ACCESS in a client chunk, a live secret's VALUE anywhere in `.next/static`, six known key shapes, and a high-entropy string sitting near a suspicious word. A bare MENTION of a variable name in Studio copy is reported separately as advisory — a name is not a value (D8) | 74 client file(s) clean; 2 advisory name mentions |
| `security:check-action-guards` | An exported Server Action that does not reach `requirePermission` or a named guard, following one level of delegation into `lib/` | 179 actions across 38 modules; 2 files exempt with a stated reason |
| `security:check-licences` | AGPL, GPL, LGPL, SSPL, CC-BY-NC, BUSL or a Commons Clause anywhere in the transitive closure of `dependencies` — `devDependencies` are exempt because a build tool that never ships imposes nothing on what it builds. Read from `node_modules`, not the lockfile, because a lockfile records versions and a licence can change between two of them | 102 packages, none refused |
| `a11y:check-contrast` | A token pair below its WCAG ratio, resolved through `var()` chains across every colour scheme | 33 pairs across 3 schemes |
| `a11y:check-focus-styles` | An outline removed without a replacement, unless it is scoped to the pointer-only case or sits on a `tabIndex={-1}` programmatic focus target — and the exempt cases are COUNTED, so the number is visible rather than invisible | 1 CSS rule, 2 class lists, 1 programmatic target |

**Four of the five run offline on every `npm run check`.** `security:check-secret-exposure` is the
exception and is run by hand today: it reads `.next/static`, so it needs a build first, and a gate
that passes because there is nothing to inspect is worse than no gate — it exits 1 when the directory
is empty rather than reporting success.

**`gitleaks` and `npm audit` are not wired at all yet.** They are workflow files, and Phase 42 owns
the CI work along with the rest of the deferred test track — including running
`security:check-secret-exposure` after the build step that already exists there.

---

## 15. Owner decisions still outstanding

| # | Decision | Consequence while unresolved |
|---|---|---|
| 1 | MFA for `owner` and `admin` | T13 mitigation is password-only |
| 2 | Supabase plan and PITR window | The restore lever in `DEPLOYMENT.md` §6 has no stated RPO |
| 3 | Cloudinary backup enablement and retention | An accidental asset deletion may be unrecoverable |
| 4 | Legal entity, jurisdiction, controller and statutory basis | `/privacy` and `/terms` stay `DRAFT`; incident notification duties are undefined |
| 5 | Whether a cookie banner is required | None is implemented; none is technically necessary |
| 6 | **Flip CSP to enforced** — set `CSP_ENFORCE=1` after reading `/studio/operations/logs` filtered to `SECURITY` for a week of real traffic | The policy collects violations and blocks nothing. An injected script would be reported, not stopped |
| 7 | **Set `IP_HASH_SALT` and `RATE_LIMIT_SALT` in every Vercel environment** | Neither is set today. `salt()` falls back to `SUPABASE_SERVICE_ROLE_KEY` and finally to the literal `'rivya'` — the chain exists so a rename does not reset every live window on deploy, and the last rung is a PUBLIC value, which makes every stored `ip_hash` reproducible by anyone who guesses an address. `/studio/system/environment` shows each as set or not set |
| 8 | Strip EXIF from stored originals on the visitor upload path (§7.5) | A visitor's reference photograph keeps its GPS coordinates in the private bucket, readable by staff through a signed URL. No public surface is affected |
| 6 | Whether to commission a penetration test | The posture is untested by an adversary |
| 7 | Who holds each platform account and who may rotate each secret | Rotation ownership in `ENVIRONMENT.md` §5 is nominal |

---

## 16. Open questions for the canonical decisions

1. **Retention for `audit_logs`, `activity_events` and `content_revisions` is unspecified.**
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
5. **How many foreign keys may cross the research boundary?** D5 forbids research tables joining
   directly to public product tables but fixes no number, so the corpus has drifted: `DATA_MODEL.md`
   §1.1 rule 7 and §11 say three, while `PHASE-23-30.md`, `PHASE-31-38.md` (which owns the Phase 34
   migration) and `SCRAPER.md` §13.2 say two. T5 above holds at two, with the schema-owning documents.
   Because the isolation guard asserts *equality* with its allowlist, this is a build failure waiting
   on whichever number is wrong — not a documentation nicety. Suggested amendment: state in D5 that
   research→public references are permitted **only** to `categories`, are allowlisted by constraint
   name, and that the count is whatever that allowlist holds — then correct the losing document.
   `BUSINESS_RULES.md` §M open question 7 sets out the two ways to close it.
6. **`lib/security/` is not a D2 domain.** §7 and §8 depend on `lib/security/rate-limit.ts` and §9 on
   `lib/security/csp.ts`, and D2's ten `lib/` subdomains contain neither; nor does the eight-domain
   pending-amendment table in `ARCHITECTURE.md` §3. It meets that table's own criterion — a distinct
   trust boundary — so amendment **A3** should enumerate nine domains, not eight.
   (`BUSINESS_RULES.md` §M open question 6; `ARCHITECTURE.md` open question 2.)
