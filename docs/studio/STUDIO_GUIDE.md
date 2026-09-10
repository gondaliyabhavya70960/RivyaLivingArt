---
doc: STUDIO_GUIDE
status: CURRENT
owning_phase: 05
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
---

# STUDIO GUIDE — operating Rivya Living Art

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `ARCHITECTURE.md` (runtime boundaries and the publish path),
> `DATA_MODEL.md` (every table and column named here), `SCRAPER.md` (the research subsystem in
> depth), `docs/content/CONTENT_GUIDE.md` (block catalogue and editorial workflow),
> `docs/media/MEDIA_GUIDE.md` and `docs/media/HIGGSFIELD_GUIDE.md` (asset governance),
> `docs/project/BUSINESS_RULES.md` (what the business forbids).
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (*FEAT §n*) and
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (*SEED §n*).
> Built by Phase 05 and extended by every phase that adds a Studio surface
> (`docs/project/phases/PHASE-00-04.md` … `PHASE-39-46.md`).

Rivya Studio is the internal workspace at `/studio`. It is the only place the website's copy,
catalogue, media, merchandising, enquiries and competitive research are changed. It is not a
storefront administration panel, because Rivya has no store to administer: **no online checkout, no
payment gateway, no customer accounts.** Every conversion path in the product ends the same way — a
persisted `inquiries` row, then a WhatsApp handoff — and nothing in this guide describes an
alternative, because none exists.

---

## 0. How to read this document

| Element | Meaning |
|---|---|
| **Route** | A leaf of the D4 Studio route map, written exactly as D4 writes it |
| **Permission** | A `<domain>.<action>` string from `lib/auth/permissions.ts`, checked server-side by `requirePermission()` before the page renders |
| **Owning phase** | The phase that fills the route. Until then the leaf renders a `StudioPage` stub naming that phase — never a 404, never "Coming Soon" |
| **Guardrail** | A rule the operator cannot switch off. Guardrails are enforced in the database, in the server action, or in both — never only in the UI |
| **OWNER_VERIFICATION_REQUIRED** | A statement about the real business that this repository cannot assert. The owner confirms it; until then it cannot be published |

Section 3 is the index: every route, its permission and its owning phase in one table. Sections 5–13
follow the D4 route map group by group. Section 19 is the acceptance test for the whole project.

---

## 1. What the Studio is for

FEAT §16 calls the Studio "the central control system" and FEAT §49 sets its acceptance test in one
question: *can the owner manage everything without code changes?* Section 19 answers it with a table.

Four properties define the workspace:

1. **Every public sentence is a database row.** No marketing copy lives in a `.tsx` file (D2, SEED
   §1). An editor changing a headline changes `page_sections.heading`; there is no deploy.
2. **Every mutation is permission-checked twice.** RLS is the coarse net in PostgreSQL;
   `requirePermission()` in the server action is the fine net. `proxy.ts` only redirects
   unauthenticated requests — it never authorises (D4).
3. **Every mutation is recorded three ways.** `audit_logs` records who was allowed or refused,
   `activity_events` records what a human did in the Studio, `system_logs` records what the machine
   did. The three are never merged (§13.6).
4. **Nothing invents a business fact.** The Studio has controls for marking a claim
   `OWNER_VERIFICATION_REQUIRED` and gates that make publishing an unverified claim impossible. It
   has no control anywhere that generates a product, a price, a dimension, a testimonial, a delivered
   project or a media asset out of nothing (D10).

### What the Studio deliberately cannot do

| Not present | Why |
|---|---|
| Order, cart, checkout, payment or refund screens | No such tables exist and none may be created (D1, `DATA_MODEL.md` §1.7) |
| Customer accounts, customer profiles, wishlists | Visitors never authenticate. `staff_profiles` holds staff only |
| A "generate this asset" control, anywhere | D6 and FEAT §33: the 250 catalogued Higgsfield assets are reused, never regenerated |
| An "import this competitor product" control | FEAT §25: research is never automatically imported. §12.13 describes the one human bridge |
| A control that publishes an `OWNER_VERIFICATION_REQUIRED` row | A database trigger refuses the transition (`enforce_status_transition`, `DATA_MODEL.md` §8.2) |
| A bulk hard-delete | Bulk archives; permanent deletion stays a single-row action (§7.8) |
| Any display of a secret value, prefix, suffix, length or hash | D8, taken literally (§13.4) |

---

## 2. Access: login, roles and the two nets

### 2.1 Sign-in

`/studio/login` is the only unauthenticated route in the `(studio)` group. Copy is seeded, not
written into JSX (SEED §38, verbatim):

| Element | Copy | Source |
|---|---|---|
| Heading | **Rivya Studio** | `global_content` · `STUDIO_HELP` · `studio_help.login_heading` |
| Body | **Manage the collection, website, media, enquiries and research workspace.** | `studio_help.login_body` |
| Button | **Sign In** | `studio_help.login_button` |

There is **no public sign-up call to action, and no sign-up route**. Staff exist because an owner or
admin invited them at `/studio/system/users`; a `auth.users` insert trigger creates the matching
`staff_profiles` row as `status = 'INVITED'`, `role = 'viewer'`, and any elevation from there is an
explicit, audited action. Sign-out is `POST /api/auth/sign-out`, origin-checked, and writes an audit
row.

Because the login page renders before a session exists, its three strings are read through the
anonymous `global_content` policy (`status = 'PUBLISHED'` and `is_enabled`). They are Studio chrome,
not business facts, and carry `fact_classification = 'BRAND_COPY'`.

### 2.2 The six roles

D5 fixes the role list. One role per user, stored on `staff_profiles.role`.

| Role | Who it is for |
|---|---|
| `owner` | The business owner. Holds every permission plus `system.owner.transfer`, which no other role can ever hold |
| `admin` | Full operational control, including users, flags, audit and logs |
| `editor` | Website copy, pages, portfolio, journal, FAQs, SEO, media. No catalogue writes, no research |
| `merchandiser` | Catalogue, merchandising, bulk operations, enquiries, research review and confirmation |
| `researcher` | The research workspace: sources, runs, extraction, review. No catalogue or content writes |
| `viewer` | Read-only across the surfaces they can see. No write permission of any kind |

### 2.3 The permission matrix

Authoritative copy lives in `lib/auth/permissions.ts` and is generated into SQL by
`scripts/auth/gen-role-sql.ts`, with a CI drift check. Reproduced here because every section below
cites it.

| Permission | owner | admin | editor | merchandiser | researcher | viewer |
|---|---|---|---|---|---|---|
| `catalog.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `catalog.write` | ✓ | ✓ | — | ✓ | — | — |
| `catalog.publish` | ✓ | ✓ | — | ✓ | — | — |
| `content.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `content.write` | ✓ | ✓ | ✓ | — | — | — |
| `content.publish` | ✓ | ✓ | ✓ | — | — | — |
| `media.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `media.write` | ✓ | ✓ | ✓ | ✓ | — | — |
| `media.delete` | ✓ | ✓ | — | — | — | — |
| `merchandising.write` | ✓ | ✓ | — | ✓ | — | — |
| `inquiries.read` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `inquiries.write` | ✓ | ✓ | — | ✓ | — | — |
| `inquiries.export` | ✓ | ✓ | — | ✓ | — | — |
| `research.read` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `research.write` | ✓ | ✓ | — | — | ✓ | — |
| `research.confirm` | ✓ | ✓ | — | ✓ | — | — |
| `analytics.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bulk.execute` | ✓ | ✓ | — | ✓ | — | — |
| `destructive.execute` | ✓ | ✓ | — | — | — | — |
| `operations.audit.read` | ✓ | ✓ | — | — | — | — |
| `operations.logs.read` | ✓ | ✓ | — | — | — | — |
| `system.settings.write` | ✓ | ✓ | — | — | — | — |
| `system.flags.write` | ✓ | ✓ | — | — | — | — |
| `system.users.manage` | ✓ | ✓ | — | — | — | — |
| `system.owner.transfer` | ✓ | — | — | — | — | — |

**Permissions added after the Phase 04 matrix.** Each is required by a route documented below.
Phase 05 added the four its own routes could not be gated without — a stub with no permission is a
route nobody has decided the audience for, and it would have to be invented again by the phase that
fills it. The remaining two are still proposals, raised in §18.

| Permission | Needed by | Holders | Status |
|---|---|---|---|
| `studio.access` | the shell, and `/studio/system/flags` | every active staff role | **Added, Phase 05** |
| `activity.read` | `activity_events` and the Activity tab | every active staff role | **Added, Phase 05** |
| `system.environment.read` | `/studio/system/environment` | owner, admin | **Added, Phase 05** |
| `system.docs.read` | `/studio/system/documentation` | owner, admin, editor, merchandiser, researcher | **Added, Phase 05** |
| `content.review` | the `REVIEW → APPROVED` transition | owner, admin, editor | Proposed — Phase 08 |
| `operations.logs.export` | log CSV export | owner, admin | Proposed — Phase 38 |

`activity.read` is deliberately distinct from `studio.access` even though both are held by all six
roles today. They answer different questions — "may this person enter the Studio" and "may this
person read the activity feed" — and `activity_events` needs a table read permission, which
"access the Studio" is the wrong shape for. It is equally deliberately distinct from
`operations.audit.read` (owner and admin only): merging the activity feed with the authorisation
log would put every `DENIED` row in front of a viewer.

The matrix now holds **29** permissions. `lib/auth/permissions.test.ts` asserts that count as a
tripwire, so a change to the matrix cannot be made without someone reading the assertions.

### 2.4 Navigation visibility is computed per leaf, not per group

`lib/auth/studio-nav.ts` is the single declarative manifest of the D4 route map — the only place in
the repository where a Studio route path is written down — and `lib/auth/nav-visibility.ts` filters it
for the session role. **Built in Phase 05**, and the claim is enforced rather than asserted:
`tests/unit/studio-nav.test.ts` PARSES the D4 block out of `CANONICAL-DECISIONS.md` and requires it
to equal the manifest, and requires the manifest to equal the `page.tsx` files on disk. Both
directions fail — a leaf with no page, and a page the manifest does not name. The second is the one
that matters: a hand-added route would be unreachable from the sidebar and governed by no permission
here. Two rules keep the sidebar honest:

1. **A leaf is shown when the role holds its read permission.** Not when a hand-written group matrix
   says so. A role that can reach a route by typing its URL and get a `200` must be able to see it in
   the sidebar; a hidden-but-reachable route is a worse outcome than a visible read-only one.
2. **A group is shown when at least one of its leaves is shown.** This is what lets a merchandiser
   see the Operations group for `data-quality` (`catalog.read`), `imports` and `exports` (both
   `bulk.execute`) without seeing `audit` or `logs` (both owner/admin).

**Navigation filtering is presentation only.** D4 is explicit: every page re-checks permission
server-side. A lint rule fails any `page.tsx` under `app/(studio)/studio/**` that does not call
`requirePermission()` or `requireRole()`, and `tests/e2e/studio-rbac.spec.ts` requests every route
directly as each of the six roles.

### 2.5 Group-level access at a glance

Derived from §2.3 by the §2.4 rules, leaf by leaf — **this table is a summary of that derivation, never
an override of it.** Where a cell and §3's per-leaf permissions disagree, §3 wins and this table is
wrong. "read" means the role sees every leaf in the group but every write control is absent, not
disabled-looking; a named list means the role sees only those leaves.

| Group | owner | admin | editor | merchandiser | researcher | viewer |
|---|---|---|---|---|---|---|
| Overview | full | full | full | full | full | read |
| Catalog | full | full | read | full | read | read |
| Merchandising | full | full | read | full | read | read |
| Content | full | full | full | read | read | read |
| Media | full | full | full | full | read | read |
| Inquiries | full | full | read | full | hidden | read |
| Research | full | full | hidden | review + confirm | full | read |
| Operations | full | full | data-quality (read) | data-quality (read) + imports + exports | data-quality (read) | data-quality (read) |
| System | full | full | documentation + flags (read) | documentation + flags (read) | documentation + flags (read) | flags (read) |

Two rows deserve the explanation, because an earlier draft of this table understated them:

- **Operations is not owner/admin-only.** `/studio/operations/data-quality` reads under `catalog.read`
  (§3), which §2.3 grants to all six roles, so every role sees the Operations group for that one leaf.
  `workflows`, `audit` and `logs` remain owner/admin; `imports` and `exports` remain `bulk.execute`.
- **System is not hidden from `viewer`.** `/studio/system/flags` reads under `studio.access` (§3),
  proposed in §2.3 for every active staff role, and §13.12 states flags are readable by any active
  staff member and writable only under `system.flags.write`. So all six roles see System → Feature
  Flags, and `viewer` sees nothing else in the group, because `system.docs.read` is proposed for the
  other five roles only. The alternative resolution — narrowing the flags read permission to
  `system.flags.write` — was **rejected**: it would make the register of what is switched on invisible
  to the roles most likely to be told "that feature is off", and it contradicts §13.12. §18 item 5
  records that `PHASE-05-09.md` and Phase 19 describe this group differently and one of them needs
  correcting.

---

## 3. The route map, with permissions and owning phases

D4's map, leaf by leaf. This table is the index to sections 5–13.

| Route | Read permission | Write permission | Owning phase |
|---|---|---|---|
| `/studio/login` | — (public) | — | 04 |
| `/studio` (Overview · Analytics · Activity) | `studio.access` | — | 05 · 37 |
| `/studio/catalog/products` | `catalog.read` | `catalog.write` · `catalog.publish` | 14 · 15 |
| `/studio/catalog/categories` | `catalog.read` | `catalog.write` | 14 |
| `/studio/catalog/collections` | `catalog.read` | `catalog.write` (confirm: owner/admin) | 14 · 16 |
| `/studio/catalog/materials` | `catalog.read` | `catalog.write` | 14 |
| `/studio/catalog/relationships` | `catalog.read` | `catalog.write` | 23 |
| `/studio/catalog/customization-forms` | `catalog.read` | `catalog.write` | 19 |
| `/studio/catalog/bulk` | `bulk.execute` | `bulk.execute` (+ `destructive.execute`) | 24 |
| `/studio/merchandising/homepage` | `catalog.read` | `merchandising.write` | 22 |
| `/studio/merchandising/store` | `catalog.read` | `merchandising.write` | 22 |
| `/studio/merchandising/featured` | `catalog.read` | `merchandising.write` | 22 |
| `/studio/merchandising/scheduling` | `catalog.read` | `merchandising.write` | 22 |
| `/studio/content/pages` | `content.read` | `content.write` · `content.publish` | 08 · 09 |
| `/studio/content/homepage` | `content.read` | `content.write` · `content.publish` | 08 · 11 |
| `/studio/content/portfolio` | `content.read` | `content.write` · `content.publish` | 17 |
| `/studio/content/journal` | `content.read` | `content.write` · `content.publish` | 18 |
| `/studio/content/testimonials` | `content.read` | `content.write` · `content.publish` | 17 |
| `/studio/content/faqs` | `content.read` | `content.write` · `content.publish` | 08 · 09 |
| `/studio/content/navigation` | `content.read` | `content.write` · `content.publish` | 08 |
| `/studio/content/footer` | `content.read` | `content.write` · `content.publish` | 08 |
| `/studio/content/seo` | `content.read` | `seo.write` (see §18) | 08 · 39 |
| `/studio/media/all` | `media.read` | `media.write` · `media.delete` | 06 · 24 · 43 |
| `/studio/media/images` | `media.read` | `media.write` | 06 |
| `/studio/media/videos` | `media.read` | `media.write` | 06 |
| `/studio/media/models` | `media.read` | `media.write` | 06 · 21 |
| `/studio/media/documents` | `media.read` | `media.write` | 06 |
| `/studio/media/higgsfield` | `media.read` | `media.write` | 07 · 43 |
| `/studio/media/brand` | `media.read` | `media.write` | 06 · 43 |
| `/studio/inquiries/all` | `inquiries.read` | `inquiries.write` · `inquiries.export` | 20 |
| `/studio/inquiries/product` | `inquiries.read` | `inquiries.write` | 20 |
| `/studio/inquiries/commission` | `inquiries.read` | `inquiries.write` | 20 |
| `/studio/inquiries/consultation` | `inquiries.read` | `inquiries.write` | 20 |
| `/studio/inquiries/quote` | `inquiries.read` | `inquiries.write` | 20 |
| `/studio/research/dashboard` | `research.read` | — | 25 |
| `/studio/research/sources` | `research.read` | `research.write` (approve: owner/admin) | 25 · 26 |
| `/studio/research/scrape` | `research.read` | `research.write` | 25 |
| `/studio/research/jobs` | `research.read` | `research.write` | 25 |
| `/studio/research/runs` | `research.read` | `research.write` | 25 · 27 |
| `/studio/research/changes` | `research.read` | `research.confirm` | 29 |
| `/studio/research/explorer` | `research.read` | `research.confirm` | 28 · 29 |
| `/studio/research/large-format` | `research.read` | `research.write` | 30 |
| `/studio/research/compare` | `research.read` | `research.write` | 31 |
| `/studio/research/similarity` | `research.read` | `research.write` | 33 |
| `/studio/research/opportunities` | `research.read` | `research.write` (activate model: owner/admin) | 32 · 34 |
| `/studio/research/shortlist` | `research.read` | `research.confirm` | 35 |
| `/studio/research/confirmed` | `research.read` | `research.confirm` | 35 |
| `/studio/research/sheets` | `research.read` | `research.write` | 36 |
| `/studio/operations/workflows` | `operations.logs.read` | — | 38 |
| `/studio/operations/data-quality` | `catalog.read` (+ `research.read` for the research tab) | — | 14 · 28 |
| `/studio/operations/imports` | `bulk.execute` | `bulk.execute` | 24 |
| `/studio/operations/exports` | `bulk.execute` | `bulk.execute` · `inquiries.export` | 24 |
| `/studio/operations/audit` | `operations.audit.read` | — | 04 · 24 |
| `/studio/operations/logs` | `operations.logs.read` | `operations.logs.export` | 38 |
| `/studio/system/users` | `system.users.manage` | `system.users.manage` | 04 |
| `/studio/system/settings` | `system.settings.write` | `system.settings.write` | 20 · 23 · 29 · 30 |
| `/studio/system/integrations` | `system.settings.write` | `system.settings.write` | 36 · 38 |
| `/studio/system/environment` | `system.environment.read` | — (read-only, always) | 38 · 41 · 44 |
| `/studio/system/documentation` | `system.docs.read` | — (read-only, always) | 38 · 46 |
| `/studio/system/flags` | `studio.access` | `system.flags.write` | 19 · 38 |

Nested detail routes, which are not D4 leaves but are reached from them:
`/studio/catalog/products/[id]` · `/studio/catalog/collections/[collectionId]` ·
`/studio/catalog/customization-forms/[formId]` · `/studio/content/pages/[pageId]` ·
`/studio/content/pages/global` · `/studio/content/portfolio/[projectId]` ·
`/studio/content/journal/[articleId]` · `/studio/content/journal/categories` ·
`/studio/inquiries/[inquiryId]` · `/studio/research/runs/[id]` · `/studio/research/compare/[setId]` ·
`/studio/research/opportunities/direction[/briefId]` · `/studio/operations/audit/[operationId]` ·
`/studio/system/documentation/[docKey]`.

**The stub policy.** Every D4 leaf resolves from Phase 05 onward. A leaf whose owning phase has not
run renders `StudioPage` with the phase that will fill it, drawn from the navigation manifest — never
a bare 404, never an empty page, and never the words "Coming Soon" (SEED §55).

---

## 4. The shell

**Built in Phase 05.** `app/(studio)/studio/(shell)/layout.tsx` is a Server Component. It calls
`requirePermission('studio.access')`, and `components/studio/StudioShell.tsx` resolves the
navigation manifest for the session role and renders: skip link → sidebar → `<main id="studio-main">`.

**Why `(shell)` and not `studio/layout.tsx`,** which is what earlier drafts of this section said.
`/studio/login` is a child of `/studio` in the URL, so a layout at `studio/layout.tsx` wraps the
sign-in page — putting a permission check in front of signing in, which is a redirect loop that
presents to the user as "my password is wrong". A route group adds a layout without adding a URL
segment, so `(shell)/page.tsx` is still `/studio` and login is simply not a member.

`app/(studio)/layout.tsx` sits above both and carries the `rv-scheme-bone` ground for the whole
group, login included. It authorises nothing, for the reason above.

**The h1 belongs to the page, not the shell.** `StudioPage` renders it, from the navigation
manifest. A heading in the shell as well would give every Studio surface two, and a screen-reader
user navigating by heading would land on the product name rather than on what they opened.

**Not yet built:** the top bar. The breadcrumb trail lives on the page (through `StudioPage`), and
the user menu, role badge and deployment-environment badge are not built — the role is shown as
text in the sidebar instead. The ⌘K trigger is a keyboard shortcut with no visible affordance yet.

### 4.1 Studio primitives

`components/studio/**`. Every Studio surface is composed from these; a screen that hand-rolls a table
or a confirmation is a review failure.

| Primitive | Purpose |
|---|---|
| `StudioPage` | Title, description, breadcrumb, actions slot, permission gate, stub notice |
| `PageHeader` · `Toolbar` | Consistent header and action alignment |
| `DataTable` | Column definitions, sort, pagination, empty state, row-selection hook consumed by bulk |
| `FilterBar` | URL-synced filters — `searchParams` are the state, so a filtered view is shareable |
| `StatCard` | Value, delta, hint, and an explicit unavailable state carrying a reason |
| `StatusPill` | Renders `content_status` and `owner_verification` |
| `EmptyState` | Heading, body, action. Never "Coming Soon" |
| `ConfirmDialog` | Required for every destructive action (FEAT §20) |
| `DrawerForm` · `FormField` | Server-action forms with Zod error mapping |
| `PermissionGate` | Client-side hiding only. **Never the sole guard** |
| `RelativeTime` · `ActorChip` | Activity and audit rendering |
| `CommandPalette` | The ⌘K overlay (§6) |
| `MediaUploader` | Signed direct-to-Cloudinary upload; cannot save without alt text |
| `CoverageBadge` | `n`, denominator and as-of date on every analytics figure |

**Built in Phase 05:** `StudioPage`, `PageHeader`, `Toolbar`, `DataTable`, `FilterBar`, `StatCard`,
`StatusPill`, `EmptyState`, `ConfirmDialog`, `DrawerForm`, `FormField`, `PermissionGate`,
`RelativeTime`, `ActorChip`, `CommandPalette`. `MediaUploader` belongs to Phase 06 and
`CoverageBadge` to Phase 31.

#### What these primitives are actually for

Each exists to preserve a distinction that a careless implementation collapses — always into the
most reassuring reading, which is why the collapse is not noticed. These are the ones worth knowing
before using them, because a call site that ignores them re-introduces the bug:

- **`StatCard` has three states, not a number with a default.** A number, `unavailable` (the table
  does not exist yet — shows the owning phase), and `unreadable` (the query failed). A default is
  precisely how a zero gets back in, and "Open enquiries: 0" reads as "nobody has enquired" when the
  truth is that enquiries do not exist until Phase 20. That is a fabricated business fact under D10,
  and the owner has no way to detect it.
- **`EmptyState` takes a reason, not a boolean.** `empty`, `filtered`, `unreadable`. Telling somebody
  "no products" while a status filter is on is how people conclude their records have been deleted.
- **`DataTable` requires an empty reason** for the same purpose, and is a real `<table>` — row and
  column position announced by the element, find-in-page working, "navigate by table" working.
- **`ActorChip` renders a null actor as "System", never "Unknown".** A null actor is the seed runner
  or a migration (DATA_MODEL §1.6); "Unknown" sends somebody looking for a colleague who does not
  exist.
- **`RelativeTime` says "just now" under an hour** rather than a minute count. It renders on the
  server and never ticks, so a number is false within a minute. The exact instant is always in
  `datetime` and `title`. A future timestamp is a clock problem, not "in 2 hours".
- **`StatusPill` renders the state as a word as well as a tone** (WCAG 1.4.1), and
  `OWNER_VERIFICATION_REQUIRED` is **warning**, not neutral: it is the D10 gate, the one state an
  owner must act on, and quiet grey would make it the least visible thing on the row.
- **`PermissionGate` protects nothing.** It removes a button. The Server Action behind it is an HTTP
  endpoint reachable with `curl` and a session cookie; `withPermission` and RLS are what refuse it.
  It is a component rather than an inline `&&` so that this sentence has somewhere to live.
- **`FilterBar` submits with `GET`**, so the browser builds the query string. That is why it works
  with JavaScript off, and why a filtered view can be linked, reloaded and reached with Back.
- **`ConfirmDialog` has two strengths.** `typeToConfirm` requires typing an exact phrase and is for
  actions that destroy something unrecoverable; the point is to break the muscle memory of clicking
  through a dialog, which a plain "Are you sure?" acquires by the tenth showing.

`ConfirmDialog`, `DrawerForm` and `CommandPalette` compose `components/patterns/{Dialog,Drawer}`
rather than rebuilding them: the focus trap, Escape, focus restoration, scroll lock and labelling
contract were solved and tested in Phase 02, and a second implementation is a second set of those
bugs.


### 4.2 Per-user state

`studio_preferences`, one row per user, readable and writable only by that user
(`user_id = auth.uid()`; no cross-user read).

| Column | Effect |
|---|---|
| `sidebar_collapsed` | Sidebar starts collapsed |
| `pinned_routes text[]` | Pinned leaves appear above the groups |
| `dashboard_card_order text[]` | Overrides the default card order on the Overview tab |

Preferences are chrome, never permissions. A pinned route the role cannot read is filtered out on
read.

### 4.3 Accessibility and the QA matrix

Semantic landmarks, a working skip link, a visible focus ring on every control, labelled form fields,
accessible dialogs and tabs, and `prefers-reduced-motion` respected. The shell is checked at the FEAT
§45 viewports — 1920 · 1440 · 1280 · 1024 · 768 · 430 · 390 · 360 — as an exit criterion, not as an
afterthought.

---

## 5. `/studio` — Overview, Analytics, Activity

D4 places analytics and activity on the overview route rather than as route segments, so `/studio`
carries three tabs.

**Who can see it.** Every role. Cards and metrics are filtered per role; a metric a role cannot see is
absent, not shown as a locked placeholder.

### 5.1 Dashboard welcome copy (SEED §39, verbatim)

| Element | Copy | `global_content` key |
|---|---|---|
| Heading | **Studio Overview** | `studio_help.dashboard_heading` |
| Intro | Manage Rivya's website, products, media, enquiries, merchandising and competitive research from one workspace. | `studio_help.dashboard_intro` |

### 5.2 Quick actions (SEED §39, verbatim labels)

Rendered as a single row above the cards. **Role permissions control visibility** — an action whose
permission the role lacks is not rendered.

| Label | Destination | Permission |
|---|---|---|
| Add Product | `/studio/catalog/products` → new | `catalog.write` |
| Edit Homepage | `/studio/content/homepage` | `content.write` |
| Upload Media | `/studio/media/all` → uploader | `media.write` |
| Add Portfolio Project | `/studio/content/portfolio` → new | `content.write` |
| Create Journal Post | `/studio/content/journal` → new | `content.write` |
| View Enquiries | `/studio/inquiries/all` | `inquiries.read` |
| Run Product Research | `/studio/research/scrape` | `research.write` |
| Review Scraped Products | `/studio/research/changes` | `research.read` |

### 5.3 The dashboard card set

Cards are declared in `lib/analytics/dashboard-cards.ts`. Each entry carries `id`, `label`, `roles`,
`permission`, `query`, `href` and `availableFromPhase`. **A card whose backing table does not exist
yet renders an unavailable state naming the phase, never a zero and never an invented figure**
(FEAT §17, D10). A card that reads a real zero renders the zero — an empty catalogue is a true fact
about the product, not an error.

| # | Card id | Label | Definition | Backing table | Permission | From |
|---|---|---|---|---|---|---|
| 1 | `products_total` | Products | `count(*)` over `products` | `products` | `catalog.read` | 14 |
| 2 | `products_published` | Published Products | `status = 'PUBLISHED'` | `products` | `catalog.read` | 14 |
| 3 | `products_draft` | Draft Products | `status = 'DRAFT'` | `products` | `catalog.read` | 14 |
| 4 | `products_large_format` | Large-Format Products | `is_large_format` and `status = 'PUBLISHED'` | `products` | `catalog.read` | 14 |
| 5 | `collections_total` | Collections | by `concept_state`, published split out | `collections` | `catalog.read` | 16 |
| 6 | `portfolio_projects` | Portfolio Projects | by `status` | `portfolio_projects` | `content.read` | 17 |
| 7 | `journal_articles` | Journal Articles | by `status`, plus scheduled count | `journal_articles` | `content.read` | 18 |
| 8 | `inquiries_open` | Open Enquiries | `pipeline_status in ('NEW','READ','IN_CONVERSATION')` | `inquiries` | `inquiries.read` | 20 |
| 9 | `inquiries_commission` | Custom Commission Enquiries | as above, `kind = 'COMMISSION'` | `inquiries` | `inquiries.read` | 20 |
| 10 | `research_runs` | Scraper Runs | last 7 days by `status` | `research_runs` | `research.read` | 25 |
| 11 | `research_new` | New Competitor Products | `first_seen_at` within 7 days | `research_products` | `research.read` | 25 |
| 12 | `research_changed` | Changed Competitor Products | `materiality = 'MATERIAL'` and undecided | `research_changes` | `research.read` | 29 |
| 13 | `research_review` | Products Awaiting Review | `stage = 'REVIEW'` and `disposition = 'NONE'` | `research_products` | `research.read` | 29 |
| 14 | `research_shortlisted` | Shortlisted Products | open entries (`closed_at is null`) | `research_shortlist_entries` | `research.read` | 35 |
| 15 | `research_confirmed` | Confirmed Products | not archived | `research_confirmations` | `research.read` | 35 |
| 16 | `media_assets` | Media Assets | `count(*)` by `kind` | `media_assets` | `media.read` | 06 |
| 17 | `media_missing` | Missing Media | declared slots with no `media_usages` row | `content/media-slots.ts` × `media_usages` | `media.read` | 07 |
| 18 | `higgsfield_pending` | Higgsfield Assets Pending | manifest rows unmigrated, or with unreviewed draft alt text | `media_assets` | `media.read` | 07 |
| 19 | `data_quality_errors` | Data Quality Errors | failing `lib/catalog/validation.ts` rules, plus `severity = 'ERROR'` research issues | computed · `research_validation_issues` | `catalog.read` | 14 · 28 |
| 20 | `system_health` | System Health | worst status across the eight environment checks | none — computed | `system.environment.read` | 38 |
| 21 | `web_vitals` | Web Vitals | p75 per metric, last 28 days, sampled | `web_vitals_samples` | `analytics.read` | 40 |
| 22 | `owner_verifications` | Outstanding owner verifications | rows still `OWNER_VERIFICATION_REQUIRED`, grouped by surface | computed across Tier-B tables | `content.read` | 46 |

Card 13 counts *research* rows awaiting review. Rivya-side content sitting in `REVIEW` is found
through the Content group's own status filter, not through this card.

**Guardrails.** No card queries a relation that does not exist — a unit test asserts it. No card
estimates, interpolates or fills a missing figure. Card 20 reports reachability only and never a
value (§13.10).

### 5.4 The Analytics tab

Eighteen metrics from FEAT §28, declared one module per metric under `lib/analytics/metrics/`. Each
declares `definition`, `requires`, `compute`, `coverage` and `availableFrom`. Every tile renders
`n`, a denominator and an as-of date through `CoverageBadge`. **A metric that cannot be computed
renders `UNAVAILABLE` with the named reason** — not zero, not a dash, not a placeholder.

| Section | Metrics | Extra permission |
|---|---|---|
| **This studio** (first-party) | `catalog` · `product_categories` · `product_scale` · `large_format_share` · `collection_mix` · `inquiry_trends` · `content_performance` · `media_coverage` | `analytics.read` |
| **The market** (competitive) | `assortment` · `price_architecture` · `dimensions` · `materials` · `resin_styles` · `colours` · `customization` · `production_model` · `opportunity_scores` · `source_freshness` | `analytics.read` **and** `research.read`, gated by the `advanced_analytics` flag |

Two definitions an operator will otherwise misread, and both are stated on the tab itself:

- **`content_performance` is not traffic.** No web-analytics provider exists in the approved stack, so
  the metric is database-derived content health: published versus draft pages, sections per page, days
  since update, and enquiries attributed by `source_path`. The tab says in one line that traffic
  analytics are not connected. Connecting one is an owner decision — **OWNER_VERIFICATION_REQUIRED**.
- **Several competitive metrics are unavailable by design on day one.** `resin_styles`, `colours` and
  `production_model` stay `UNAVAILABLE` until an adapter declares the capability to extract them. The
  unavailable state names the missing capability and the sources that would need it, which turns an
  empty chart into a work item.

Trends come from `analytics_snapshots` — one row per metric per day, written by
`npm run analytics:snapshot` and a daily cron. A metric with fewer than two snapshots renders a figure
and no line; it is never extrapolated. The database constraint
`check ((availability = 'UNAVAILABLE') = (unavailable_reason is not null))` makes an unexplained
unavailable metric unstorable.

### 5.5 The Activity tab

Reads `activity_events`: actor, role, action, entity type, entity label, summary, timestamp. Defaults
to the last 50 events; filters by entity type and actor. `action` is a controlled vocabulary owned by
`lib/logging/activity.ts` — a feed nobody can read is a feed nobody uses.

**Guardrails.** `activity_events` is insert-only and service-role-written; there is no update or
delete policy for any application role. It is readable by any active staff member, which is why it
never carries the payload of a change — the payload lives in `audit_logs` (owner/admin) and
`content_revisions`.

---

## 6. Global command search (⌘K)

**What it is for.** One keystroke from anywhere in the Studio to any route or any indexed entity.
`⌘K` on macOS, `Ctrl-K` elsewhere.

**Who can see it.** Every role. Results are permission-scoped per provider.

**How it works.** `components/studio/command/registry.ts` holds a provider registry; the palette
itself never queries. Phase 05 ships the route provider; later phases register entity providers
without touching the palette. The server endpoint is `POST /api/studio/search/route.ts` — Zod body,
permission-scoped, never cached, capped at 20 results with a 200 ms budget per provider.

**Phase 23 registered the eight entity providers, in ONE file rather than the eight the phase
document's deliverable table named** (`components/studio/command/providers/index.ts`). Eight files
differing in three literals each — an entity type, a permission and a group name — is eight places
for the permission to be got wrong, and the one that matters (`inquiries.read`, which a researcher
does NOT hold) would be the one nobody re-read. The table in that file IS the configuration and
every provider is built from it, so a reviewer checks eight rows instead of eight files.

**They query as the reader, not as the service role.** `search_documents` has one staff-select
policy admitting every active role, so the service role would return the same rows and would put an
RLS-bypassing client inside a component that renders. The narrowing that the palette needs and RLS
cannot express — "may search enquiries but not materials", about one table — happens in the registry
BEFORE the provider runs. Two layers, in the Phase 04 order: permission first, RLS underneath.

FEAT §18 lists twelve things Studio search must cover. They map to eleven providers plus one indexed
field:

| FEAT §18 target | Provider | Index | Required permission |
|---|---|---|---|
| Products | `entity-products` | `search_documents` (`PUBLIC`) | `catalog.read` |
| SKUs | — (indexed inside the `product` document) | `search_documents` | `catalog.read` |
| Categories | `entity-categories` | `search_documents` (`PUBLIC`) | `catalog.read` |
| Collections | `entity-collections` | `search_documents` (`PUBLIC`) | `catalog.read` |
| Materials | `entity-materials` | `search_documents` (`STAFF`) | `catalog.read` |
| Portfolio | `entity-portfolio` | `search_documents` (`PUBLIC`) | `content.read` |
| Journal | `entity-journal` | `search_documents` (`PUBLIC`) | `content.read` |
| Media | `entity-media` | `search_documents` (`STAFF`) | `media.read` |
| Inquiries | `entity-inquiries` | `search_documents` (`STAFF`) | `inquiries.read` |
| Scraped Products | `research_products` | `research_search_documents` | `research.read` |
| Competitor Sources | `research_sources` | `research_search_documents` | `research.read` |
| Workflow Runs | `research_runs` | `research_search_documents` | `research.read` |

**Guardrails.**

- **Two indexes, one boundary.** `search_documents` carries a `check` constraint naming the exact
  eight permitted `entity_type` values, so no research row can be inserted into it by a bug, a
  migration or a well-meaning later phase. Research lives in `research_search_documents`, which has no
  `anon` policy, ever.
- **A provider whose permission the role lacks is dropped from the response entirely** — not returned
  empty, and not returned as a count. A viewer without `inquiries.read` must not learn that four
  enquiries matched.
- **The inquiry document carries no personal data.** Reference code, enquiry type, related product
  title and status only — never a name, phone number, email address, uploaded filename or message
  body.
- **Public search and Studio search are different surfaces.** Public search
  (`/search`, `app/api/search/suggest`) covers products, categories, collections, portfolio and
  journal, and never exposes internal research data (FEAT §19). `npm run search:check-scope` walks
  the import graph from the four public entry points and fails the build on a `research_` or
  `scraper` identifier anywhere in it.
- **The public suggest endpoint reads with the anon key even for a signed-in member of staff.** A
  response that varied by session could not be cached at the edge, and the first staff member to
  type would otherwise poison a shared cache with draft titles.
- **Index maintenance is a trigger, not a job.** `refresh_search_document(entity_type, entity_id)`
  fires on insert, update and delete of every source table, and on the two product join tables and
  the two category tables, because a material attached or a category renamed changes what a product
  should match. `scripts/search/reindex.ts` is the only supported repair path; `--dry-run` reports
  source-versus-index counts per type and is the drift check.
- **A row with no derivable title is not indexed, rather than refusing the write.** The index's
  `title` is NOT NULL, and a media asset may legitimately have no title, no Rivya id and no
  filename. Making that an index-time omission instead of a constraint violation is what stops a
  search trigger failing a write that has nothing to do with search.
- **Keyboard and screen reader.** The overlay traps focus, closes on `Esc`, is arrow-navigable, and
  announces its result count through a polite live region.

**Zero-result logging.** `search_queries` records the query text, normalised query, scope
(`PUBLIC` / `STUDIO`), result count and timestamp — with **no IP, no user agent and no actor id for
public searches** — for 90 days. It exists so the owner can see what visitors looked for and did not
find. It is not analytics and it is not a profile.

---

## 7. `/studio/catalog/*` — the catalogue

**What the group is for.** Everything that is a product or describes one: products, the seven
categories, collections-as-exhibitions, materials, the relationship graph, the customization form
templates and the bulk engine.

**Who can see it.** `catalog.read` — every role. Writes need `catalog.write` (owner, admin,
merchandiser); publication needs `catalog.publish`.

**The rule that shapes the whole group.** `products` and `product_specs` ship with **zero rows,
permanently, by seed policy** (SEED §32). A product exists because an owner typed it or because an
approved import created it. Neither path reads a research table.

### 7.1 `/studio/catalog/products`

| Aspect | Detail |
|---|---|
| **For** | Creating, editing, publishing and archiving products |
| **List columns** | Title · SKU · Category · Status · `owner_verification` · Price state · Large format · Readiness · Updated by · Updated at |
| **Detail tabs** | Identity · Pricing · Dimensions · Media · Materials · Specifications · Related · SEO · Publishing |
| **Fields (identity)** | `slug` · `sku` · `title` · `subtitle` · `summary` · `description` · `category_id` · `is_large_format` · `sort_order` |
| **Fields (pricing)** | `price_state` (`FIXED · STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST`) · `price_minor` · `price_from_minor` · `currency` |
| **Fields (state)** | `availability_state` (`READY_STOCK · MADE_TO_ORDER`) · `edition_state` (`ONE_OF_ONE · LIMITED_EDITION · OPEN_EDITION`) · `edition_size` · `is_customizable` |
| **Fields (media)** | `hero_media_id` · `model_media_id` · `product_media` rows with `role` (`hero · gallery · detail · lifestyle · process · video · model`) and `sort_order` |
| **Fields (other)** | `dimensions jsonb` · `product_materials` · `product_specs` · `product_relations` · `seo_title` · `seo_description` · `publication_readiness jsonb` |

**The publication-readiness checklist** (FEAT §22) is a transparent list of named unmet items, never
an opaque score: Title · Description · Category · Price state · Dimensions · Materials · Hero image ·
Gallery · SEO · Customization · Specifications. Publishing is refused while a required item is unmet,
and the refusal names the items. The Specifications item is satisfied by *at least one spec row* **or**
by a deliberate "no published specifications" choice, so an owner is never pushed into inventing a
value in order to publish.

**Phase 14 shipped TEN of those eleven; Phase 15 added the eleventh.** Specifications waited for the
`product_specs` table it counts — an item that always reads "Missing" because the table does not
exist would train an owner to ignore the checklist, which is the one thing a checklist cannot
survive. The first ten are FEAT §22's own list, in its order. Specifications is **required**, and
§7.1.2 explains why that is safe: it is satisfiable with no measurement at all.

Eight of the ten are **required** and block publishing: Title, Description, Category, Price state,
Dimensions, Materials, Hero image, SEO. Two are **advisory** and are shown, labelled, and never
block: Gallery, because one strong photograph is a legitimate presentation of a piece; and
Customization, because `is_customizable` is a non-null boolean that is answered by construction and
the form builder behind it is Phase 19's. The rule for the split is that an item is required when its
absence would put something dishonest or empty in front of a visitor — a product with no category has
no page to live on, with no hero image its card is a grey box, and with no materials it makes a
material-led studio look like a dropshipper.

### 7.1.1 What Phase 14 built, and what §7.1 above still describes as planned

The surface above was written before the phase. Where the two differ, this is what exists:

| §7.1 says | Phase 14 built | Why |
|---|---|---|
| Detail **tabs** — Identity · Pricing · … · Publishing | One page of labelled sections in that order, with the readiness checklist and the publish control above the form | Tabs hide the unmet items behind whichever tab is not open, which is the opposite of what a transparent checklist is for. The publish refusal has to be visible from wherever the missing field is |
| List columns including `owner_verification`, Price state, Large format, Updated by | Title · SKU · Category · Status · **Not ready** · Updated | "Not ready" lists the unmet REQUIRED items by name, per row. It is the column the screen exists for: a status says a product is a draft, and this says why. The rest are one click away on the product itself |
| `product_media` rows with `role` and `sort_order` | Phase 14: `hero_media_id` only. **Phase 15 added the Media tab** (§7.1.2) | The gallery editor waited for the product detail page that renders it. The Gallery readiness item already read `product_media`, so it lit up the moment the editor existed |
| `model_media_id`, `product_specs`, `product_relations` | Phase 14: none editable. **Phase 15 added the Specifications and Related tabs** (§7.1.2); `model_media_id` remains Phase 21's | The 3D slot renders nothing until there is a viewer — a control for a field no route displays is a promise the site cannot keep |
| Categories: `slug`, `parent_id`, `is_primary` editable | Name · Subtitle · Description · Order · Hero image · SEO | The seven are D3's taxonomy AND the route map — `/collection/[category]` pre-renders exactly these slugs. Editing a slug breaks a published URL; adding an eighth category creates a page nobody designed. What an owner legitimately changes is the wording and the order |
| — | Collections have **no publish control at all** | FEAT §9 keeps every collection a `DRAFT_COLLECTION_CONCEPT` until Phase 16 adds owner confirmation. A disabled button that never enables reads as a broken interface rather than as a rule |
| — | The hero-image picker **never offers a concept render** | The trigger and the validator both refuse one. An interface that offers a choice and then blames you for making it is the wrong shape; the two guards stay for the request that did not come from this form |

**Amounts are typed in major units.** The form asks for 12500, not 1250000, and converts once on
save. Asking an owner to type a price in paise is asking for a price wrong by a hundredfold, and the
catalogue would show it without complaint.

**Guardrails.**

- Price coherence is a database constraint: a `FIXED` product must carry `price_minor` and a
  `currency` and no `price_from_minor`; a `STARTING_FROM` product the reverse; a
  `REQUEST_QUOTE`/`PRICE_ON_REQUEST` product must carry **no number and no currency**. A quote-only
  product represented as zero is unstorable.
- `LIMITED_EDITION` without `edition_size` is rejected.
- `status = 'PUBLISHED'` with `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` is rejected.
- `dimensions` must be an object whose keys are a subset of
  `{length_mm, width_mm, height_mm, depth_mm, diameter_mm, weight_g, seats}` with positive numeric
  values. A malformed blob never reaches a renderer.
- **A concept asset cannot be attached to a product at all.** `reject_concept_product_media()` raises
  on any `product_media` insert or update referencing an asset with `is_concept = true`. Concept media
  may illustrate a material or a process; it may never be presented as a product.
- Write-time validation (FEAT §21) rejects, each with a named error: duplicate SKU, duplicate slug,
  impossible dimensions, malformed URL, broken media reference, invalid price state, a quote-only
  product carrying a price, and missing required publication data.

### 7.1.2 What Phase 15 added — the four tabs, and how a specification is entered

Phase 14 built one page of labelled sections and §7.1.1 explains why it refused tabs: tabs hide the
unmet items behind whichever tab is not open. Phase 15 adds four, and the reasoning is not reversed —
it is scoped. The readiness checklist and the publish control stay on the Overview tab with the
fields they describe. What moved out are the four **collections of rows** that were never fields on
that form: media edges, material links, specification rows and relation edges.

| Route | What it edits |
|---|---|
| `…/[productId]` | Overview — the readiness checklist, the publish control, and the product's own columns |
| `…/[productId]/media` | `product_media` — attach, detach, `role`, `sort_order` |
| `…/[productId]/materials` | `product_materials` — attach, detach, and the optional note |
| `…/[productId]/specifications` | `product_specs`, plus the read-only dimensions panel and the omission control |
| `…/[productId]/related` | `product_relations` — create, order and remove edges by hand |

**Each tab is a URL, not a pane.** An editor can bookmark one piece's specification table, open two
products' Media tabs side by side, and use the back button as a back button. The active tab carries
`aria-current="page"`, not only a colour.

**One form per row, not one per tab.** A concept asset refused by the database costs the editor that
row's submission and nothing else; a whole-tab form would lose every other edit on the screen to one
refusal.

#### Entering a specification

This is the strictest surface in the Studio, and what is ABSENT from it is the design.

- **There is no "not applicable" option, no unit converter, no "estimate" checkbox and no
  placeholder to choose from.** Each of those is a way to publish a sentence nobody measured.
- **A row exists when you have something to say, and does not exist otherwise.** Leave a field blank
  to omit the row. The block on the product page then has one fewer line, and a visitor reads
  nothing at all rather than a dash implying a value is being withheld.
- **The value is text and stays text.** "450", "45–50" and "made to order" are all valid and all
  stored exactly as typed. Nothing parses a number out of it, which is what keeps unit conversion
  one refactor further away than it would otherwise be.
- **The unit is what you type.** A millimetre is displayed in millimetres. There is no centimetre
  toggle and no inch conversion anywhere on the site (BR-D8).
- **Dimensions are entered on the Overview tab** and shown here read-only, only for the keys that
  have a value. Showing all seven with the empty ones greyed would teach an editor that the block
  has a fixed shape with gaps in it, which is the impression the whole rule exists to prevent.
- **Two rows cannot share a label on one product.** A block listing "Seat height" twice with two
  different numbers is worse than one that omits it — which of the two is true is not a question a
  visitor can answer.

#### If a piece publishes no specifications

Say so, deliberately, with the control at the bottom of the tab. It records
`products.specifications_omitted` and satisfies the required Specifications readiness item with no
row at all.

**This exists so that the checklist is never a reason to invent a number.** A required item whose
only satisfaction is a spec row is an incentive to estimate one, and an estimate presented as a
measurement is exactly what D10 forbids. What the checklist requires is the DECISION, never the
value. The decision has its own action and its own audit entry, and saving an unrelated field on the
Overview form cannot clear it.

It is not a claim about the object. It says "we are not publishing specifications for this piece",
never "this piece has no dimensions". Nothing on the public site renders it. Changing your mind
later is ordinary: add a row and the item is satisfied the other way.

#### Relations

Relations are made by hand and render as "Related". A product with none falls back to up to six
other published products in the same category, under its own heading — "More in {Category}", never
"Related" and never "You may also like". The distinction is the point: "Related" is a claim an
editor made, and the fallback is an observation about a category. Nothing suggests an edge; the
relationship engine is Phase 23's.

### 7.2 `/studio/catalog/categories`

The seven D3 categories in priority order — `furniture · collectible-design · 3d-resin ·
wall-statement-art · preservation · decor · gifts`. Fields: `slug` · `name` · `subtitle` ·
`description` · `parent_id` · `sort_order` · `is_primary` · `hero_media_id` · `seo_title` ·
`seo_description` · status and verification. `sort_order` is also the store order — Phase 22 reuses
it rather than adding a second column.

**Guardrails.** `3d-resin` is seeded `OWNER_VERIFICATION_REQUIRED` because its description implies a
fabrication capability. Category descriptions are `EDITORIAL_COPY` and may carry no durability,
certification or performance claim.

### 7.3 `/studio/catalog/collections` and `/studio/catalog/collections/[collectionId]`

A collection is an exhibition, not a filtered grid (FEAT §8). The editor has five panels:

| Panel | Contents |
|---|---|
| Identity | `name` · `slug` · `sort_order` · `concept_state`, with an owner-only confirm control |
| Statement | `statement` · `statement_long` · `fact_classification` · `owner_verification` |
| Curation | A list writing `product_collections`, ordered with Move up / Move down (see below) |
| Related content | `RelatedContentPicker` over `entity_relations` |
| Exhibition page | Link into `/studio/content/pages/[pageId]`, plus "Create exhibition page from template" |

**Guardrails.** The ten FEAT §9 concept names may exist **only** as
`concept_state = 'DRAFT_COLLECTION_CONCEPT'`. `enforce_collection_publish_gate()` refuses
`status = 'PUBLISHED'` unless `concept_state = 'OWNER_CONFIRMED'`, and only an owner or admin may set
that. A concept collection cannot be featured in merchandising. Any collection still in
`DRAFT_COLLECTION_CONCEPT` carries a persistent notice reading it as a concept, not a product line.

**As built in Phase 16, with three departures worth knowing.**

*The confirm control is absent for a role that may not use it, not disabled.* A disabled confirm
button on a merchandiser's screen reads as "ask someone to enable this", when the decision is not
theirs to make at all. The Server Action re-checks `content.verify` regardless — the control is the
affordance, not the guard — and `enforce_collection_concept_authority()` refuses in the database
independently, admitting the same two roles.

*Reordering is Move up / Move down, not drag.* A drag handle needs a keyboard equivalent to be
operable at all (WCAG 2.1.1), so the buttons must exist whatever else is built; they are what works
with no JavaScript, announce correctly, and cannot lose an arrangement to a dropped pointer event.
The action takes "move this piece one place", so a pointer affordance can be layered over it later
without touching the write path. Every move renumbers the whole list, because `sort_order` has no
unique constraint and two equal values let the list reshuffle itself between requests.

*A piece is added by pasting a product id, not by search-as-you-type.* Phase 23 builds the picker.
A half-built search here would be the surface where an automatic suggestion first appears, which
FEAT §11 reserves for a person.

**Creating the exhibition page** inserts TEN bands, not eleven. FEAT §8's element 9, "Editorial
copy", maps to the `rich-text` block, which is declared and unbuilt — it renders nothing on the
public site — so inserting it would hand an editor a band indistinguishable from one they have not
filled in. Amendment A14 records it; `statement` carries editorial copy meanwhile. The template
writes no copy at all: ten empty bands in the right order is what a starting point is.

**The identity form is split across two screens, deliberately.** `name`, `slug`, `sort_order` and
the short `statement` are edited on the LIST screen, which is where a collection is created; the
detail screen owns `subtitle`, `statement_long` and the two media bindings. Neither form writes the
other's fields, so they cannot disagree about who owns one.

### 7.4 `/studio/catalog/materials`

Fields: `slug` · `name` · `family` (`resin · timber · metal · stone · finish`) · `description`.

**Guardrail.** `description` is `EDITORIAL_COPY`. **No durability, certification or performance claim
may be entered here** (D10). A material story is prose about a material, not a specification.

### 7.5 `/studio/catalog/relationships` — **BUILT, Phase 23**

The FEAT §10/§11 relationship workspace: a coverage panel, a piece picker, the selected piece's
edges, and a Suggestions panel with Accept / Dismiss.

**What shipped, and one thing that did not.** The picker is a list of links and the page is
server-rendered per piece, so a piece's relationships have a URL somebody can send to a colleague
and the suggestions are always computed from the database the editor is looking at. Every control
is a form posting to a Server Action; the page carries no client state at all. **Reordering exists
as an action (`reorderRelationsAction`) but not yet as a drag handle** — the ordering contract, the
audit row and the permission check are all in place, and what is missing is the pointer interaction,
which would be this workspace's first client island. Recorded here rather than implied, because
§7.5 previously described the drag as though it existed.

**Creating an edge by hand is still done on the product's own Related tab** (§7.1.2), where the
editor is already looking at the piece. A second create form here would be a second place for the
same act to go wrong.

Relation vocabulary (`check`-constrained on both relation tables): `RELATED_PRODUCT ·
PORTFOLIO_PROJECT · JOURNAL_ARTICLE · DESIGN_FAMILY · RESIN_STYLE · WOOD_SPECIES ·
CUSTOMIZATION_FORM · MATERIAL_STORY · DESIGN_DIRECTION`.

**Exactly four suggestion rules exist, all deterministic, none persisted until accepted:**

| Rule key | Rule |
|---|---|
| `same-collection` | Products sharing a published collection |
| `shared-materials` | Products sharing at least two `product_materials` rows |
| `journal-linked-product` | A published article whose body links to `/product/<slug>` |
| `project-featured-product` | A published project with an existing edge to the product; suggests the inverse |

**Guardrails.** Nothing is written until an editor accepts. Accepting writes `origin =
'RULE_ACCEPTED'` with the `rule_key`; dismissing writes a `relation_suppressions` row so the same
suggestion never returns; creating by hand writes `origin = 'EDITOR'`. Reciprocal types create the
inverse edge in the same transaction with a shared `paired_relation_id`, and deleting one deletes
both. **Explicitly not rules:** view-count affinity, price-band affinity, title similarity, image
similarity, and anything phrased "customers also viewed" — there are no customers.

`product_attribute_terms` (design families, resin styles, wood species) ships with **zero rows**. The
vocabulary is the owner's; a term surfaced publicly carries `OWNER_VERIFICATION_REQUIRED` until
verified — it is the column's DEFAULT here, not something an editor has to remember to set.

**The four rule reasons are seeded `global_content` rows**, not sentences compiled into the
software: what a rule claims to have observed is copy an editor may need to reword. Each suggestion
also shows its EVIDENCE — the collection's name, the two shared materials, the linked path — so an
editor can check the rule's working rather than trust it. A suggestion whose reason row has not been
seeded renders no sentence at all rather than its key.

**A piece with no connections is not a defect.** The coverage panel counts published pieces with no
hand-made edges and says so in a seeded sentence; those pieces render Phase 15's honest
"More in {Category}" fallback, which is a correct page. Phase 23 gives editors a way to replace that
fallback with real edges — it does not upgrade the fallback's label.

### 7.6 `/studio/catalog/customization-forms` and `/[formId]`

The bespoke configurator is data, not code (FEAT §15).

**Built in Phase 19, and the shape differs from the sentence this section used to carry — see
amendment A19.** The list shows every form with its step and question counts, because a row reading
"0 steps, 0 questions" is a form somebody created and left. The builder is **one collapsed column**,
not two panes: each step is a `<details>` carrying its own form, its questions and its ordering,
which keeps eleven steps navigable without splitting the sequence across half a screen.

Ordering is **a number per row and one save** — amendment A15·d, and here for a second reason:
`normalise_form_step_order()` renumbers positions and forces the contact step last whatever it is
given, so the sequence must be submitted whole. `cms_set_form_step_order` assigns every position in
one statement; ten dragged rows saved one at a time would be ten transactions racing that trigger.

Actions: *Create*, ***Duplicate from template*** (`cms_duplicate_customization_form()`, migration
`0184` — the whole copy in one transaction; the copy is a draft, is never the default for its kind,
and carries no seed identity), *Bind to product/category*, *Publish / Withdraw*, and a link to
`/custom-commissions`.

**There is no live preview pane**, and the omission is deliberate. The real `Configurator` writes a
draft to `sessionStorage` under a fixed key and mints upload credentials against the unauthenticated
`app/api/inquiries/upload-sign` — so a preview inside the Studio would overwrite a visitor's saved
brief in the same browser and spend the rate-limit allowance that endpoint's protection depends on.
The builder links to the public page instead, and says on screen that a form appears there once it
is published **and** the `commission_configurator` flag is on.

`validation` is **not editable in the builder**. Its allowlist CHECK admits nine Zod keys and no
pricing, and a free-text JSON box would be the only way to trip a constraint whose refusal names a
constraint rather than a field. The seeded templates set what they need.

Permissions: read `catalog.read`; build `catalog.write`; publish and withdraw `catalog.publish`;
delete a step or a question `destructive.execute`. **The contact step has no "shown to visitors"
checkbox at all** — `customization_form_steps_contact_enabled` refuses a disabled one at the column,
and a checkbox that always fails is worse than no checkbox because it looks like a setting.

Three templates ship (SEED §33–35): `FURNITURE`, `PRESERVATION`, `THREE_D_RESIN` — the last seeded
`OWNER_VERIFICATION_REQUIRED` until exact manufacturing options are defined.

| Level | Fields |
|---|---|
| Form | `slug` · `name` · `kind` (`FURNITURE · PRESERVATION · THREE_D_RESIN · CUSTOM`) · `description` · `intro_heading` · `intro_body` · `submit_label_key` · `is_default` |
| Step | `key` · `title` · `description` · `position` · `is_enabled` · `is_required` |
| Field | `key` · `label` · `help_text` · `placeholder` · `field_type` · `options jsonb` · `validation jsonb` · `is_enabled` · `is_required` · `position` · `include_in_whatsapp` |
| Binding | `product_customization_forms`: exactly one of `product_id` or `category_id`, never both |

Every field is enable/disable, require/optional, reorder and rename — SEED §33's contract exactly.
`validation` is Zod-shaped only: `min`, `max`, `maxLength`, `pattern`, `accept`, `maxFiles`,
`maxBytes`.

**Guardrail, and it is enforced by a test that greps the schema.** There is **no price, currency,
cost, multiplier or surcharge column anywhere in this group**. Bespoke pricing is never calculated
(FEAT §15). A configurator produces a brief; the conversation produces the price.

### 7.7 `/studio/catalog/bulk` — and the one bulk engine

See §7.8 for the engine. The page mounts the product operations: import, edit, publish, unpublish,
archive, category assignment, collection assignment, status change, tag assignment, material
assignment, media assignment (FEAT §20).

### 7.8 Bulk management and its confirmation requirements

**One engine.** `lib/bulk/` defines a `BulkOperation` contract — `kind`, `targetEntity`, a Zod
`paramsSchema`, `isDestructive`, a write-free `preview(selection, params)`, and
`applyItem(id, params, tx)` returning `{ before, after }`. Every surface registers operations; no
surface implements its own loop. `scripts/bulk/check-bulk-registry.mjs` fails the build if a
registered operation omits a preview, a schema or a destructive flag.

**Four steps, always: Select → Preview → Confirm → Apply.**

| Step | What happens |
|---|---|
| Select | `DataTable` row selection, or "select all matching filter" |
| Preview | Computed server-side with **no writes**; stored as a `bulk_operations` row with `status = 'PREVIEW'`, the exact `selection` id list, and a `confirmation_token`. Reports per row: will apply · will skip (and why) · will fail validation (and which rule) |
| Confirm | See the confirmation table below |
| Apply | Requires that exact token and re-reads `selection` from the row, so a stale tab cannot apply a preview built from a different filter |

**Confirmation requirements.**

| Class | Operations | Permission | Confirmation |
|---|---|---|---|
| Non-destructive | `product.publish` · `product.set_category` · `product.set_collections` · `product.set_materials` · `product.set_tags` · `product.assign_media` · `product.import` · media `tag` · non-breaking media `move` | `bulk.execute` | Preview + token; a single **Apply N rows** action |
| Destructive | `product.unpublish` · `product.archive` · `product.set_status` when it leaves `PUBLISHED` · media `archive` · media `move` that breaks a live reference · research bulk `reject` | `bulk.execute` **and** `destructive.execute` | `ConfirmDialog` in which the operator must **type the row count as digits** (for example `47`); the button stays disabled until it matches |
| Never available in bulk | Any hard delete · publishing a row that fails the readiness checklist · editing `rivya_asset_id`, `higgsfield_generation_id`, `is_ai_generated` or `is_concept` · importing straight to `PUBLISHED` | — | — |

**Undo.** Every applied item stores `before` and the row's `updated_at` at read time. Undo is
available for 24 hours (`undo_deadline_at`), re-applies each `before` in a transaction, and **skips
any row whose `updated_at` has changed since**, reporting those ids rather than overwriting a later
edit. Undo is itself an audited `bulk_operations` row with `undo_of_operation_id` set.

**Limits.** 500 rows per apply — a larger selection is refused in preview with the count. Application
runs in batches of 50, one transaction per batch, with `status = 'PARTIAL'` on partial failure,
because a 500-row publish failing on row 499 must not discard 498 good writes.

**Audit.** One `audit_logs` row per operation (`action = 'bulk.<kind>'`, counts in the summary, never
the full row set) and one `activity_events` row. Per-item before/after lives in
`bulk_operation_items` and is reachable from `/studio/operations/audit/[operationId]`.
`revoke delete` applies to both bulk tables: the record of what was done is not itself erasable.

**Bulk never hard-deletes anything.** Permanent deletion stays a single-row action on its own surface,
so a mis-click can destroy one row, never a page of them.

**The media immutability rule.** The 250 catalogued Higgsfield rows are operands of the media bulk
surface, and it must not be possible to launder a concept asset into a real one by selecting a page of
rows. The engine rejects any bulk write to `rivya_asset_id`, `higgsfield_generation_id`,
`is_ai_generated` or `is_concept`.

**The research bulk surface** is registered from Phase 24 with `available: false` and renders an
unavailable state naming Phase 29 until `research_products` exists. Phase 29 enables the five
operations against the same engine; it does not build a second one.

---

## 8. `/studio/merchandising/*` — curation

**What the group is for.** Deciding what appears where, and when, without touching the entities
themselves. Because the catalogue ships with zero published products, the more important half of this
group is what happens when a curated slot is empty. **Built in Phase 22.**

**Who can see it.** Read under `catalog.read` (every role); every write requires
`merchandising.write` (owner, admin, merchandiser). The two `page_sections` edits the homepage screen
also offers — the hero still and the Selected Works heading — need `content.write` (owner, admin,
editor); a merchandiser sees the current value and a note rather than a control that refuses.

**Eleven seeded slots, all empty at launch, each with exactly one surface and exactly one owning
screen** (migration `0200`; amendment A22 replaced the six-row draft of this table):

| Slot key | Surface | Entity types | Min | Fallback | Owning screen |
|---|---|---|---|---|---|
| `HOMEPAGE_SELECTED_WORKS` | `/` §10-04 | `PRODUCT` | 3 | `EDITORIAL_BLOCK` | `/studio/merchandising/homepage` |
| `HOMEPAGE_FEATURED_COLLECTIONS` | `/` §10-03 | `COLLECTION`, `CATEGORY` | 3 | `HIDE_SECTION` | `/studio/merchandising/featured` |
| `HOMEPAGE_JOURNAL_STRIP` | `/` §10-12 | `JOURNAL_ARTICLE` | 3 | `HIDE_SECTION` | `/studio/merchandising/homepage` |
| `STORE_FEATURED_ROW` | `/collection` | `PRODUCT`, `COLLECTION` | 3 | `HIDE_SECTION` | `/studio/merchandising/featured` |
| `CATEGORY_PINNED_<SLUG>` × 7 | `/collection/<slug>` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |

The seven keys are `CATEGORY_PINNED_FURNITURE`, `_COLLECTIBLE_DESIGN`, `_3D_RESIN`,
`_WALL_STATEMENT_ART`, `_PRESERVATION`, `_DECOR` and `_GIFTS` — the D3 slug upper-cased with `-`
replaced by `_` — and a category added later gets its slot from the same rule, by trigger.
`HOMEPAGE_FEATURED_COLLECTIONS` is the only featured-collections slot in the schema; there is no
reusable slot without a surface.

**The slot editor** (one component, drawn once per slot on the screen that owns it):

- **Entries**, in the order the site shows them — pinned first, then position, then id — with the
  entity's name, type, status, window and pin; per row, *Move up* / *Move down* (a button pair,
  operable by keyboard, atomic in the database), *Pin* / *Unpin*, *Publish* / *Take down*, *Remove*,
  and a *Window and note* disclosure with *Opens at* / *Closes at* (UTC) and a note.
- **Add to this slot** — a select of the PUBLISHED entities of the types the slot admits, grouped by
  type. An unpublished entry renders nothing until it is published, and the note says so.
- **Settings** — minimum and maximum shown, *Top up automatically* with its rule written in words
  (the switch cannot move without one), the fallback mode, and the fallback section id.
- **What the public sees now** — the resolver's own answer, read with the public client: provenance
  (*Curated* · *Topped up by rule* · *Fallback*), the rule if one applied, and the cards in order.

| Route | What the operator can do | Writes |
|---|---|---|
| `/studio/merchandising/homepage` | Edit `HOMEPAGE_SELECTED_WORKS` and `HOMEPAGE_JOURNAL_STRIP`; see `HOMEPAGE_FEATURED_COLLECTIONS` read-only with a link to Featured; change the hero's desktop and mobile still and the Selected Works heading (`content.write`) | `merchandising_entries.*`, `merchandising_slots.{min_items, max_items, auto_fill, auto_fill_rule, fallback_mode, fallback_section_id}`; `page_sections.{media_desktop_id, media_mobile_id}` on the hero, `page_sections.heading` on the band |
| `/studio/merchandising/store` | Reorder the seven categories one place at a time, with the SEED §56 warning and *Restore recommended order*; edit each category's `CATEGORY_PINNED_*` slot beside it | `categories.sort_order` · the seven pinned slots |
| `/studio/merchandising/featured` | Curate `HOMEPAGE_FEATURED_COLLECTIONS` and `STORE_FEATURED_ROW` from published collections, categories and products; concept collections are absent with the reason inline | the two featured slots |
| `/studio/merchandising/scheduling` | A month table of live entries per slot per day (`?month=YYYY-MM`), with gaps (below minimum) and overflows (above maximum) marked and summarised, the windows that open or close that month, and a jump to the owning screen. Read-only by design | — |

**The resolution ladder** (`lib/cms/merchandising.ts`, once): live PUBLISHED entries inside their
window → targets re-checked as PUBLISHED → the curated list if it reaches the minimum (`CURATED`) →
a recency top-up if the slot's owner switched it on and named the rule (`RULE_FILLED`) → the
fallback mode (`FALLBACK`). There is no sixth step.

**Guardrails.**

- **An empty slot never renders a fabricated product card.** `EDITORIAL_BLOCK` renders the seeded
  SEED §27 sentence and tiles drawn from a section the slot names — by default the page's own
  material story — with no price, no *View Product* affordance and no product link; the only CTA a
  tile may carry targets `/large-format`, `/collection` or `/custom-commissions`. `HIDE_SECTION`
  removes the section, heading included; `SHOW_EMPTY_STATE` renders the sentence alone.
  `tests/unit/merchandising-resolve.test.ts` asserts the fallback output contains no product route
  and no price label.
- **A concept collection cannot be featured.** The picker withholds it with an inline explanation,
  and `guard_merchandising_entry()` refuses it at the row, so a direct server-action POST fails too.
- **No slot is edited from two places.** Every form posts the screen it was drawn on and the action
  refuses a slot whose `owning_studio_route` is another screen.
- **Store order warns, with the reason.** Moving Gifts or Décor above Furniture is refused once with
  the SEED §56 content-priority warning and a *Move anyway* control; the recommended SEED §13 order
  is restorable in one click. The order is `categories.sort_order`, which the mega menu and the
  catalogue already read.
- **No behavioural ordering exists.** "Popular", "trending" and "best selling" are not offered,
  because no analytics data exists and manufacturing one would be an invented business fact (FEAT
  §28). The only rule the top-up implements is recency, and `merchandising-register.test.ts` reads
  the resolver's source to keep it so.
- **The resolver re-filters targets to published rows**, so an entry pointing at an unpublished
  product renders nothing rather than a broken card — and the preview on each editor is the same
  resolver's answer.
- **Windows are honoured on every read** (`isLive`, the rule `page_sections` uses, and the generated
  RLS clause). `app/api/cron/content-schedule/route.ts` gained the merchandising pass
  (`merch_run_schedule()`), which records each transition in `activity_events`, archives an entry
  whose window closed, and revalidates the affected paths. A scheduled change and a manual one look
  identical on the site.
- **Every write is audited and in the activity feed**, and the public surface the slot appears on
  is revalidated immediately.

---

## 9. `/studio/content/*` — the website

**What the group is for.** Every public sentence and every public image placement. This is the group
that makes SEED §1 true: an editor changes a headline without a deploy.

**Who can see it.** `content.read` — every role. Writes need `content.write` (owner, admin, editor);
publication needs `content.publish`.

### 9.1 The block model

A page is an ordered list of typed blocks. `page_sections.block_type` selects a renderer from
`lib/cms/registry.ts`, 1:1 with `components/sections/**`. Every block carries the SEED §5 field set:

| Field | Column |
|---|---|
| Eyebrow · heading · highlighted fragment · body · supporting copy | `eyebrow` · `heading` · `heading_highlight` · `body` · `supporting` |
| Primary and secondary CTA | `cta_label` · `cta_url` · `cta_secondary_label` · `cta_secondary_url` |
| Desktop media · mobile media · alt override | `media_desktop_id` · `media_mobile_id` · `media_alt_override` |
| Visibility · order · theme · layout variant | `is_visible` · `position` · `theme` · `layout_variant` |
| Schedule | `publish_at` · `unpublish_at` |
| Governance | `status` · `owner_verification` · `fact_classification` · `field_classifications jsonb` |
| Block-specific | `payload jsonb`, Zod-validated by `content/blocks/<type>.ts` |

**Desktop and mobile are separate slots** (D6). One source is never cropped into both by the renderer.

### 9.2 The editorial workflow

Per SEED §52, every seeded page supports Edit · Preview · Save Draft · Publish · Unpublish · Reorder
Sections · Hide Section · Change Media · Change Mobile Media · Change CTA · Change SEO, plus
Publish At / Unpublish At where scheduling applies.

| From | To | Permission |
|---|---|---|
| `DRAFT` | `REVIEW`, `ARCHIVED` | `content.write` |
| `REVIEW` | `APPROVED`, `DRAFT`, `ARCHIVED` | `content.review` |
| `APPROVED` | `PUBLISHED`, `REVIEW`, `ARCHIVED` | `content.publish` |
| `PUBLISHED` | `ARCHIVED`, `DRAFT` (unpublish) | `content.publish` |
| `ARCHIVED` | `DRAFT` | `content.write` |

**Guardrails.**

- **The transition table is enforced twice** — in `lib/cms/publishing.ts` and by the
  `enforce_status_transition` trigger — so an API caller cannot skip `REVIEW`.
- **Owner verification blocks publication.** Publishing a section carrying
  `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` is refused, and the refusal **names the field**.
  The editor either removes the claim or an owner/admin sets `VERIFIED`.
- **Revisions are a database trigger, not application code.** `write_revision()` appends the full row
  snapshot to `content_revisions` on every insert and update of `pages`, `page_sections`,
  `navigation_items`, `global_content` and `faqs`. No write path can forget it. Restoring a revision
  is itself a revision, and re-runs `sync_media_usages` so a restore never loses a media binding.
- **Revalidation is a consequence of publishing, not a separate chore.** `publishing.ts` posts to
  `/api/revalidate`; the schedule cron uses the same path.
- **Preview renders unpublished content at the real public path**, through a signed token and
  `draftMode()`, for staff only.
- A path with no `PUBLISHED` page row resolves to `notFound()` — not an empty shell, not
  "Coming Soon" (SEED §55).

### 9.3 The leaves

| Route | What it is for | What the operator can do | Key tables |
|---|---|---|---|
| `/studio/content/pages` · `/[pageId]` | Every CMS page (about 20 at seed) | List, create, open the block editor with drag reorder, per-section status pill, media picker, revision drawer, preview button, "View on site", "preview at breakpoint" (1440 · 768 · 390) | `pages` · `page_sections` · `content_revisions` |
| `/studio/content/pages/global` | The reserved system page that edits reusable strings | Edit the CTA library, commerce and action labels, announcement bar, empty states, error copy, form copy, SEO defaults, social, newsletter and Studio helper text. **Not** the `WHATSAPP_TEMPLATE` or `CONTACT` groups — those are configuration and are edited at `/studio/system/settings` under `system.settings.write` (§13.8; SEED §21, §36) | `global_content` |
| `/studio/content/homepage` | The homepage, pinned into the same editor | Edit the thirteen seeded sections; reorder; hide; swap media | `pages` · `page_sections` |
| `/studio/content/portfolio` · `/[projectId]` | Delivered projects | List (with a permanent zero-row explanation, not an error state) and a two-field create. The editor opens with **Verification** — the panel naming every unmet gate — then **Identity** (title, subtitle, summary, type, location label, completion date, evidence note), **Client** (its own form: is-client-project, display name, consent state, consent reference), **Story page** (create the `PROJECT` page and its four starting bands, or open the block editor), **Gallery** (`portfolio_project_media`: role, caption, per-item alt override, order) and **Related** (`entity_relations`). Publish and unpublish sit under the verification panel | `portfolio_projects` · `portfolio_project_media` · `entity_relations` · `pages` |
| `/studio/content/testimonials` | Quotes, with the same consent discipline | Record a quote; per-row edit, consent, verification and publish — four forms, three permissions | `testimonials` |
| `/studio/content/journal` · `/[articleId]` | Editorial | List (title, category, **body written or empty**, appears-on, status) and a create form taking a title, an address and a category. The editor carries **Publishing** first (verification, then publish with a date), then **Identity** (title, standfirst, card line, angle, category), **Byline**, **Body** (create the `ARTICLE` page, then open the block editor), **Cover** (desktop and mobile, separate slots) and **Related** | `journal_articles` · `journal_categories` · `entity_relations` · `pages` |
| `/studio/content/journal/categories` | The nine SEED §19 subjects | Rename, reorder, write an intro and a description. The address is shown and cannot change. No create, no delete | `journal_categories` |
| `/studio/content/faqs` | The ten seeded FAQ entries | Edit question, answer, category, position; add and archive | `faqs` |
| `/studio/content/navigation` | Header, mobile and category menus | Edit label, href, order, visibility, target, nesting; a resolved-URL preview shows whether an href actually resolves before publishing | `navigation_items` (`menu in ('HEADER','MOBILE','CATEGORY')`) |
| `/studio/content/footer` | Footer columns and links | As navigation | `navigation_items` (`menu = 'FOOTER'`) |
| `/studio/content/seo` | Seven tabs: Global · Pages · Entities · Keywords · Structured Data · Redirects · Coverage | Edit the SEED §41/§44 defaults, per-path and per-entity metadata, keyword themes, structured-data gates, redirects with chain warnings, and read the coverage report. Every tab shows the resolution level, so an editor knows whether they are reading their own words or a default | `seo_entries` · `seo_keyword_themes` · `seo_redirects` |

**Content guardrails specific to this group.**

- **Portfolio and testimonials ship with zero rows.** SEED §17, §28 and D10 are explicit: an empty
  portfolio shows the seeded empty state — *The project archive is being prepared.* — never a
  fabricated client project. `portfolio_projects.owner_verification` defaults to
  `OWNER_VERIFICATION_REQUIRED`, deliberately inverted from every other table.
- **`enforce_project_evidence_gate()` and `enforce_testimonial_evidence_gate()`** — two functions,
  one per table, because the two tables name a person through different columns and a shared plpgsql
  function would fail at runtime on the first write to whichever table it was not written for
  (`DATA_MODEL.md` §8.12). Publishing either requires `owner_verification = 'VERIFIED'`, and a row
  naming a person or client additionally requires that person's consent recorded as `GRANTED`.
  `WITHDRAWN` consent forces the row back to `ARCHIVED` **on the same statement** — it is not a
  refusal to be worked around, and it does not wait for anyone to unpublish.
- **The Studio names the unmet gate before Publish is pressed.** `OwnerVerificationPanel` reads
  `lib/portfolio/gates.ts`, a pure mirror of both triggers that `tests/unit/rls/phase17.test.ts`
  holds to agreement with them. It also says which gates only an owner or admin can clear, because
  "you cannot publish this" and "you cannot publish this and you are not the person who can fix it"
  are different messages. A publish attempt that fails a gate is refused server-side and writes a
  `DENIED` audit row — the attempt is the interesting event.
- **Recording a consent as `GRANTED` needs `content.verify` AND a reference.** `content.verify` is
  owner and admin only. The reference answers "where is this held" — an email, a message thread, a
  signed note — and without it `GRANTED` is an assertion with nothing behind it. The recorded-at and
  recorded-by stamps come from the session, never from the form, and move only when the decision
  itself changes.
- **The consent controls are NOT disabled when the is-client-project toggle is off**, which diverges
  from the phase document deliberately. A disabled control posts nothing, and reading an absent
  `client_consent` as `NOT_APPLICABLE` would erase a recorded consent — its date and its recorder
  with it — by unticking a checkbox. The action reads an absent field as "unchanged"; the controls
  stay legible.
- **A concept render can never enter a project gallery.** The picker does not offer one, the action
  names the rule if somebody posts one anyway, and `reject_concept_project_media` refuses it in the
  database. Three copies, all wanted: the picker cannot stop a `curl`, and the trigger cannot
  explain itself.
- **`evidence_note` is edited on the project screen and rendered nowhere public.** `0152` revokes it
  from `anon` at the grant, so it is unreadable to a visitor even through a crafted request — not
  merely unrendered.
- **The gallery is ordered by a number an editor types, not by dragging** (amendment A15·d). A
  drag-only reorder is unreachable by keyboard and by screen reader and does not work with
  JavaScript off, which every other Studio form does.
- **A journal article cannot be published without a body.** `enforce_article_has_body` refuses
  PUBLISHED unless the article has a linked page carrying at least one visible section, naming the
  article rather than a constraint. That is why the list has a Body column: an empty body is the
  blocker an editor will meet, and it is worth seeing before opening the article.
- **Publishing takes a date, and the date IS the schedule.** The public read is gated on
  `published_at <= now()`, so publishing with tomorrow's date puts the piece live tomorrow and an
  empty field publishes it now. There is no separate schedule button because there is no separate
  act. There is no `unpublish_at` either: `journal_articles` has no such column, and taking an
  article down is a button somebody presses.
- **Typing a person into the byline raises an owner-verification requirement**, and clearing it back
  to the studio's own name lowers the one it raised — never a confirmation somebody gave for another
  reason. A named human byline asserts who works at Rivya, which is a business fact.
- **`reading_minutes` is shown and cannot be edited.** A trigger derives it from the article's own
  blocks at 200 words per minute on every write, so a field would be a box whose value is discarded.
- **A category's address cannot change; its name can.** The slug is a public URL, and moving one
  needs a redirect row, which is Phase 39. The Studio shows the address and refuses a change with a
  sentence rather than hiding the field — a field that accepts a value and ignores it is worse than
  one that says no. There is no create and no delete: SEED §19 fixes the nine, a tenth needs a seed
  record so every environment has it, and deleting one orphans every article filed under it.
- **The ten seeded journal articles have no body.** They carry an `angle_note` and `status = 'DRAFT'`;
  two are `OWNER_VERIFICATION_REQUIRED` because they touch fabrication capability and preservation
  performance. `reading_minutes` is computed on save, never typed.
- **Two of the ten seeded FAQs are `OWNER_VERIFICATION_REQUIRED`** — custom sizing and one-of-one work
  — and cannot be published until the owner confirms the capability.
- **`seo_keyword_themes` has no numeric metric column.** There is deliberately nowhere to store a
  fabricated search volume or difficulty.
- **The seed never overwrites an owner edit.** `set_owner_edited()` sets `owner_edited = true` whenever
  `updated_by` is non-null; `npm run seed:content` skips those rows and lists their `seed_key` in the
  run report. It never deletes a row and never changes `status` on an existing one.

---

## 10. `/studio/media/*` — the media manager

**What the group is for.** One governed way to store, describe and deliver every non-code asset.
Cloudinary is the origin; the `media_assets` row is the meaning. The six FEAT §13 sections are one
table discriminated by `kind`, so an asset never has to be re-uploaded to change category.

**Who can see it.** `media.read` — every role. Upload and edit need `media.write` (owner, admin,
editor, merchandiser). **Deletion needs `media.delete` (owner, admin only).**

| Route | Filter | Notes |
|---|---|---|
| `/studio/media/all` | none | Carries the bulk selection toolbar, the crop editor and the alt-text queue |
| `/studio/media/images` | `kind = 'IMAGE'` | |
| `/studio/media/videos` | `kind = 'VIDEO'` | Poster required or derived |
| `/studio/media/models` | `kind = 'MODEL_3D'` | §10.3 |
| `/studio/media/documents` | `kind = 'DOCUMENT'` | Care guides, spec sheets |
| `/studio/media/higgsfield` | `source = 'HIGGSFIELD'` | §10.2 |
| `/studio/media/brand` | `kind = 'BRAND'` | Logo, wordmark, favicon, OG defaults |

### 10.1 The asset drawer

| Group | Fields |
|---|---|
| Identity | `rivya_asset_id` (authoritative — the filename is not) · `public_id` · `folder` · `filename` · `kind` · `source` · `resource_type` |
| Descriptive | `alt_text` **(required)** · `title` · `caption` · `tags text[]` · `subject_tags text[]` |
| Technical | `mime_type` · `bytes` · `width` · `height` · `aspect_ratio` · `duration_s` · `poster_public_id` · `checksum` |
| Governance | `is_ai_generated` · `is_concept` · `is_decorative` · `status` · `owner_verification` · `uploaded_by` |
| Crops | `media_crops`: one row per aspect ratio, from D6's eight — 21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16 |
| Usage | The `media_usages` list: which slot, on which entity, in which role (`DESKTOP · MOBILE · POSTER · THUMBNAIL · GALLERY · OG`) |

**Guardrails.**

- **Alt text is mandatory** unless the asset is explicitly marked decorative — a database check, not a
  form hint. The uploader cannot save without it, and meaningless alt text ("image 1", "hero",
  "photo") is a review failure (SEED §43).
- **Deletion is blocked while any `media_usages` row references the asset.** The drawer shows the
  usages before offering delete, and delete sits behind `ConfirmDialog` and `media.delete`.
- **Uploads are signed server-side.** The browser never sees `CLOUDINARY_API_SECRET`.
  `POST /api/media/sign` enforces session, `media.write`, the folder allowlist in
  `lib/media/folders.ts`, a MIME allowlist and byte ceilings (25 MB image · 200 MB video · 50 MB
  model), and is rate-limited per user.
- **Only the eight D6 ratios are crop targets.** Any other ratio throws.
- **Delivery is capped at 2560 px** even though manifest sources reach 6336 px wide.
- Naming follows `<page>-<section>-<variant>.<ext>`, but **the Rivya asset ID is authoritative, not the
  filename**.

### 10.2 `/studio/media/higgsfield` — the Higgsfield tracker

**What it is for.** Making the 250 already-generated AI assets legible, editable and *reusable* — the
third rung of the D6 asset-priority ladder — so that no phase regenerates something that already
exists.

The manifest at `data/higgsfield/asset-manifest.json` (`manifest_version: rivya-hf-v1`) is read-only
input: 250 assets, 224 images and 26 videos, across 24 families and 11 pages. Runtime state lives in
`media_assets`; migration progress lives in `data/higgsfield/migration-log.json`.

**Three tabs, plus two added in Phase 43.**

| Tab | Contents |
|---|---|
| **Inventory** | `DataTable` with the FEAT §34 columns, filterable by family, page, aspect ratio, migration status and used/unused |
| **Families** | The 24 families with counts, image/video split and available ratios |
| **Gaps** | `computeGaps()` output — every declared CMS slot with no asset behind it — grouped by page, with a *Copy brief to master plan* action |
| **Coverage** (43) | Every slot, its disposition, its bound asset, its ratio and its resolution fit |
| **Concept Placement** (43) | Every concept asset currently bound to a published slot |

**Inventory columns and where each value comes from:**

| Column | Source |
|---|---|
| Asset ID | `media_assets.rivya_asset_id` (manifest `rivya_asset_id`) |
| Type | `kind` / `resource_type` (manifest `type`) |
| Family | `tags` (manifest `family`) |
| Page · Section | `tags` as `page:<page>` / `section:<section>` |
| Purpose | Editor-entered `title` / `caption` |
| Source | `media_source` — `HIGGSFIELD` for all 250 |
| Higgsfield model | `higgsfield_model` |
| Prompt | `higgsfield_prompt`, truncated in the table, full in the drawer |
| Status | `content_status` · `owner_verification` |
| Used? | Derived from `media_usages` |
| Cloudinary location | `folder` + `public_id` |
| CMS placement | The `media_usages` context list |

**Guardrails, and these are the ones that matter most in the whole media group.**

- **There is no regeneration control anywhere in the tracker, or anywhere in the Studio.** Regenerating
  an asset already present in the manifest violates the asset-priority rule (D6, FEAT §33, manifest
  `policy.rules[4]`). `scripts/media/assert-no-regeneration.ts` runs in CI over
  `HIGGSFIELD_MASTER_ASSET_PLAN.md` and fails if any brief targets an existing manifest asset.
- **Every view carries the banner:** *"Concept media. Never presented as completed, delivered Rivya
  work."* (manifest `policy.rules[0]`, SEED §40.)
- **All 250 rows carry `is_ai_generated = true` and `is_concept = true`**, so the concept-media trigger
  keeps every one of them out of `product_media`.
- **All 250 land `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`** with `alt_text` imported from
  the manifest's `alt_text_draft`. Draft alt text reads like a prompt; an editor rewrites it before the
  slot using it is published. The Gaps tab counts unreviewed alt text.
- **Identity is `rivya_asset_id`, unique across all 250 rows** (D6 — the Rivya asset ID is
  authoritative, not the filename; amendment A1 exists to keep that namespace collision-free) — **and
  the migration key is `higgsfield_generation_id`**, also unique across all 250 and stable across a
  manifest rebuild, which an ordinal is not. Both are enforced in the schema: `unique (rivya_asset_id)`
  and `unique (higgsfield_generation_id) where higgsfield_generation_id is not null`
  (`DATA_MODEL.md` · `media_assets` · *Keys and indexes*). The Cloudinary delivery index is
  `(provider, resource_type, public_id)` rather than `unique (public_id)` because Cloudinary
  namespaces public IDs by resource type — `image/upload/<id>` and `video/upload/<id>` are different
  objects — so the wider key describes Cloudinary's model and keeps a future poster/clip pair uploaded
  under one name insertable without a migration. It is defence in depth, **not** a workaround for a
  duplicate: all 250 `cloudinary_public_id` values in the current manifest are distinct, so a plain
  unique index would hold today as well.
- **The manifest is never rewritten by the Studio.** It is rebuilt only by
  `scripts/media/build-higgsfield-manifest.py`, and a phase that changes it byte-for-byte has broken
  its own exit criteria.
- **Assets are not seeded `PUBLISHED`.** They become publicly readable only when an editor publishes the
  section that uses them. (`DATA_MODEL.md` maps the manifest's `AVAILABLE_UNMIGRATED` to `DRAFT`;
  `PHASE-05-09.md` says `APPROVED`. The discrepancy is raised in §18 — either way, not `PUBLISHED`.)

**Known coverage gaps at migration**, derived from the manifest's own distributions, not assumed:
the homepage hero video and poster, the `/collection` landing hero, category media for `furniture`
and `collectible-design`, `/custom-commissions`, `/contact`, `/faq` and `/search`; and two thin
families — `largeformat-coffee` (1 asset) and `largeformat-monumental` (1 asset, 21:9 only, no 4:5
mobile variant). Well-covered by contrast: `process` (79), `about` (39), `wall-statement-art` (20),
`preservation` (19), `decor` (18), `3d-resin` (13), `gifts` (10), `journal` (24). **Portfolio has
atmosphere stills only and no project media, so the empty state stands.**

### 10.3 `/studio/media/models` — 3D model metadata

**What it is for.** Storing what the Phase 21 viewer needs, and refusing a model that would destroy
Core Web Vitals.

The FEAT §13 metadata field list, and the column each maps to:

| FEAT §13 field | Column | Notes |
|---|---|---|
| `id` | `id` | |
| `title` | `title` | |
| `asset_url` | `provider` + `resource_type` + `public_id` + `folder` | A URL is **built** by `MediaProvider`, never stored |
| `format` | `model_format` | `GLB` or `GLTF`; `not null` for `MODEL_3D` |
| `file_size` | `file_size_bytes` | |
| `poly_count` | `poly_count` | |
| `texture_count` | `texture_count` | |
| `thumbnail` | `model_thumbnail_id` | Self-reference into `media_assets` |
| `poster` | `model_poster_id` | Captured or uploaded; the static fallback |
| `associated_product` | `associated_product_id` | |
| `associated_project` | `associated_project_id` | |
| `status` | `status` | `content_status` |
| `uploaded_by` | `uploaded_by` | |
| `created_at` | `created_at` | |

Plus `viewer_settings jsonb` (camera, lighting preset, environment preset, orbit limits — edited with a
live preview) and `model_variant_labels` (`variant_key` → human `label`, optionally linked to a
`materials` row so the variant switcher shows words rather than mesh names).

**What the operator can do.** Upload through the inspector, which parses the file and shows rejections
and warnings *before* save; the metadata block is populated from the parse rather than typed. Capture
or upload a poster. Edit `viewer_settings` with a live preview. Label variants. Associate the model
with a product or a project.

**Guardrails.**

- `check (kind <> 'MODEL_3D' or model_format is not null)` — a model row without a format is
  unstorable.
- A model is never loaded on the initial page render. `three`, `@react-three/fiber` and `drei` are
  reachable only through a dynamically imported mount behind an explicit intent gate; a `three` chunk
  in the first document fails the performance test.
- A poster and a mobile fallback are required before the viewer is enabled on a product.
- Attaching a `material_id` to a variant links to an existing `materials` row; **it never invents a
  specification**.
- The 3D viewer as a whole sits behind the `three_d_viewer` feature flag.

**Built in Phase 21**, with five differences from the sentences above, each a decision:

- **Posters are chosen, not captured.** The phase document names a "poster capture action"; the
  built surface offers the image library instead (`MediaPicker` over `IMAGE` assets). A frame
  captured from the viewer is a rendering of a model presented as a photograph — the claim BR-E3
  exists to prevent — and `guard_model_still_references()` refuses anything but an `IMAGE` asset as
  a poster or thumbnail in any case. The owner supplies a photograph of the object that exists.
- **"A mobile fallback" is the poster.** There is no second asset to require: below 768 px the
  poster is the whole experience until a tap, and the viewer then opens fullscreen. The one thing
  the constraint requires before a model can be shown anywhere is the poster
  (`media_assets_model_poster_before_association`), and the drawer says so.
- **The metadata block has no inputs.** Format, size, triangles and textures are read from the
  file by the inspector — in the browser before the signature (`quickInspect`) and on the server
  from the uploaded bytes (`inspectModel`) — and written by `saveModelAction`. *Re-inspect from the
  file* is the only way the block changes. A refused file is destroyed at the provider and gets no
  row; the reasons come back in words (`studio.models.reject.*`).
- **Association is one transaction.** *Shown on* calls `set_model_association()`, which writes the
  asset side and `products.model_media_id` together under the caller's own row policies: an editor
  holds `media.write` but not `catalog.write`, so attaching to a product fails as a whole for that
  role, and the action says so before the round trip. A project association needs `media.write`
  alone.
- **Marking a finish label VERIFIED is the owner's and admin's.** The drawer disables the option for
  every other role, the action refuses it with a `DENIED` audit row, and the Phase 08 authority
  trigger refuses it underneath both. A label that names a material cannot be *Not required*: the
  form lifts it to *Awaiting the owner* the moment a material is chosen, mirroring the CHECK.

The list (`ModelTable`) shows what the inspector read, whether a poster is set, and where the
model is shown; *Inspect* opens the drawer through `?asset=<id>`, so the page is one server render
with no client fetch. The drawer's *Preview* is the public viewer itself, imported dynamically here
as it is on the site, reloaded with each settings change.

---

## 11. `/studio/inquiries/*` — the conversion inbox

**Built in Phase 20**, with four differences from the sentences below and one from the phase
document; all five are recorded in amendment A20 or here.

- **The detail route is `/studio/inquiries/all/[inquiryId]`**, not `/studio/inquiries/[inquiryId]`.
  D4 names five leaves under `/studio/inquiries` and no leaf of that name, and the navigation test's
  exemption is deliberately "a dynamic segment must sit directly beneath a route the manifest
  NAMES" — the rule that stops an ungoverned surface being added by putting brackets in its name.
  `all` is the view that contains every enquiry, so it is the honest parent.
- **The export control appears on `/all` only.** It exports every enquiry rather than the filtered
  set, and an *Export as CSV* button on the Commission view that quietly included product enquiries
  would be a lie about what it did.
- **Assignment is a user id typed in, not a picker.** `staff_profiles` is readable only under
  `users.read`, which a merchandiser does not hold — a picker showing nothing to the person most
  likely to use it is worse than a field they can paste into.
- **`VIEWED` is a declared event kind that Phase 20 never writes.** Writing a row on every page
  render is how an audit trail becomes noise, and a GET with a side effect is a GET that cannot be
  retried. Opening an enquiry records nothing; moving it to `READ` records a `STATUS_CHANGED`.
- **There is no `global_content` group `CONTACT`.** SEED §21's four contact facts already live in
  one `contact-details` section, which the footer and `/contact` both read; a second home would be
  the failure §21's own sentence warns about. See amendment A20.

**What the group is for.** Every enquiry the website produces, in one place, with a pipeline. This is
where the funnel ends; there is no next table.

**Who can see it.** `inquiries.read` (owner, admin, editor, merchandiser, viewer). Pipeline changes,
notes and assignment need `inquiries.write` (owner, admin, merchandiser). Export needs
`inquiries.export` (owner, admin, merchandiser).

**The five D4 queues** are one shared component with a `kind` filter:

| Route | `inquiry_kind` |
|---|---|
| `/studio/inquiries/all` | every kind, including `GENERAL` from the contact form |
| `/studio/inquiries/product` | `PRODUCT` |
| `/studio/inquiries/commission` | `COMMISSION` |
| `/studio/inquiries/consultation` | `CONSULTATION` |
| `/studio/inquiries/quote` | `QUOTE` |

`GENERAL` has no queue of its own — it is the contact-form kind and surfaces under *All*.

**List columns.** Reference code · kind · name · city · product or form · pipeline status · WhatsApp
state · received · assignee.

**Detail — `/studio/inquiries/[inquiryId]`.** The full answer set rendered against the form definition
that produced it, attachments with previews, the event timeline, a pipeline control, an internal note
field, assignment, and **Open in WhatsApp**, which re-renders the same seeded template for staff use.

| Field group | Columns |
|---|---|
| Identity | `reference_code` (`RIV-<yyyy>-<6-digit sequence>`) · `kind` · `source_path` · `created_at` |
| Contact | `name` · `phone` · `email` · `city` · `consent_contact` |
| Content | `message` · `answers jsonb` · `enquiry_type` · `inquiry_attachments` |
| Links | `product_id` · `collection_id` · `customization_form_id` |
| Pipeline | `pipeline_status` (`NEW · READ · IN_CONVERSATION · QUOTED · WON · LOST · SPAM · ARCHIVED`) · `assigned_to` |
| Handoff | `whatsapp_state` (`NOT_SENT · REDIRECTED · SHORTENED · UNAVAILABLE`) · `whatsapp_shortened_at_level` |
| Internal | `referrer` · `utm` · `ip_hash` (salted) · `user_agent` |
| History | `inquiry_events` — `CREATED · WHATSAPP_REDIRECT · VIEWED · STATUS_CHANGED · NOTE_ADDED · ASSIGNED · EXPORTED` |

**Guardrails.**

- **Persist, then redirect. Never the reverse.** `buildHandoffUrl` takes a required, non-optional
  `inquiryId`, so a WhatsApp URL does not type-check before the insert. A failed save shows *Your
  enquiry could not be saved. Please try again before continuing to WhatsApp.* and the browser does not
  navigate (SEED §49).
- **The public may insert an enquiry and may never read one.** `anon` has `insert` only, with a
  `with check` pinning `pipeline_status = 'NEW'`, `assigned_to is null` and `updated_by is null`. There
  is **no `anon` select policy at all**.
- **`inquiry_events` is append-only** and never updatable. Every status change writes an event row and
  an `activity_events` row.
- **Storage minimisation is a design constraint.** No raw IP (salted `ip_hash` only), no cookies beyond
  the session, no fingerprinting, no third-party captcha. Spam control is a honeypot field, a 3-second
  minimum time-to-submit, and a per-IP cap of **five submissions per ten minutes** (BR-B5;
  `SECURITY.md` §8, keyed on `ip_hash` + form fingerprint). A rate-limited request returns `429` with
  `Retry-After` and renders seeded copy, never a raw status page.
- **Export omits `ip_hash` and `user_agent` always**, and omits free-text message bodies unless the
  operator ticks an explicit box — and that tick is itself recorded in the audit row along with the
  exported field list.
- **`Place Order` is a label, not a transaction.** It resolves to this flow like every other conversion
  control, and no order, cart or payment table exists to receive it.
- **The WhatsApp templates are content, not code.** SEED §36 and §37 live in `global_content` group
  `WHATSAPP_TEMPLATE` and are edited at `/studio/system/settings`. Tokens are an allowlist; an unknown
  token renders as an empty line, never as `{{token}}`. Internal columns never enter the message.
- **Graceful shortening keeps the reference code.** A 1,800-character budget and a five-step ladder —
  drop empty lines, cap the customization summary at eight items, truncate notes to 300 characters,
  replace reference URLs with a count, then fall back to the short form. `{{inquiry_id}}` is never
  dropped at any level; it is what lets the owner find the full brief in Studio.
- **If no WhatsApp number resolves**, the enquiry still persists, `whatsapp_state = 'UNAVAILABLE'`, and
  the success state shows the saved reference code and the seeded contact details instead of a dead
  link.
- A `owner`-only **Data request** action on `/studio/inquiries/all` exports or erases one enquirer's
  records. Retention for `inquiries` is an owner decision, not an engineering default —
  **OWNER_VERIFICATION_REQUIRED**.

---

## 12. `/studio/research/*` — the research workspace

**What the group is for.** Competitive and market research: discovering what other makers publish,
tracking how it changes, and turning that into internal direction. It is an intelligence workspace,
not a sourcing pipeline.

**Who can see it.** `research.read` (owner, admin, merchandiser, researcher, viewer). Configuration and
run control need `research.write` (owner, admin, researcher). Dispositions and confirmation need
`research.confirm` (owner, admin, merchandiser). **Editors have no research access at all.**

### 12.1 The three rules that govern the whole group

1. **Isolation.** Every table carries the `research_` prefix and **no `anon` policy is ever created on
   any of them**. Nothing from research reaches a public route, sitemap, feed, JSON-LD block, social
   image or public search result. `check-research-isolation.mjs` fails the build if a policy is added,
   and `check-data-layer.mjs` fails if a `research_` identifier appears under `app/(site)/**`.
2. **Rejection is not a stage.** `stage` records how far a row got —
   `RAW → NORMALIZED → VALIDATED → MATCHED → REVIEW → SHORTLISTED → CONFIRMED` (FEAT §23, verbatim).
   `disposition` records what was decided — `NONE · IGNORED · REJECTED · DUPLICATE`. A row rejected at
   `SHORTLISTED` keeps its stage and gains a disposition with a reason.
3. **`CONFIRMED` means "confirmed as a research reference".** It creates no product, no draft product,
   no media row and no obligation. The only bridge to the catalogue is a human typing a product
   (§12.13).

### 12.2 `/studio/research/dashboard`

Source health tiles, unmapped-category count, run status, validation-issue and parse-failure tiles,
the daily change digest, the oldest undecided item, large-format and coverage tiles, and the
source-coverage panel. Every figure carries a coverage badge.

### 12.3 `/studio/research/sources`

One row per approved third-party site, with the twenty-three FEAT §26 fields: name, website, region,
currency, source type, analytics league, enabled, collection mode, category mapping, URL patterns,
extraction adapter, image extraction, price extraction, SKU extraction, attribute extraction, rate
limit, request delay, concurrency, scheduling, last run, health, policy review, notes.

The editor covers all of them plus a category-mapping editor, a URL-pattern editor with a tester, a
schedule editor and a policy-review panel.

**Guardrails.**

- **A source cannot be enabled until its policy review says `APPROVED`.** The database constraint is
  `check (is_enabled = false or policy_status = 'APPROVED')`, and only an owner or admin may set
  `APPROVED`, with `policy_reviewed_by`, `policy_reviewed_at` and `policy_notes`. **Whether a given
  site may lawfully be read at the configured rate is a legal and commercial judgement this repository
  cannot make. Approval is the owner's assertion — OWNER_VERIFICATION_REQUIRED.**
- **`research_image_extraction_mode` has no value that downloads an image.** `NONE · URL_ONLY ·
  URL_AND_DIMENSIONS`. A competitor image is never downloaded or re-hosted; `image_urls text[]` holds
  URLs only.
- Health is a derived view, never a stored column that can go stale.
- A schedule shorter than six hours is rejected by a check constraint.

### 12.4 `/studio/research/scrape` · `/jobs` · `/runs` · `/runs/[id]`

Start a run, manage standing job definitions (`DISCOVERY · DETAIL · REFRESH`), watch runs, and open a
run to see per-source adapter panels, error lists and the draft/snapshot drawer.

**Politeness is not optional, and it is not configurable downward.** `SCRAPER_USER_AGENT` names Rivya
and a contact URL; robots.txt is fetched and cached per host and a `Disallow` means the URL is never
fetched; a robots `Crawl-delay` is a **floor** on the source's configured delay, so a source set faster
than robots asks is slowed, never the reverse; `429`/`503` honour `Retry-After`; five consecutive
failures open a circuit breaker. The feature flag `research.enabled` and the per-source `is_enabled`
are both checked immediately before **every** fetch, not once per run.

**Never, at any rate:** authenticated or paywalled pages, pages behind a CAPTCHA, checkout or cart
flows, personal data of any kind, headless browsers, proxy rotation, IP cycling, cookie-jar forgery or
CAPTCHA solving. If a source requires any of those to read, the answer is that Rivya does not read it.

### 12.5 `/studio/research/explorer`

The corpus browser: filter, sort, saved views, the action bar and the enabled bulk toolbar. Also hosts
the normalization and validation outcomes per row.

### 12.6 `/studio/research/changes`

Field-by-field change detection between stored versions (FEAT §24). Each change carries `before`,
`after`, both version ids, the run id, the snapshot key of each side and `detected_at`, so a change
record can always be reproduced from evidence.

**Materiality is a stated rule, not a feeling** — `MATERIAL · MINOR · NOISE`, with per-field
thresholds editable per source in `/studio/system/settings`. `NOISE` changes are recorded but hidden by
default and never counted in the dashboard's "changed" figure.

**The nine FEAT §25 actions.** Eight of them mutate a disposition or a stage, and each writes a
`research_review_actions` row, an `audit_logs` row and, if a stage moves, a `research_pipeline_events`
row; all eight require `research.confirm`. **Compare is the exception** — it is read-only, requires only
`research.read`, and writes an `activity_events` row and nothing else. It has to be, or a `researcher`
holding `research.read` and `research.write` could open `/studio/research/compare` directly (§3, §12.8)
yet be refused the identical read-only view from this screen. The permission is stated per row rather
than assumed from the group.

| Action | Permission | Effect |
|---|---|---|
| Review | `research.confirm` | Acknowledges the change; stage moves `MATCHED → REVIEW` if lower |
| Ignore | `research.confirm` | `disposition = 'IGNORED'`; future changes on the field are collapsed under the reason |
| Shortlist | `research.confirm` | Stage → `SHORTLISTED` |
| Reject | `research.confirm` | `disposition = 'REJECTED'`; stage retained; a reason is required |
| Mark Duplicate | `research.confirm` | Sets `duplicate_of_id` and `disposition = 'DUPLICATE'`; requires choosing the surviving row |
| Confirm | `research.confirm` | Stage → `CONFIRMED`. **Creates no product, no draft product, no media row, no CMS content** |
| Add Note | `research.confirm` | Append-only; notes are never deleted, only superseded |
| Add Tag | `research.confirm` | From the `research_tags` vocabulary; free text is rejected |
| Compare | **`research.read`** | Opens up to four rows side by side, read-only; records nothing but an activity event |

**Guardrails.** Changes are **never automatically imported into Rivya products**, or into anything.
Change detection never moves a stage on its own — only a person does. `research_changes` is written by
the service role only: the system detects, a person decides.

### 12.7 `/studio/research/large-format`

The scale workspace. Ordered, editable classification rules (first match wins), `scale_band`
(`DINING · CONSOLE · COFFEE · SEATING · SIDE · MONUMENTAL · WALL · UNKNOWN`), a three-valued
`is_large_format` (true / false / not yet determined), and saved views. Rules are configuration, edited
at `/studio/system/settings`, not content.

### 12.8 `/studio/research/compare` · `/compare/[setId]`

Named comparison sets with four panels — Members, Assortment, Price architecture, Dimensions — each
headed by a `CoverageBadge`. **Cross-currency price comparison is refused**, because no rate source
exists and inventing one would fabricate a figure.

### 12.9 `/studio/research/similarity`

Perceptual image similarity over hashes, behind the `advanced_similarity` flag. Three regions: Run
(scope, method, flag state, and an explicit note when the flag is off), History, Results (clusters,
band legend, per-pair actions). The band legend — `NEAR_DUPLICATE · PROBABLE_VARIANT · WEAK ·
FORM_SIMILAR` — is rendered above the first result and is not collapsible. **Any precision figure must
be measured on this corpus, on a dated sample, before it is written down — OWNER_VERIFICATION_REQUIRED.**

### 12.10 `/studio/research/opportunities`

Three regions: the ranked table (default filter `state = 'SCORED'`, with an `INSUFFICIENT_DATA` tab
that is **visible, not hidden**), the explain drawer showing every component that produced a score, and
the model panel (owner/admin only) with versions, the diff and the activate action.

**Guardrails.** The active model version and the last computation date are rendered in the page header
on every load, so no score is ever read without its provenance. A scoring model is immutable once it
leaves `DRAFT` — changing a formula means publishing a new version, so a historical score stays
reproducible. A missing signal is excluded with a reason, **never imputed**.

### 12.11 `/studio/research/opportunities/direction` · `/[briefId]`

The product-direction workspace: nine prose sections on the left with per-section helper copy from
`global_content` group `STUDIO_HELP`, and an evidence rail with observed figures on the right. Approve
and Archive sit behind `ConfirmDialog`.

**Guardrails.** A brief's status vocabulary is `DRAFT · REVIEW · APPROVED · ARCHIVED`; **`PUBLISHED` is
unreachable by check constraint**, and a permanent banner reads that the brief is an internal research
document. Every evidence row requires a non-empty rationale. `APPROVED` means a named person agreed —
it is not a capability claim, and **whether Rivya can produce anything a brief describes is
OWNER_VERIFICATION_REQUIRED.**

### 12.12 `/studio/research/shortlist`

Open shortlist entries with score, confidence, age, tags and reason, plus the bulk bar. A non-empty
reason is enforced by a check constraint, and one open entry per research row is enforced by a partial
unique index.

### 12.13 `/studio/research/confirmed` — and the one bridge

Confirmed references with their decision note, confirming actor, linked brief, product-started state
and link, plus an archive action.

**The bridge dialog is the only place in the entire Studio where a research screen can create a
catalogue row.** It renders the seeded acknowledgement text above an **unticked** checkbox that the
submit button depends on, and it creates an empty `DRAFT` product for a human to fill — it copies no
competitor title, price, dimension, material, description or image. `research_confirmations.created_product_id`
deliberately carries **no foreign key**, so no query can join research to the catalogue, and only
`lib/supabase/repositories/research-*.ts` may resolve it.

### 12.14 `/studio/research/sheets`

One-way export definitions to Google Sheets: a definitions table (name, entity, tab, schedule, PII flag,
last run, status), the definition form, run history, and **Run now** · **Pause** · **Resume**. A banner
states the flag state, the destination spreadsheet id and the service-account email — all identifiers,
never a credential.

**Guardrails.** The integration is one-way: Rivya writes, the Sheet reads. Nothing is ever imported from
a spreadsheet. The private key inside `GOOGLE_SERVICE_ACCOUNT_JSON` never reaches a column, a log, an
error or a response. **That a Google Workspace account and a spreadsheet exist for Rivya, and that the
service account has been shared onto it, are OWNER_VERIFICATION_REQUIRED.**

---

## 13. `/studio/operations/*` and `/studio/system/*`

### 13.1 `/studio/operations/workflows`

**For.** One place to see every long-running job. **Creates no table** — a workflow run already exists
in five places, and a sixth table would be a copy that drifts. `workflow_runs_v` unions
`research_runs`, `sheets_sync_runs`, `content_seed_runs`, `higgsfield_migration_runs` and
`bulk_operations` into `kind · id · scope · status · started_at · finished_at`. Each row joins to its
log lines through `system_logs.workflow_run_id`. The view is `security invoker`, so each underlying
table's RLS still applies. Read requires `operations.logs.read`.

### 13.2 `/studio/operations/data-quality`

**For.** The FEAT §21 rules, on both sides of the wall. **Creates no table either.** First-party product
quality is *computed* by `lib/catalog/validation.ts` at read time — a stored issues table would go stale
the moment a product was edited — and the readiness checklist is `products.publication_readiness`, a
transparent list of booleans. The Research tab reads `research_validation_issues`, which *is* stored,
because it is attached to an immutable version. An issue is dismissible only with a reason.

### 13.3 `/studio/operations/imports` and `/exports`

**Imports.** CSV or TSV upload → column mapping → dry-run validation → per-row preview → apply. Every
imported product lands as `DRAFT` with `owner_verification` untouched, and **import can never publish**.
This is SEED §32's "approved import" path: the import is the approval step; publishing is a separate,
deliberate act. A row failing any FEAT §21 rule is reported with its row number and rule name and is not
applied. The uploaded file is not retained after apply; parsed rows are kept 30 days for post-hoc review.

**Exports.** CSV export of products, media and inquiries. Inquiry export requires `inquiries.export`, is
audited with the exact field set, and excludes free-text message bodies unless explicitly ticked.
Everything else that needs to reach a spreadsheet goes through a Sheets definition (§12.14) rather than a
second exporter.

### 13.4 `/studio/operations/audit`

`audit_logs`: who was allowed or refused to do what. Filterable by time, actor, action, entity and result
(`SUCCESS · DENIED · ERROR`). `/studio/operations/audit/[operationId]` opens the per-item before/after
viewer for a bulk operation.

**Guardrails.** Append-only — `revoke update, delete` for `anon` and `authenticated`. `before` and
`after` pass through `lib/logging/redact.ts` before the write. It **never** contains a secret value, a
raw visitor IP for a public form, a WhatsApp message body or inquiry free text. **Denials are recorded**,
which is how probing becomes visible. Read requires `operations.audit.read` (owner, admin).

### 13.5 `/studio/operations/logs`

`system_logs`: what the machine did and where it failed. Two orthogonal columns cover every FEAT §31
type — `level` (`INFO · WARNING · ERROR · SECURITY`) and `channel` (`WORKFLOW · SCRAPER · MEDIA ·
CONTENT · AUTH · SHEETS · ANALYTICS · SYSTEM`) — so "SCRAPER errors in the last hour" is one query.

Filters: time range, level, channel, actor, workflow run, research source, entity type and id, and free
text over `event`. The detail drawer renders `context` as redacted JSON. Export requires
`operations.logs.export`.

**Guardrails.** Append-only, with no update or delete policy for any application role. Every write passes
through the redactor. Repeated identical events inside a one-minute window increment `occurrence_count`
instead of inserting. Retention: `INFO`/`WARNING` 90 days, `ERROR`/`SECURITY` 400 days, purged by a daily
cron that logs its own summary. **Never contains** a secret, a raw visitor IP, a WhatsApp message body,
inquiry free text, a competitor page body or an unmapped upstream error message.

### 13.6 The three logs, so nobody merges them

| Log | Table | Written by | Read by | Answers |
|---|---|---|---|---|
| Audit | `audit_logs` | Every privileged mutation **and every denial** | owner, admin | Who was allowed or refused to do what |
| Activity | `activity_events` | Human Studio actions worth showing in a feed | Any staff member | What has been happening in the Studio |
| System | `system_logs` | Background jobs, integrations, cron, workflow runs | owner, admin | What the machine did and where it failed |

A CI check fails if `logSystem()` is called from a server action that also calls `writeAudit()` for the
same event name.

### 13.7 `/studio/system/users`

List staff, invite by email, change role, suspend and reactivate. Fields: `email` · `display_name` ·
`role` · `status` (`INVITED · ACTIVE · SUSPENDED`) · `last_seen_at` · `created_by`.

**Guardrails.** Every action is audited. A staff member may edit only their own display name. **The last
`owner` cannot be demoted or suspended** — enforced in the server action and by a statement trigger.
There is no route that creates a customer row, because there is no customer table. Public sign-up in the
Supabase project is a deployment checklist item, and the Environment page reports its state as a boolean.

### 13.8 `/studio/system/settings`

The operational settings that are configuration rather than page copy:

| Setting | Storage | Notes |
|---|---|---|
| Contact details — phone, WhatsApp number, email, location link | `global_content` group `CONTACT` | Seeded from the supplied business information and **OWNER_VERIFICATION_REQUIRED**. Not hardcoded in any component (SEED §21) |
| WhatsApp templates (product and commission) | `global_content` group `WHATSAPP_TEMPLATE` | SEED §36/§37, tokens included |
| `whatsapp.include_reference_urls` | `global_content` | Renders reference images as a count (default) or as full URLs |
| Relation vocabulary and attribute terms | `product_attribute_terms` | Owner's vocabulary; ships empty |
| Change-rule materiality thresholds | `research_change_rules` | Per source, with a global default row |
| Large-format scale rules | `research_large_format_rules` | Ordered; first match wins |

A `VERIFIED` `global_content` WhatsApp number overrides the `NEXT_PUBLIC_WHATSAPP_NUMBER` deployment
default.

### 13.9 `/studio/system/integrations`

**Creates no table.** It renders `sheets_export_definitions`, `feature_flags` and the reachability checks.
It shows identifiers — a spreadsheet id, a service-account email — and never a credential.

### 13.10 `/studio/system/environment`

**Read-only operational health, and it offers no "fix it" action.** Each check returns
`{ id, configured, status, latency_ms, checked_at, code }` where `status` is one of `OK · DEGRADED ·
UNREACHABLE · NOT_CONFIGURED · UNKNOWN` and `code` comes from a fixed enum, because an upstream error
message can quote a credentialed URL.

| Check | What it does |
|---|---|
| `supabase_db` | `select 1`, timed |
| `supabase_auth` | Session round-trip against the project URL |
| `cloudinary` | Signed ping of the account usage endpoint |
| `google_sheets` | Token mint only; no spreadsheet read |
| `vercel` | Reads the build-info module, not an API |
| `higgsfield` | Manifest presence, `manifest_version`, total 250, the 224/26 image-video split and the 24 families — from the file, **never by calling the Higgsfield API** |
| `migrations` | Applied count and latest version versus the files in `supabase/migrations/` |
| `build` | Commit SHA, branch, build time, environment |

Phase 41 adds a Security section: header presence, CSP mode, rate-limit configuration and the last
dependency-audit result — configuration state only.

**Guardrails.** `configured` is computed from the **presence of the variable name**, collapsed to a
boolean before it leaves the check — never from its content, and never as a length. **No value, prefix,
suffix, length or hash of any D8 server-only variable appears anywhere on this page**, proven by a
sentinel test that sets each variable to a unique value, renders every surface and fails on any
four-character fragment. The page carries a permanent line stating that it reports reachability only and
is not a functional test.

### 13.11 `/studio/system/documentation`

Ten documents, served from a **build-time allowlist**, redacted at build time, rendered without raw HTML:
`ARCHITECTURE.md` · `STUDIO_GUIDE.md` · `MEDIA_GUIDE.md` · `SCRAPER.md` · `DEPLOYMENT.md` ·
`ENVIRONMENT.md` · `BUSINESS_RULES.md` · `CONTENT_GUIDE.md` · `COMPONENT_REGISTRY.md` ·
`HIGGSFIELD_GUIDE.md` (FEAT §30).

**Guardrails.** A request names an **allowlist key**, not a path — there is no directory walk, no path
parameter reaching the filesystem and no `..` to defend against; an unknown key is `notFound()`. The
index is a build artefact, so the production runtime has no docs directory to traverse. Raw HTML and
scripts are escaped. Relative links are rewritten to in-app doc keys; links leaving the allowlist are
marked external and unclickable. **Never served:** `README.md`, `CLAUDE.md`, `SECURITY.md`,
`docs/SESSION-STATE.md`, `docs/requirements/**`, `.env*`, any migration, or any file containing an
environment value. The browser is read-only; the repository is the source.

### 13.12 `/studio/system/flags`

Key, description, state and a switch. Every flag defaults to `false` in every environment and is
evaluated **server-side**: a switched-off feature is not rendered, not hidden — its markup is absent
from the response, so no visitor can reach it by any means. FEAT §32 names nine flags eventually:
`three_d_viewer` · `experimental_webgl_hero` · `advanced_similarity` · `higgsfield_tracker` ·
`google_sheets` · `advanced_analytics` · `research.enabled` · `commission_configurator` ·
`newsletter`.

**Built in Phase 19.** The register lives in `lib/flags/flags.ts`, not in the table, so a flag key is
an identifier that breaks its call sites when removed. `feature_flags` holds only the flags somebody
has **touched** — absent is off — which makes a fresh database, a restored backup and a preview
branch behave identically with nothing seeded. Two keys are registered so far, each with a consumer:
`commission_configurator` (Phase 19 builds the form, Phase 20's exit criteria switch it on) and
`three_d_viewer` (Phase 21). A key nobody has registered cannot be switched: the action checks the
submitted key against the register, so a request cannot leave a row naming a feature that does not
exist.

The screen is **not a table**. Each row carries the paragraph explaining what the flag gates and
which phase has to ship before it can honestly be switched on — the sentence somebody needs before
moving a switch, and the one a table cell would truncate.

Readable under `studio.access`, which all six roles hold: the register is how anybody in the Studio
accounts for a surface that is missing, and a merchandiser who cannot find the configurator should
see that it is off rather than conclude the Studio is broken (open question 5, closed by amendment
A17). Writable under `system.flags.write` — owner and administrator. For a role without it the
switch is **absent, not disabled**: a greyed-out control reads as "ask somebody to enable this", and
the truth is that the decision is not theirs to make.

**A flag is not a substitute for configuration** — it turns a whole capability on or off, and
anything with a value belongs in settings or content.

---

## 14. Studio helper copy (SEED §40)

Helper messages are seeded content, not JSX strings: `global_content` group `STUDIO_HELP`, seed module
`content/seed/studio-help.ts`. They are editable at `/studio/content/pages/global`. Phase 05 renders
them from `components/studio/strings.ts` constants; **Phase 09 deletes those constants** and replaces
them with `global_content` lookups.

The five seeded messages, verbatim from SEED §40:

| Key | Surface | Copy |
|---|---|---|
| `studio_help.homepage_hero` | `/studio/content/homepage` → Hero | Keep the primary story focused on large-format furniture, collectible design or 3D + resin work. |
| `studio_help.homepage_selected_works` | `/studio/content/homepage` → Selected Works; `/studio/merchandising/homepage` | Choose only the pieces you want to feature publicly. Drag to reorder. |
| `studio_help.about` | `/studio/content/pages` → About | Keep factual manufacturing claims accurate and owner-verified. |
| `studio_help.higgsfield_asset` | `/studio/media/higgsfield`, the asset drawer | AI-generated concept media must not be presented as completed real Rivya work. |
| `studio_help.research_product` | `/studio/research/**`, every research row | Research reference only. Never publish competitor imagery or text as Rivya content. |

The same group also holds the Studio chrome copy quoted earlier — `studio_help.login_heading`,
`studio_help.login_body`, `studio_help.login_button`, `studio_help.dashboard_heading`,
`studio_help.dashboard_intro` — and the eight quick-action labels. Adding a helper string is a seed-module
row, never a code change.

**Rule.** Every Studio editor that touches a claim about the business carries a helper string, and the
per-section verification banner names the exact claim requiring owner sign-off.

---

## 15. The guardrail register

Every rule in this document that cannot be switched off from the Studio, in one place, with where it is
enforced.

| # | Guardrail | Enforced by |
|---|---|---|
| 1 | An `OWNER_VERIFICATION_REQUIRED` row cannot be published | `enforce_status_transition()` trigger + `lib/cms/publishing.ts` |
| 2 | The status transition table cannot be skipped | The same trigger + the same service |
| 3 | A concept asset cannot be attached to a product | `reject_concept_product_media()` trigger |
| 4 | An asset in use cannot be deleted | Delete trigger over `media_usages` |
| 5 | Alt text is mandatory unless the asset is decorative | `check` constraint on `media_assets` |
| 6 | A manifest asset can never be regenerated | No UI control; `assert-no-regeneration.ts` in CI |
| 7 | A quote-only product can never carry a price | `products_price_state_coherent` constraint |
| 8 | A collection cannot be published while it is a concept | `enforce_collection_publish_gate()` |
| 9 | A project or testimonial cannot be published without evidence and consent | `enforce_project_evidence_gate()` · `enforce_testimonial_evidence_gate()` — one per table |
| 10 | Bulk never hard-deletes | The engine has no delete operation; `revoke delete` on the bulk tables |
| 11 | A destructive bulk action requires a typed row count and `destructive.execute` | `ConfirmDestructive` + server-side permission check |
| 12 | Apply cannot widen the previewed selection | `confirmation_token` + `selection` re-read from the row |
| 13 | Undo never overwrites a later manual edit | `row_version_before` comparison; changed rows are skipped and reported |
| 14 | Import can never publish | Every imported row lands `DRAFT` |
| 15 | The public can insert an enquiry and never read one | RLS-INQUIRY: `anon` insert only, no select policy at all |
| 16 | No WhatsApp redirect without a persisted enquiry | `buildHandoffUrl` requires a non-optional `inquiryId` |
| 17 | Research never reaches a public surface | No `anon` policy on any `research_*` table; two CI checks |
| 18 | Research is never auto-imported | No code path; the only bridge is a human dialog with an unticked checkbox |
| 19 | A source cannot be scraped before policy approval | `check (is_enabled = false or policy_status = 'APPROVED')` |
| 20 | A competitor image is never downloaded or re-hosted | No extraction mode does it; images are URLs in `text[]` |
| 21 | No secret is displayed, logged or exported | `lib/logging/redact.ts` on every path + the sentinel test |
| 22 | The documentation browser cannot read the filesystem | Allowlist keys, build-time index |
| 23 | An unavailable metric must carry a reason | `check ((availability = 'UNAVAILABLE') = (unavailable_reason is not null))` |
| 24 | Audit, activity and system logs cannot be edited or deleted | `revoke update, delete`; no policy for any application role |
| 25 | The seed never overwrites an owner edit | `set_owner_edited()` + the content-hash rule |
| 26 | The last owner cannot be demoted or suspended | Server action + statement trigger |
| 27 | Bespoke pricing is never calculated | No price-shaped column exists in the customization schema; a unit test greps for one |

---

## 16. Owner runbooks

Short procedures for the routine tasks, written for someone who does not know what a migration is.
Each ends in the same place: a change that is live, audited and reversible.

| # | Task | Procedure |
|---|---|---|
| 1 | **Change a headline or a paragraph** | `/studio/content/pages` → choose the page → choose the section → edit → **Save Draft** → **Preview** → **Publish**. If Publish is refused, read the message: it names the field needing verification |
| 2 | **Swap any image or video** | Open the section → the media slot → **Choose asset** → pick from the library or upload → set alt text → **Save** → **Publish**. Set the mobile slot separately; it is not a crop of the desktop one |
| 3 | **Add a product** | `/studio/catalog/products` → **New** → fill Identity, Pricing, Dimensions, Media, Materials → watch the readiness checklist empty → **Publish** |
| 4 | **Change what the homepage features** | `/studio/merchandising/homepage` → drag to reorder, add or remove entries, set a window → **Save**. If the slot is empty, choose what the visitor sees instead: an editorial block, a hidden section, or the empty state |
| 5 | **Reorder the store categories** | `/studio/merchandising/store` → drag → **Save**. Heed the warning if Gifts or Décor rises above Furniture |
| 6 | **Schedule a journal article** | `/studio/content/journal` → the article → Publishing → set `publish_at` → **Approve** → the schedule cron publishes it and revalidates the page |
| 7 | **Answer an enquiry** | `/studio/inquiries/all` → open it → read the brief → **Open in WhatsApp** → move the pipeline status → add an internal note |
| 8 | **Change the WhatsApp number or message** | `/studio/system/settings` → Contact / WhatsApp → edit → **Save**. Live immediately; no publish step |
| 9 | **Invite a colleague** | `/studio/system/users` → **Invite** → email → set the role from §2.2 → they land as `INVITED` until they sign in |
| 10 | **Turn a feature on or off** | `/studio/system/flags` → toggle → **Save**. Immediate, server-side, audited |
| 11 | **Recover something archived by mistake** | If it was a bulk action within 24 hours: `/studio/operations/audit` → the operation → **Undo**. Otherwise: open the row, set `ARCHIVED → DRAFT`, and restore the revision you want from the revision drawer |
| 12 | **Check whether something is wrong** | `/studio/system/environment` → read the eight checks. Green means reachable, not correct. For detail: `/studio/operations/logs`, filtered by level and channel |
| 13 | **Ask for an engineer** | Send the route, the exact time, what you expected, what happened, and — from `/studio/operations/logs` — the `request_id`. That one identifier ties the audit row, the log line and the run together |

---

## 17. Statements in this document requiring owner verification

None of the following is asserted here as a fact. Each is a control the Studio exposes, whose truth only
the owner can establish.

| Statement | Where it appears | Why it is not a fact yet |
|---|---|---|
| The seeded contact phone, WhatsApp number, email and location are Rivya's | §13.8 | Real business identifiers; seeded `OWNER_VERIFICATION_REQUIRED` in `global_content` group `CONTACT` |
| A given third-party source may lawfully be read at the configured rate | §12.3 | A legal and commercial judgement this repository cannot make |
| A Google Workspace account and spreadsheet exist for Rivya to export into, and the service account is shared onto it | §12.14 | Operational facts only the owner can confirm |
| Rivya can produce anything a direction brief describes | §12.11 | Manufacturing capability is a business fact (D10) |
| A confirmed research row corresponds to a piece Rivya will make | §12.13 | Confirmation records a decision to explore, nothing more |
| Any measured similarity precision figure | §12.9 | Must be measured on this corpus, on a dated sample, before it is written down |
| Traffic analytics should be connected at all | §5.4 | Adding a provider is an owner decision with privacy consequences |
| A retention policy for `inquiries` | §11 | Customer data; a deletion policy is an owner decision, not an engineering default |
| The capability claims in the seeded FAQ, About, Large Format, Process and category copy | §9.3 | Seeded `OWNER_VERIFICATION_REQUIRED`; blocked from publication until confirmed |

---

## 18. Open questions for the canonical decisions

Raised, not acted on. Nothing above knowingly diverges from `CANONICAL-DECISIONS.md`.

1. **Permission spelling.** `PHASE-00-04.md`, `PHASE-10-15.md` and `PHASE-31-38.md` use
   `<domain>.<action>`; `PHASE-05-09.md` and `PHASE-16-22.md` use `<resource>:<action>`
   (`studio:access`, `content:publish`, `media:upload`, `inquiries:export`). This guide uses the dot
   form throughout, because Phase 04 owns `lib/auth/permissions.ts`. Suggested amendment: fix the
   spelling in D5 beside the role list and correct the disagreeing documents once.

2. **Five permissions are used by routes but absent from the Phase 04 matrix** — `studio.access`,
   `content.review`, `system.environment.read`, `system.docs.read`, `operations.logs.export` — and one
   more, `seo.write`, appears in `DATA_MODEL.md` against `seo_entries` without a matrix row. §2.3
   proposes holders for each. The matrix is code; it needs the six rows before Phase 05 ships.

3. **Navigation visibility versus the permission matrix.** `PHASE-05-09.md` carries a hand-written
   nav-group matrix that hides Catalog from `editor`, Media from `researcher` and Inquiries from
   `editor`, while the Phase 04 matrix grants `catalog.read`, `media.read` and `inquiries.read` to
   exactly those roles. §2.4 resolves it by deriving visibility from permissions per leaf, because a
   hidden-but-reachable route is worse than a visible read-only one. Confirm the derivation, or
   introduce explicit `*.view` permissions so the two agree by construction.

4. **`merchandising.read` does not exist.** The matrix lists only `merchandising.write`. This guide
   reads every merchandising surface under `catalog.read`. Confirm, or add the row.

5. ~~**System group ownership.**~~ **CLOSED by amendment A17 (2026-09-09).** `PHASE-05-09.md` said
   `System → Users` and `System → Feature Flags` were owner-only and Phase 19 called
   `/studio/system/flags` "owner-only"; Phase 04's matrix grants `system.users.manage` and
   `system.flags.write` to admin. **The matrix wins**, for the reason amendment A7 gave in the
   identical situation: a later phase's prose does not narrow a shipped authorisation. An admin
   already holds `system.settings.write` and `system.users.manage`, so a role trusted to invite
   staff and edit the WhatsApp template is not one to lock out of a feature switch. Every toggle is
   audited either way. This guide's tables were already correct and are unchanged.

6. **Role-management UI ownership.** `PHASE-05-09.md` puts role management in Phase 38; Phase 04 already
   delivers `/studio/system/users`, and Phase 38 explicitly does not rebuild it. Amend Phase 05's
   out-of-scope line to cite Phase 04.

7. **Higgsfield import status.** `DATA_MODEL.md` maps the manifest's `AVAILABLE_UNMIGRATED` to
   `content_status = 'DRAFT'`; `PHASE-05-09.md` imports the 250 rows as `APPROVED`. Both agree the rows
   are not `PUBLISHED`, so no public surface is affected, but the tracker's default status filter and
   the "Higgsfield Assets Pending" card definition depend on which is right.

8. **`/studio/content/pages/global` is not a D4 leaf.** The global-content editor is mounted as a nested
   segment under `pages`. It is a significant, frequently used surface — the CTA library, commerce
   labels, empty states, error copy and all Studio helper text live there. Either bless the nesting or
   add a `global` leaf to D4's content group. (Note that the `global_content` **table** is edited from
   two routes by design: the copy groups here under `content.write`, and the `WHATSAPP_TEMPLATE` and
   `CONTACT` configuration groups at `/studio/system/settings` under `system.settings.write`, which is
   where SEED §21 and §36 put them. One table, two surfaces, two permissions — deliberate, not a
   duplicate editor.)

9. **`/studio/research/opportunities/direction` is not a D4 leaf either**, for the same reason and with
   the same two options (already raised in `PHASE-31-38.md` open question 2).

10. **`/studio/media/all` versus D4's `{all,images,videos,models,documents,higgsfield,brand}`.** FEAT §13
    names six Media Manager sections; D4 lists seven leaves. `all` is the seventh and is the surface that
    carries bulk selection, the crop editor and the alt-text queue. No conflict — recorded so a later
    phase does not "simplify" it away.

11. **`higgsfield_tracker` is a registered flag with no owning phase.** FEAT §32 lists it;
    `PHASE-31-38.md` open question 7 suggests assigning it to Phase 43. Until it is assigned, it is
    unclear whether `/studio/media/higgsfield` is flag-gated at all. This guide assumes it is not.

12. **Cron secret reuse.** Seven scheduled jobs and the cache-revalidation endpoint are all guarded by
    `REVALIDATE_SECRET`, because D8 names no cron secret. Add `CRON_SECRET` to D8, or record that the
    reuse is intentional.

13. **The enquiry rate limit is written two ways across the documentation set.** The documents of
    record agree: `BUSINESS_RULES.md` BR-B5 and `SECURITY.md` §8 both say **five submissions per ten
    minutes**, keyed on `ip_hash` + form fingerprint, and §11 above now states that figure. Two
    documents still carry an hourly window and need the same correction:
    `docs/architecture/DATA_MODEL.md` (the `inquiries` privacy note) and
    `docs/project/phases/PHASE-16-22.md` (the Phase 20 spam-control line). This is a one-line
    correction in each, not a decision — but the window is a server guard someone will implement from
    whichever document they happen to open, so it should not be left divergent.

---

## 19. What the owner can change without a developer

This table is the acceptance test for the whole project (FEAT §49: *can the owner manage everything
without code changes?*). Every row is a claim about the software that a Playwright test or a runbook in
§16 can verify. A row that stops being true is a defect, not a documentation update.

| The owner can change… | Where | Effect |
|---|---|---|
| Any page's eyebrow, heading, highlighted fragment, body, supporting copy, CTA labels and CTA links | `/studio/content/pages` | Live after publish |
| Section order, visibility, theme and layout variant on any page | `/studio/content/pages`, `/studio/content/homepage` | Live after publish |
| Any desktop or mobile image or video in any section, and its alt text | `/studio/content/pages` → media slots | Live after publish |
| Which image serves which aspect ratio, by crop, without a second upload | `/studio/media/all` → crop editor | Live after publish |
| The announcement bar text, CTA, destination — and whether it appears at all | `/studio/content/pages/global` → `ANNOUNCEMENT` | Live after publish |
| The header menu, mega-menu categories, mobile menu and footer columns | `/studio/content/navigation`, `/studio/content/footer` | Live after publish |
| Every reusable label: CTAs, commerce labels, action labels, form copy, empty states, error copy | `/studio/content/pages/global` | Live after publish |
| Products: create, edit, price state, dimensions, materials, media, specifications, relations, publish, archive | `/studio/catalog/products` | Live after publish |
| Categories, collections, materials, and the relationships between everything | `/studio/catalog/*` | Live after publish |
| The customization form templates: add, rename, reorder, require, disable or remove any field | `/studio/catalog/customization-forms` | Live after publish |
| Portfolio projects and journal articles, including cover media, categories and scheduling | `/studio/content/portfolio`, `/studio/content/journal` | Live after publish |
| FAQ questions, answers, categories and order | `/studio/content/faqs` | Live after publish |
| Contact details, the WhatsApp number, and both WhatsApp message templates | `/studio/system/settings` | Live immediately |
| Every SEO title, description, social card, canonical URL, robots flag, keyword theme and redirect | `/studio/content/seo` | Live after revalidation |
| What the homepage features, in what order, and when each entry starts and stops | `/studio/merchandising/homepage`, `/scheduling` | Live after publish |
| The order of the seven store categories and which products are pinned in each | `/studio/merchandising/store` | Live after publish |
| What a visitor sees when a curated slot is empty | `/studio/merchandising/*` → fallback mode | Live after publish |
| Enquiry handling: pipeline status, internal notes, assignment, export, and a per-enquirer data request | `/studio/inquiries/*` | Immediate |
| Media: upload, tag, crop, alt text, folder, archive; and the 3D viewer settings and variant labels | `/studio/media/*` | Live after publish |
| Feature flags: 3D viewer, configurator, research, Sheets, advanced analytics, advanced similarity, newsletter | `/studio/system/flags` | Immediate |
| Staff users, their roles and their access | `/studio/system/users` | Immediate |
| Research: sources, policy approval, schedules, jobs, review dispositions, tags, shortlists, direction briefs, Sheets exports | `/studio/research/*` | Internal only — never public |
| Bulk changes to up to 500 products or assets, with a preview and a 24-hour undo | `/studio/catalog/bulk`, `/studio/operations/imports` | Live after publish |

### The honest counterpart

| Requires an engineer | Why |
|---|---|
| A new page **type** or a new CMS block type | Schema, Zod contract, renderer, Studio editor and a registry row |
| A new public route, or changing an existing URL | Route file, sitemap, redirects, tests |
| A new database table, column or enum | Migration, generated types, RLS policy, repository |
| A new role or a new permission | The permission matrix is code, and the SQL role list is generated from it |
| Design tokens, typography scale, colour system | The design system, with visual re-baselining across the QA matrix |
| A new integration or third-party service | Environment variables, security review, CSP |
| Connecting a web-analytics provider | Not in the approved stack; an owner decision with privacy consequences |
| Anything on the deferred list — checkout, payments, customer accounts, wishlist, reviews, AR, room visualisation, CRM, quotation automation | Deliberately not built (FEAT §39). Extensibility comes from clean architecture, not dead features |
| Rotating a secret | Vercel access plus a redeploy; the Studio never displays or edits a secret |
