---
doc: SESSION-STATE
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-12
owner_verification: NOT_REQUIRED
---

# SESSION-STATE

> Updated at the end of every phase, per requirement FEAT §40. Read this second, after
> `CLAUDE.md`, before doing anything. **Verify the claims below against the repository** —
> never assume a phase completed because this file says so.

---

## Most recent work — the Rivya UI Redesign, phases 1-2 of 6 (2026-09-13)

**What was asked.** A luxury redesign of the public site and the Studio against a supplied visual
reference (`https://rivya-living-art.vercel.app/`), delivered as working code with connected media,
editable Studio controls and recorded test results. Six phases were specified. **Phases 0, 1 and
most of 2 are done; 3, 4, 5 and 6 are not.** What follows is where to pick it up.

**The reference was READ, not guessed.** Egress blocks the reference host, the production host and
`res.cloudinary.com` from this sandbox, but `mcp__Vercel__web_fetch_vercel_url` reached the
reference and returned its HTML and all three stylesheets. Its whole design system is one `:root`
block, and the brief's three measured values are named tokens in it: `--mineral:#f4f1e9`,
`--sand:#e7e0d5`, `--obsidian:#080a0e`, alongside `--champagne:#b89b63` and `--sapphire:#164e6b`
which this repository ALREADY matches to the byte. Its hero clamp is
`clamp(3rem, 7vw + .5rem, 7.5rem)` = 103.41px at 1363px, confirming the brief's ~103px. Its
homepage is 15 sections in a strict mineral/sand alternation with three obsidian interruptions and a
56px numbered left rail. Everything in A46 is downstream of that read.

**The missing-media diagnosis, with the evidence.** This was the brief's first question and it has a
single, verifiable answer. Cloudinary holds all 252 assets and serves derived transforms;
`media_assets` holds 250 rows, all PUBLISHED and VERIFIED. But on the hosted project
**`page_sections.media_desktop_id` is NULL on all 83 rows and `media_usages` has 0 rows** — nothing
points at the library. It is not delivery, not status, not the cloud name. `seed:content` binds
media, and it was last run BEFORE the Higgsfield migration landed, so every binding resolved to a
gap and was skipped. Proved locally: re-running it after the migration bound 10 sections and wrote
20 `media_usages` rows.

**THAT CONCLUSION WAS WRONG, AND THIS CORRECTS IT (2026-09-13).** "Re-run the binding" cannot work
on any real environment, and the reason is in the seed runner's own idempotency guard. Rule 5c in
`scripts/seed/seed-content.ts` reads:

```
promotedByAHuman = row.status === 'PUBLISHED' && seededStatus !== 'PUBLISHED'
```

Section modules seed their rows as **DRAFT**. Every environment that has ever shown the site has
walked those rows to **PUBLISHED**. So the guard classifies every live section as a human's work and
skips it whole — including its media columns. Measured by actually running it here:
`skipped (owner edit) 35`, `inserted 0`, `updated 3`. It bound nothing that renders.

On the hosted project that means: **60 PUBLISHED sections would be skipped and 23 DRAFT ones bound**,
and a DRAFT section is not on the site. Re-running the seed against production would leave the
visible pages exactly as empty as they are now.

**FIXED — amendment A49, rule 5d.** The binding now runs AHEAD of the owner-edit guard, restricted to
columns that are NULL. A NULL media column is an absence, not a decision — nobody opens Studio and
chooses to have no image — so writing it overwrites nothing, while a column an editor HAS filled is
left alone even when the module names a different asset. The slot key is written in the same
statement, because migration 0050 requires one whenever an id is set and the key is a hashed field
the guard has already declined to write; ids alone would violate the check and roll back the whole
module. No second binding system was built, per the brief.

**Proved end to end.** A published section with NULL media and NULL slot key received
`media_mobile_id` and `media_slot_key = 'home.commission'` through the real runner, status unchanged.
With a desktop asset present, the homepage then served a real
`res.cloudinary.com/.../w_768/...` image where it had served a fallback well — so the render path was
never broken, and the binding was the only missing piece.

**A caution for whoever measures this next.** Early readings of "zero images on the homepage" were a
STALE PRERENDER, not a defect: `/` is statically prerendered, `rm -rf .next/cache` does not touch
`.next/server/app`, and Next reuses the existing HTML when no source file changed. Data-only changes
need `rm -rf .next` and a full rebuild before the page reflects them.

**THE REMAINING STEP IS THE OWNER'S, AND IT IS BLOCKED ON MERGE ORDER.** Nothing was written to
production. Hosted serves `main`, which does not carry A47's four new slots, and `sync_media_usages`
copies a slot key verbatim — so binding `home.final-cta` or `large-format.hero` there now would put
reverse-index rows against slots the deployed registry does not declare. **Merge this work first,
then run `npm run seed:content` against production**, where the 250 assets already exist.

**RE-VERIFIED AGAINST THE HOSTED PROJECT ON 2026-09-13**, directly rather than by inference:
`page_sections` 83 rows, `media_desktop_id` non-null on **0**, `media_mobile_id` non-null on **0**,
`media_usages` **0 rows**, `media_assets` **250 rows, all PUBLISHED**. The diagnosis holds unchanged.

**DO NOT RUN THE BINDING UNTIL THIS WORK IS MERGED.** Production serves `main`, which does not yet
carry A47's four new slots. `sync_media_usages` copies a binding's slot key into `media_usages`
verbatim, so binding `home.final-cta` or `large-format.hero` against a deployment whose registry
does not declare them writes reverse-index rows pointing at slots that do not exist — which is the
exact failure A47 was written to prevent. Merge first, then bind.

**The Vercel preview is behind Vercel Authentication and an agent cannot reach it.** Both the plain
URL and the `_vercel_share` link answer `302` to `vercel.com/sso-api`. The brief's reviewable-preview
deliverable therefore needs the OWNER to open it; it is not something this session can screenshot or
assert against.

**What shipped.** Amendment A46 in `CANONICAL-DECISIONS.md` is the full record. In brief: two new
warm schemes (MINERAL, SAND) built on new primitives beside `--rv-color-bone` rather than on a
repointing of it; Instrument Serif as the display face with the two consequences its single weight
forces; a third loaded family for the mono eyebrow, with §2.2's ceiling amended rather than
exceeded; `--rv-text-display-hero` as a seventh step; pill CTAs with an inverse-fill primary that
inverts correctly on all five schemes from one rule; a ground rhythm decided by the page rather than
by each renderer; a masthead that overlays a dark opening band using `:has()` and no JavaScript; and
seven more media bindings.

**A47 then unblocked the pictures.** Four slots the homepage and `/large-format` always needed —
`home.commission`, `home.three-d-resin`, `home.final-cta`, `large-format.hero` — plus
`MediaSlot.delivery`, because `presetWidthFor()` derived a delivered width by reading the slot's KEY
for the word "hero" and `home.final-cta` is delivered full-bleed without it. The homepage went from
2 bound images to 8. One binding deliberately does not clear its floor and says so in the record.

**A48 is the most recent.** The redesign brief is now `docs/requirements/03-UI-REDESIGN-BRIEF.md`,
verbatim and read-only, because everything since A46 implements a document that existed only as a
chat attachment — and four citations of it were pointing at `FEAT §50`, which says neither of the
things they attributed to it. Then: RC-245 `SectionRail`, a page-section index at `xl` and above
that costs no island and holds no list of its own; a transform-only band entrance, because a
scroll-driven `opacity` animation had made CONTRAST A FUNCTION OF SCROLL POSITION and failed axe at
SERIOUS on `/large-format`; and `break-words` on the footer email, which at 237px in a 160px column
had been scrolling **every route** sideways at 1024px.

**Verified, and these are the real numbers.** 44/44 gates green (`npm run check`, exit 0); **3,083
unit tests across 207 files pass**; `next build` clean; **the full browser suite at eight widths
across four shards: 1,979 passed, 0 failed**; contrast 60 pairs across 5 schemes; island budget
unchanged at 5; no horizontal overflow at any of the eight QA widths.

### Where to pick it up — the pending work, in order

**DONE since this list was written: the media-slot registry amendment (was item 1).** Amendment A47
added the four slots and bound the four verified pairs. The homepage's fallback wells are no longer
a registry problem.

**1. Phase 3 — the remaining public routes.** `/collection`, `/collection/[category]`,
`/collections/[slug]`, `/product/[slug]`, `/custom-commissions`, `/portfolio`, `/journal`,
`/search`, `/privacy`, `/terms` and the global states. The token, rhythm, rail and motion work
propagates to all of them automatically; what is NOT done is route-specific composition. `/faq` is
done — A47 gave it the `h1` it had been missing, which was red on `main` before this work started.

**2. Phase 4 — the Studio.** Untouched beyond what it inherits from the primitives (pill buttons,
inverse-fill primary). 82 routes under `app/(studio)/studio/(shell)/`. Note the constraint recorded
in `TESTING.md` §13: the local harness is PostgREST alone with no auth server, so **156 Studio specs
skip** and a Studio redesign cannot be browser-regression-tested here without GoTrue or a hosted
preview with a fixture account. **Resolve that before starting, not after** — a redesign of 82
routes with its regression suite skipped is not verifiable.

**3. Phase 5 — the external component evaluation.** The brief names eleven sources and asks for a
recorded evaluation. **One EXISTS and must not be described as absent**: `COMPONENT_REGISTRY.md` §5,
audited 2026-09-07 and gate-enforced, with five sources MIT-verified and marked `NOT_ADOPTED` and
six `REJECTED`. What it is not is what the brief asks for: it evaluates SOURCES, and the brief asks
per COMPONENT. That per-component pass is the pending work. Marketing sites are blocked from this
sandbox; `raw.githubusercontent.com` and `registry.npmjs.org` are reachable, which is enough to read
a licence and a component's source.

**OPEN QUESTION FOR THE OWNER, still unanswered.** Whether to ADOPT any external component at all,
or to keep everything first-party and record the evaluation as the brief's deliverable. Nothing
should be adopted until this is answered — every candidate so far has been `NOT_ADOPTED`, and
reversing that is a dependency decision, not an implementation one.

**4. Phase 6 — e2e, visual baselines, Lighthouse.** The e2e suite IS now run and green (1,979
passed across four shards at eight widths). What remains: the 33 committed visual baselines need
regenerating in the pinned container image now that the composition has moved, Lighthouse has not
been run, and the brief's preview-deployment evidence needs a machine with Cloudinary reachable.

### Environment notes for the next session

The local harness runs and is the reason any of this could be measured: PostgreSQL 16.13 at
`/var/lib/postgresql/rivya` on :5432, PostgREST 13.0.4 (not vendored — fetch the release binary and
point `POSTGREST_BIN` at it), `node scripts/db/local-rest.mjs`, then `next dev`. `ENVIRONMENT.md`
§741 documents port 5433 and a `$PGROOT/data` layout; both differ from what actually runs here, and
the doc is the one to trust for a fresh setup.

**Egress blocks `res.cloudinary.com`.** No screenshot taken in this sandbox can show a real
photograph. Screenshots were captured with Playwright route interception substituting a labelled
placeholder carrying each asset's `public_id` and delivered pixel size, so layout, crop, scale and
placement are faithful and the pixels are visibly not the real asset. **Do not present those as
before/after photography evidence.** The brief's deliverable 8 needs a machine with Cloudinary
reachable.

The local database is NOT canonical seed state: all 250 media were published and verified and all 57
sections walked to PUBLISHED through the real `cms_publish_section`, to mirror hosted. Do not
regenerate `INITIAL_CONTENT_INVENTORY.md` against it.

## Previous work — Phase 45's deferral list, worked through (2026-09-12)

**What was asked.** A complete redesign of the public site and the Studio, content and colour
unchanged. Phase 45 had already been run and recorded: `DESIGN_SYSTEM.md` §19 held four measured
`FAIL` verdicts and `ROADMAP.md` a deferral list. This is that list.

**What shipped, in five pull requests** (#62–#66, all on `claude/youthful-edison-d0s86n`):

- **The hero floor.** `--rv-hero-min-h: 76svh` applied through a new `AspectBox` `minBlockSize` prop
  — a floor, not a height, so the aspect ratio still drives the box. Measured at the eight QA widths
  on `/` and `/large-format`: `91·69·61·49·37·91·82·76%` → `91·76·76·76·76·91·82·76%`.
- **Section rhythm.** `SECTION_RHYTHM` in `SectionShell`, exhaustive over all 34 block types, four
  steps. Before, 26 of 28 renderers sat at `lg`.
- **The reveal layer.** `app/styles/motion.css`, scroll-driven, `@supports`-guarded, **zero islands**.
  RC-207 `Reveal` had been built in Phase 02 and imported by nothing, because a client component in a
  renderer is an island on all sixteen CMS routes.
- **Two islands off every public route.** `HeroMotion` and `MaterialSequence` to `next/dynamic`;
  budget lowered 7 → 5 so it cannot silently come back.
- **Conversion.** The §7.10 sticky submit row; `?type=` honoured by `InquiryForm`; typed rail
  destinations; Studio publish/unpublish for a category (six of seven publish; `3d-resin` is refused
  by its own trigger, correctly).
- **Crops.** `cropsForAssets` had no callers anywhere. `loadPageMedia` now resolves them in one query
  per page and threads them through `MediaSlot` to `MediaImage`'s `src` and **every `srcSet` rung**.
  Ten media slots bound from the documented family map; unbound slots stay gaps.
- **The two §45 gates.** `scripts/design/check-token-usage.mjs` (44th gate in `npm run check`) and
  `scripts/content/classify-copy-diff.ts` (`npm run content:classify-copy`, deliberately not in
  `check`).
- **The seven `null` renderers; the catalogue is 34 BUILT / 0 PLANNED** (amendment A45).
  `checklist`, `numbered-steps`, `faq-list`, `contact-details`, `rich-text`, `media-split`, `quote`.
  `rich-text` is PLAIN TEXT, so A14's objection to a markup block stands unaltered; the exhibition
  template regains FEAT §8 element 9. `faq-list` resolves through `lib/cms/references.ts` and renders
  native `<details>` rather than RC-206 (a Client Component there is an island on all sixteen CMS
  routes). `/faq` gained the band that draws the questions — it had a page row, ten `faqs` rows and
  no sections at all. `contact-details` and the footer now share `ContactChannels` (RC-244).

- **The twelve declared-but-unbuilt layout variants, and `ContentCarousel` (RC-222).** Eleven blocks
  declared two `layoutVariants` each and branched on NEITHER; `hero`'s `contained` and `split` were
  byte-identical. All branch now, and the tests assert the two arrangements DIFFER, which is the only
  claim the Studio's picker makes. The carousel's scroller is a Server Component and its arrows come
  through `next/dynamic`, so the public island budget is unchanged at 5 and `site:check-islands`
  lists it among the eight loaded on demand. Auto-advance is deliberately not implemented (§7.18's
  WCAG 2.2.2 clause). Four new `global_content` rows carry the names it reads aloud.

**A site-wide outage, found by publishing a section rather than by reading code.**
`buildDirectContactUrl` read `NEXT_PUBLIC_WHATSAPP_NUMBER` through `requiredEnv`, which THROWS, and
the footer calls it on every page as soon as the `contact-details` section is published. In any
environment without that variable, the first time the owner does what they are asked to do — verify
the studio's number and publish it — **every route answers 500.** It had never fired because the
section had never been published; publishing it in the local harness turned every page red at once.
It returns null now, and a missing number means no link, like a missing label and a missing greeting
already did. Both surfaces also pass the VERIFIED section's number (A20), which the direct contact
links had never used.

**The local harness, at last.** Postgres 16 + PostgREST 13.0.4 + `scripts/db/local-rest.mjs` +
`next dev`, which is what made the hero measurement and the a11y sweep real rather than reasoned.
Three PRs had been verified without it.

**The local e2e run, explained rather than waved off.** Eighteen failures per width project, four
causes, **none of them the site**: ten need `DATABASE_URL` in Playwright's own environment (the
enquiry rate-limit reset runs in a `beforeEach` and throws before any page loads), three need
`NEXT_PUBLIC_SITE_URL` (no origin, so no canonical and no publisher), three are the dev server's
cache headers and two its module graph. All eighteen pass against `E2E_PRODUCTION=1` with both
variables set. Written down in `TESTING.md` §8 so the next person does not spend the afternoon on it.

**Two corrections I made to my own reports.** "Four bands stranded at opacity 0" was my probe, not
the code — `scroll-behavior: smooth` means measuring two frames after `scrollIntoView` measures a
moving page; every band is 1.00 once it settles, and my `animation-range` change was reverted. And
the media bindings move **no** visual baseline: the test fixture inserts eleven rows, not the 250
Higgsfield assets, so every binding resolves to a gap there.

**Files Created** — `app/styles/motion.css` · `scripts/design/check-motion-tokens.mjs` ·
`scripts/design/check-token-usage.mjs` · `scripts/content/classify-copy-diff.ts` ·
`scripts/seed/bind-media.ts` · five unit test files

**Files Changed** — `app/styles/tokens.css`, `base.css` · `components/primitives/AspectBox` ·
`components/sections/{SectionShell,HeroSection,MaterialStorySection}.tsx` ·
`components/patterns/{InquiryForm,ProductInquiryRail,MediaSlot,MediaImage}` · `lib/cms/media.ts` ·
`content/seed/media-bindings.ts` · `app/(studio)/studio/(shell)/catalog/actions.ts` ·
`scripts/site/check-island-budget.mjs` · `package.json` · `CHANGELOG.md` · `PROJECT_STATE.md` ·
`docs/design/DESIGN_SYSTEM.md` · `docs/ops/TESTING.md` · `docs/project/ROADMAP.md` · this file

**Database Changes** — **None.**

**Tests Run / Results** — `npm run check` (**44 gates**) exit 0 · 205 files, **3 067** unit tests,
all green · `tests/e2e/a11y/` against the local harness: **89 passed, 0 failed**, 85 skipped
(unpublished routes) · the six specs that failed locally re-run green under `E2E_PRODUCTION=1` ·
both new gates negative-tested: a bespoke `cubic-bezier` fails the motion gate, and `padding-block:
13px`, `font-weight: 600`, `line-height: 1.5` and `z-index: 40` fail the usage gate while
`calc(var(--rv-space-3) + env(safe-area-inset-bottom, 0px))` and `clamp(var(…), 2vw, var(…))` pass ·
the seven promoted blocks verified in a real browser against the local harness, with their sections
published there: `/custom-commissions`, `/contact` and `/faq` all 200, **zero axe violations on each**,
and the FAQ band measured for the things `<details>` gets wrong — the native marker gone in both
engines (`display: flex` and `list-style: none`), a collapsed answer out of the tree, Enter toggling
from the summary, and the chevron animating on Tailwind v4's standalone `rotate` property · the carousel driven in a
browser at 820px: the row overflows, the back arrow is disabled at rest, Next moves it one card
(0 → 323px) and enables the back arrow, a second click reaches the end and disables Next, the
scroller takes focus and ArrowRight/End move it natively, each card keeps its own link, and axe
reports zero serious or critical violations on a homepage carrying a carousel, a strip and a split
hero at once.

**Next exact action** — PR 7 of the plan: `MobileNav` to §8.3. Three named gaps — children are a
permanently-expanded nested `<ul>` (no button, no `aria-expanded`); rows are `py-1` on 18px text,
nowhere near the specified 56px; and there is no pinned primary action and no safe-area handling.
`components/patterns/Disclosure` (RC-206) exists, is APG-correct and is used nowhere on the public
site. MobileNav is already an island, so the rebuild costs no budget. The CTA label is a new prop
from `global_content` — `check-section-copy` scans all of `components/patterns`, so it cannot be a
literal. Then PRs 8–10, the Studio: `ToastRegion` (RC-317) + the §15 shell, the §13 data surfaces,
and the two stub routes.

**Still the owner's** — audit questions 1, 5 and 8 (§19.2); legal copy for `/privacy` and `/terms`;
**a heading for `/faq`**, which has no `h1` without one (`SectionList` gives the first section level
1, so one sentence typed on the band is enough, and `content/seed/faq.ts` says so beside the record);
the ten FAQ answers; and the two `seo:global.*` sentences the new classifier reports.

---

## Most recent work — amendment A44, the Vercel dashboard as the owner's login (2026-09-12)

**The owner's decision, taken with the numbers in front of them.** They asked for the admin id and
password to come from Vercel rather than Supabase. The literal reading — credentials compared in
application code, no Supabase session — was put to them with its cost: `auth.uid()` would be null,
so **292 of the 327 RLS policies** deny, and the Studio authenticates somebody into a surface that
reads nothing and saves nothing. They chose the alternative.

**What shipped.** `npm run auth:sync-admin` is now the first command in the `build` script. On a
production deployment it applies `STUDIO_ADMIN_EMAIL` / `_PASSWORD` / `_ROLE` / `_NAME` to the owner
account, setting the password every time. Supabase Auth still issues the session, so authorisation is
untouched. Production scope only; never fails a deployment; never mints a second owner.

**The consequence that must not be forgotten:** a password set any other way does not survive the next
production deploy. The reset flow still works, but for the account in `STUDIO_ADMIN_EMAIL` the change
lasts until the next deployment. Changing the owner's password now means changing the Vercel variable.

**Files Created** — `scripts/auth/admin-sync.ts` (the decision, pure) · `scripts/auth/sync-admin.ts`
(the runner) · `tests/unit/admin-sync.test.ts` (10 cases)

**Files Changed** — `package.json` (the `build` script) · `.env.example` ·
`docs/architecture/CANONICAL-DECISIONS.md` (A44, D8) · `docs/ops/ENVIRONMENT.md` ·
`docs/studio/STUDIO_GUIDE.md` (§2.1.1 path D) · `CHANGELOG.md` · this file

**Database Changes** — **None.**

**Tests Run / Results** — `npm run check` (42 gates) exit 0 · 198 files, 2 978 unit tests, all green ·
the runner exercised three ways by hand: local (declines, development scope), preview (declines),
production against an unreachable Supabase (**EXIT=0**, `failed, and the deployment continues`).

**Known Issues** — the diagnosis that prompted this is unchanged and still the owner's to act on:
sign-in has been refused three times (0 `audit_logs` rows, 0 sessions), and the reset email hit
Supabase's built-in 2/hour cap at 08:53 (`over_email_send_rate_limit`, 429, logged). A44 routes around
both: set the password in Vercel, redeploy, sign in.

**Next Exact Action** — **the owner sets `STUDIO_ADMIN_PASSWORD` in Vercel (Sensitive) and
redeploys**, then signs in at `/studio/login`. The proof is an `audit_logs` row with action
`auth.signin`.

---

## Most recent work — post-launch defect pass on A43 (2026-09-12, later the same day)

**Not a phase, and not new scope.** A read-back of the A43 work against the LIVE project and the
installed libraries, rather than against the documents. It found four defects, fixed all four, and
established three facts about the deployment that no document had right.

**The four defects** — all in the path the owner was about to walk:

1. `auth:bootstrap` / `auth:list-users` ignored `.env.local` and exited **0** saying "Nothing done".
   Seventeen other operator scripts call `process.loadEnvFile`; these two did not. Fixed.
2. `/api/auth/confirm` treated "no error, no session" as success, producing an expired-link page
   about a link that had just been accepted, with no log row. Fixed: it checks the session and writes
   `auth.recovery.no_session` at WARNING. This is the PKCE-client-versus-`{{ .TokenHash }}`-template
   case, so it is the shape the recommended dashboard change produces.
3. `auth:list-users` printed "never signed in" from `staff_profiles.last_seen_at`, which **nothing in
   the repository or the database ever writes**. Fixed; it points at the `auth.signin` audit row.
4. `app/api/auth/confirm/route.ts` cited `ENVIRONMENT.md` §4 for the template change; that section is
   the variable list and the file says nothing about templates. Corrected to `STUDIO_GUIDE.md` §2.1.2.

**Three facts the documents had wrong**, none of them a code change and all of them blocking:

- **Production does not have the reset flow.** All seven GitHub checks on the merge commit passed, but
  the Vercel **production build failed** — `Gateway Timeout` while prerendering `/custom-commissions`,
  ROADMAP **E9** for the third time — so production still serves PR #57's code. `/studio/forgot-password`
  and `/api/auth/confirm` are not deployed. Configuring the Supabase template today points links at a
  route that 404s.
- **There is no custom domain, and the site is behind an SSO wall.** The Vercel project has only its two
  `*.vercel.app` hosts, and deployment protection is `all_except_custom_domains`, so every reachable
  address redirects to `vercel.com/sso-api`. Closing ROADMAP **O7** is not a "make the apex primary"
  toggle — the apex is not attached to the project at all, and registrar access is DEPLOYMENT §12 item 1.
- **An ACTIVE owner already exists and has never signed in.** `staff_profiles` holds exactly one row;
  `auth.sessions`, `auth.refresh_tokens` and `audit_logs` are all empty. `DEPLOYMENT.md` §12 row 10,
  `docs/PHASE_31_TO_46_IMPLEMENTATION.md` and the superseded Phase 44 block below all still say
  "`auth.users` is empty" — they are stale, and a runbook assembled from them sends the owner down the
  CREATE path, where the second-owner guard refuses with exit 1.

**Files Changed** — `app/api/auth/confirm/route.ts` · `scripts/auth/bootstrap-admin.ts` ·
`scripts/auth/list-staff.ts` · `lib/auth/bootstrap.test.ts` · `docs/studio/STUDIO_GUIDE.md` ·
`docs/ops/ENVIRONMENT.md` · `CHANGELOG.md` · this file

**Database Changes** — **None.** Reads only; the live project was queried, never written.

**Tests Run / Results** — `npm run check` (42 gates) exit 0 · 197 files, **2 968** unit tests, all green ·
`npx tsc --noEmit` clean. The env-file fix was verified by running the script three ways: with
`.env.local` only (now proceeds), with nothing (still the friendly exit-0 no-op), and with a shell
variable contradicting the file (the shell wins).

**Known Issues** — unchanged and now better evidenced: the two Supabase dashboard actions, plus the
production build. **The build is the first blocker**, and it is not this work's defect: E9 is
non-deterministic and a plain redeploy or an Instant Rollback→promote of
`dpl_7hvTYYWYR8S88KrYKod866JoibMC` is the lever.

**Next Exact Action** — **redeploy `main` on Vercel until a production build succeeds.** Nothing about
the reset flow can be configured or tested until the routes are actually served. The canonical-host
item below is unchanged and is a larger job than it reads.

---

## Most recent work — post-launch, amendment A43 (2026-09-12)

**Not a phase.** `ROADMAP.md` says there is no Phase 47; this is post-launch work and is labelled as
such everywhere it appears. Phase 46 remains the last phase, and its four outstanding owner items
below are unchanged.

**Scope** — two gaps left by the launch, both the same shape: something the owner needed was an
engineer's errand.

1. **A password reset the owner can run alone.** `/studio/forgot-password` →
   `app/api/auth/confirm/route.ts` → `/studio/reset-password`. Rate-limited at 5/hour on the request
   and 20/hour on the confirm; the request page answers identically whether or not the address has
   an account; setting a password signs out globally. `proxy.ts` excludes both new routes, and the
   eslint "every Studio page calls `requirePermission()`" rule exempts them — on the reset page that
   check would be the wrong question, because setting your own password is not a staff capability.
2. **The first owner from an environment.** `npm run auth:bootstrap` reads `STUDIO_ADMIN_EMAIL`,
   `STUDIO_ADMIN_PASSWORD`, `STUDIO_ADMIN_ROLE` (defaults to `owner`) and `STUDIO_ADMIN_NAME`.
   Unset is a no-op exiting 0; half-set exits 1 naming the variable; an existing account's password
   is never changed without `--reset-password`. `npm run auth:list-users` answers the
   forgotten-address question that no public form safely can.

**Files Created** — `lib/auth/password-reset.ts` · `lib/auth/bootstrap.ts` ·
`lib/auth/bootstrap.test.ts` · `app/(studio)/studio/forgot-password/page.tsx` ·
`app/(studio)/studio/reset-password/page.tsx` · `app/api/auth/confirm/route.ts` ·
`scripts/auth/bootstrap-admin.ts` · `scripts/auth/list-staff.ts`

**Files Changed** — `proxy.ts` · `eslint.config.mjs` · `package.json` · `.env.example` ·
`lib/security/rate-limit.ts` · `lib/logging/redact.ts` · `components/studio/strings.ts` ·
`app/(studio)/studio/login/page.tsx` · `tests/unit/studio-nav.test.ts` ·
`tests/e2e/studio-access.spec.ts` · `docs/architecture/CANONICAL-DECISIONS.md` ·
`docs/ops/ENVIRONMENT.md` · `docs/ops/SECURITY.md` · `docs/studio/STUDIO_GUIDE.md` ·
`PROJECT_STATE.md` · `CHANGELOG.md` · this file

**Database Changes** — **None.** No migration, no policy, no role, no row. The whole flow runs on
GoTrue's own account state and on `rate_limit_buckets`, which already existed.

**Tests Run** — `npm run check` (42 gates) · `npx tsc --noEmit` · the full unit project ·
`playwright --list` on the extended access spec.

**Test Results** — all green: 42 gates, 197 unit files, 2 964 tests. `docs:check-contract` refused
the four new variables until `ENVIRONMENT.md` §4 documented them, which is the gate working. The
seven new e2e cases are listed and cover only what needs no auth server; sending and verifying a
link still cannot be exercised here, for the same reason ~156 Studio specs skip.

**Known Issues** — **two owner actions, and neither is code.** SMTP must be configured in Supabase
or no reset link is ever delivered, and the page cannot say so without becoming the
account-enumeration oracle it exists to avoid. The *Reset Password* email template should move to
`{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` so a link opened on a
phone can be completed on a laptop; the default `?code=` shape works only in the browser that asked.
Both are written out in `STUDIO_GUIDE.md` §2.1.2, and the confirm route accepts either shape, so
neither is broken today — one is simply better.

**Next Exact Action** — unchanged from Phase 46: **the owner sets the canonical host** (see the end
of the section below). The two SMTP/template items above belong to the same visit to a dashboard.

---

## Current Phase

**Phase 46 — Documentation + Handoff. PARTIAL.** The final phase. Run as an **audit of the 34
documents that already existed** rather than as a writing exercise, because the phase's own goal
statement is the standard: *a document that claims a capability the code does not have is worse than
no document.* It found eight defects. Four items remain and every one of them is the owner's.

**Status** — PARTIAL.

**Completed** — the five-check documentation audit and the two claim gates; the generated
owner-verification backlog and preflight gate 13; the `/studio` card; front matter on all 34
documents and the viewer that was printing it as prose; `ROADMAP`'s status column and post-launch
backlog; the deliberate-omission register; the support model and incident path; the recoverability
proof; the Studio guide reconciled with the four rows of its own capability boundary that are not
true today.

### Phase 46: what the audit found

1. **Nineteen documents under `docs/` had no front matter** — the binding contract, all six phase
   documents, and six of the ten the Studio's documentation viewer serves. Phase 01's verification
   step 4 names sixteen of them by path and says each "must gain front matter before this phase's exit
   criterion can be ticked". The criterion was ticked.
2. **The viewer rendered that block as page content**, on every document that had one. Phase 38's
   parser has no front-matter branch.
3. **`ROADMAP.md` had no `Status` column**, which Phase 01's scope specifies.
4. **`PROJECT_STATE.md` claimed 33 gates**; `npm run check` runs 39.
5. **The clean-clone recovery sequence fails as written, twice** — nothing in it creates the
   environment `next build` reads, and the build queries the database while building, so
   `DATABASE_URL` alone is not enough.
6. **Four rows of the capability boundary are untrue.** There is no `publishCategoryAction` anywhere,
   so the seven category routes stay `DRAFT` and 404; `/studio/content/faqs` and
   `/studio/system/settings` are twenty-line route stubs, which makes **changing the WhatsApp number
   an engineer task**; and the feature-flags row named a `newsletter` flag that has never existed.
7. **`BUSINESS_RULES.md` cited enforcement that does not exist.** Of the 52 test files it names, seven
   are absent — including both files BR-A1 cites, so **the prohibition on checkout is enforced by
   review, not by a gate**. Two others were citation errors only: the rule is enforced, by
   `tests/unit/rls/phase20.test.ts`.
8. **Seventy source paths named by descriptive documents do not exist**, measured by
   `npm run docs:check-paths` (2874 cited, 243 plan-document drift, 25 correctly reported absent).

### Phase 46: what remains, and why none of it can be done here

| # | Outstanding | Why it is the owner's |
|---|---|---|
| 1 | The **41-row** owner-verification backlog | Every row states something about a real business only the owner can confirm (D10) |
| 2 | The capability-boundary dry run — ten Studio operations, unaided | A measurement of whether the software is usable by its owner |
| 3 | The handover session | A fact about the world: whether it happened, and when |
| 4 | The runbook screenshots | **Cannot be captured in this container at all** — the local harness has no auth server, so no browser can reach a Studio page; the same wall behind which ~156 Studio specs skip |

**Files Changed** — `README.md` · `PROJECT_STATE.md` · `CHANGELOG.md` · `package.json` ·
`docs/SESSION-STATE.md` · `docs/PHASE_31_TO_46_IMPLEMENTATION.md` · `docs/project/ROADMAP.md` ·
`docs/project/BUSINESS_RULES.md` · `docs/studio/STUDIO_GUIDE.md` · `docs/ops/DEPLOYMENT.md` ·
`docs/architecture/CANONICAL-DECISIONS.md` · `docs/content/INITIAL_CONTENT_INVENTORY.md` (generated) ·
`docs/content/DEMO_CONTENT.md` (generated) · the six phase documents and the four media guides, for
front matter · `lib/cms/docs/render.ts` · `scripts/docs/check-doc-contract.mjs` ·
`scripts/content/build-content-inventory.ts` · `scripts/demo/build-register.ts` ·
`app/(studio)/studio/(shell)/page.tsx` · `components/studio/strings.ts` ·
`tests/unit/docs-allowlist.test.ts` · `tests/e2e/studio-system.spec.ts`

**Files Created** — `scripts/docs/audit-docs.mjs` · `scripts/docs/audit-docs.d.mts` ·
`scripts/docs/check-doc-paths.mjs` · `scripts/content/build-verification-report.ts` ·
`lib/cms/verification-backlog.ts` · `lib/supabase/repositories/verifications.ts` ·
`tests/unit/docs-audit.test.ts` · `tests/unit/docs-render.test.ts`

**Database Changes** — **None.** No migration, no policy, no role, no row. The backlog is a read;
`lib/cms/verification-backlog.ts` holds no writer. Only the owner can clear an
`OWNER_VERIFICATION_REQUIRED` (D10).

**Components Added** — one, and it is not a new file: `OutstandingVerificationsCard` inside
`app/(studio)/studio/(shell)/page.tsx`. Deliberately **not** a `DASHBOARD_CARDS` row — that registry
is one card, one relation, one phase, and this figure sums twenty-two tables. A failed read is never
rendered as `0`.

**External References** — none added. No new dependency, no new service, no new network call. The
only gate that reaches the internet is still Phase 44's `check-canonical-host.ts`.

**Media Assets Added** — **None.** Runbook screenshots would be documentation images under `docs/`,
not `media_assets` rows, and none was captured (see outstanding item 4).

**Higgsfield Assets** — untouched. No generation, no modification; `manifest:verify` unaffected.

**Tests Run** — `npm run check` (44 commands, 39 gates) · `npx tsc --noEmit` · `docs-audit` (22) ·
`docs-render` (5) · `docs-allowlist` (12) · `npm run test:unit` in the clean clone · the four
documentation gates individually · `playwright --list` on the extended Studio spec · gitleaks 8.30
against `.gitleaks.toml` over `origin/main..HEAD` · the clean-clone sequence end to end.

**Test Results** — all green. CI on `75e6b30` was green on all eight checks: `verify`, four browser
shards, both Security jobs and Vercel. Two CI failures were hit and fixed rather than worked around:
gitleaks on this phase's own synthetic secret fixtures (now minted at run time — `.gitleaks.toml`
forbids the path allowlist that would have been the easy fix), and `content:check-inventory` (the
document had been generated from a fixture-laden database rather than the canonical seeded one).

**Known Issues** — `ROADMAP.md`'s post-launch backlog, E1–E9. The three worth naming: the build has
failed three times today on a database `Gateway Timeout` while prerendering (E9); `lib/cms/docs/index.ts`
traces the whole project into the server bundle (E1); and the commerce prohibitions are unenforced by
any gate (E8).

**Remaining Work** — the four owner items above. No engineering work is required to close the phase.

**Next Exact Action** — **the owner sets the canonical host.** Vercel → `rivya-living-art` → Settings →
Domains: make `rivyalivingart.com` the primary domain and `www.rivyalivingart.com` redirect to it.
The live site is currently unreachable on both addresses because each redirects to the other; every
canonical tag, sitemap entry and OG url already names the apex, so no code change is wanted. Preflight
gate 14 (`npm run ops:check-canonical-host`) confirms it.

**Relevant Documentation** — `docs/project/phases/PHASE-39-46.md` §Phase 46 ·
`docs/studio/STUDIO_GUIDE.md` §16, §17, §19 · `docs/project/BUSINESS_RULES.md` §N ·
`docs/ops/DEPLOYMENT.md` §10.1, §10.2 · `docs/content/INITIAL_CONTENT_INVENTORY.md` ·
`docs/project/ROADMAP.md` post-launch backlog · `README.md` *From a clean clone*.

**Environment Requirements** — no new variable. D8 is unchanged. `build-verification-report.ts` reads
`DATABASE_URL`, as every other script in `scripts/` does.

**Migration Requirements** — **None.** Nothing to apply, in any environment.

---

## Previous phase — Phase 42 (Comprehensive Testing)

**COMPLETE.** The test system the previous forty-one phases wrote specs against: one deterministic fixture, a browser suite that actually runs, a visual tier,
coverage thresholds that mean something, and the CI to run all of it. Deferred by the owner's
instruction until Phase 44's development had landed, then executed in full.

### Phase 42: what it found

Running these suites for the first time produced **eight production defects** that every existing
check had passed over.

1. **No enquiry could be saved. In any environment, since Phase 41.** `submit-inquiry.ts` wrote a
   32-character rate-limiter digest into `ip_hash`, whose CHECK demands 64. The database refused
   every insert; the action correctly declined to redirect; so the site's one non-negotiable rule —
   persist before the WhatsApp handoff — had never completed successfully for anybody. Fixed by
   using `hashAddress`, the function that exists for that column.
2. **Nothing had ever been written to `system_logs`.** `writeSystemLog` sent seven of thirteen RPC
   parameters as `undefined`; `supabase-js` drops those keys and PostgREST could not resolve the
   function. `logSystem` caught the error and printed the error's NAME only, so the symptom was one
   word in a dev server's output and an empty log table that reads like "nothing has gone wrong".
3. **The catalogue's product cards were not links** — twenty-seven phases after `ProductCard`'s own
   comment promised the heading anchor "in Phase 15".
4. **Two listing pages skipped a heading level.** `cardHeadingLevel` now derives it from whether the
   section rendered a heading of its own.
5. **The gallery thumbnail strip was zero pixels tall on every product page.** `MediaImage` fills a
   frame and says so in its own header; every other call site wraps it in one, this one did not. The
   images loaded and nobody could see them. Now wrapped in an `AspectBox`.
6. **Every `/collection/[category]` page returned 500 in a production build.** `generateStaticParams`
   cannot coexist with `await searchParams` — Next pre-renders the page, then refuses it at request
   time. `next build` succeeds, so every CI gate in this repository had passed it. The route is
   dynamic now, which is what a page keyed on the query string already was.
7. **The home page's material story failed AA.** `opacity-40` on a dimmed stage composites
   everything under it, including `MediaFrame`'s "image unavailable" label — 2.77:1 where the token
   pair measures 10.42:1, and no ink would have fixed it. The dim moved onto the photograph, which
   is what the effect was always about. `--rv-surface-sunken` also joined the static contrast
   matrix, where it had never appeared.
8. **Every page scrolled sideways at 1024px.** The masthead's inline search field appeared from
   `lg`; at 1024 the content box is 930px and a wordmark, a nine-item nav and that field will not
   compress below 1054. The field now appears from `xl` — the threshold `search-combobox-a11y` had
   been skipping below all along — and the nav's gap tightens between the two. Between 1024 and
   1279 the masthead carries no search control; DESIGN_SYSTEM §8.1 asks for a compact search
   *trigger*, which is the Phase 45 change that closes it.

### Phase 42: what is built

**The fixture.** `tests/fixtures/ids.ts` + `scripts/test/seed-fixture.ts`: six staff, four products
(one per `price_state`), a collection, a DRAFT portfolio project, two articles, ten FAQs, five
inquiries, a research corpus of twenty, twelve media assets — all from a frozen clock, all behind a
reserved id prefix, refusing any non-local database. `--publish-seeded` walks the seeded sections up
the real DRAFT → REVIEW → APPROVED → PUBLISHED ladder, because otherwise every public route 404s and
the browser suite skips everything and reports green.

**`scripts/test/check-fixture-isolation.mjs`** — preflight gate 9 at last, and in `npm run check`.

**Twelve committed PNGs** from a hand-rolled encoder (stored deflate, so the bytes are a pure
function of the pixels), served for every Cloudinary request by `tests/support/media-route.ts`.

**A third vitest project, `integration`** — row security across the schema, seed idempotency by
digest, the publish gates attempted as the database owner, the migration ledger against the files.

**Sixteen browser specs** including the seven `tests/e2e/a11y/**` Phase 41 deferred, and **four
visual specs with 33 baselines** at three widths, tiered by what a regression costs.

**`e2e.yml`** (sharded four ways), **`security.yml`** (gitleaks over the whole history, `npm audit`
split by runtime versus build), **`dependabot.yml`**, **`.gitleaks.toml`**, **`tests/flaky.json`**
and the gate that keeps it honest.

### Phase 42: what is NOT true

- **The Studio has no browser coverage beyond its login page.** 156 specs skip for want of an auth
  server the local harness cannot provide. Recorded in `docs/ops/TESTING.md` §13.
- **Coverage is 47.9%, not the 80% the phase document projected.** `vitest.config.ts` carries the
  measured figure as a ratchet with the reason and what it would take to close.
- **33 visual baselines, not 127.** One width per breakpoint band; the projection predates the
  routes.
- **Three public routes have no seeded sections** (`/faq`, `/privacy`, `/terms`) and skip.
- **The visual harness was photographing the development server, and its stabilising stylesheet had
  never applied** — `addStyleTag` before `page.goto` lands in `about:blank`. Both fixed, and all 33
  baselines regenerated from `db:reset` → `seed:content` → `seed-fixture --publish-seeded`, the
  three steps `e2e.yml` runs, so a baseline is reproducible by somebody else.
- **CI does not compare the visual baselines.** A runner rasterises text differently from this
  container by more than a page of it absorbs, so `e2e.yml` runs the eight behavioural width
  projects and the visual tier runs only on a dispatch that regenerates baselines.
  `npm run test:visual` is the local check; `docs/ops/TESTING.md` §3 records what would change it.
- **The browser suite needs a production build** (`E2E_PRODUCTION=1` → `next start`). A dev server
  answers `no-cache, must-revalidate` to everything, so four caching assertions could never pass in
  one. `/design-system` calls `notFound()` in a build, so its spec skips under the flag.

---

## Previous phase — Phase 44 (Vercel Deployment)

### Phase 44: what is built

**`scripts/ops/preflight.ts`** — thirteen named gates in one command. Each prints its own row
whether it passed, failed or skipped; failures sort first; a skipped gate names the phase that owns
it. Ten run today. Gate 3 is spawned as `python3` rather than through npm, so a missing interpreter
reads as a FAILED gate naming the interpreter rather than a media check that quietly did not happen.

**`scripts/ops/check-env.ts`** — presence AND shape, per environment, naming the variable and the
rule and never a value. One cross-variable rule: a preview must not carry production's WhatsApp
number.

**`scripts/docs/check-doc-contract.mjs`** — created at last (Phase 01 named it) and in
`npm run check`. Every declared variable documented, every variable the code reads declared.

**`vercel.json`** (framework, region, function limits, the seven crons), **`next.config.ts`**
(`www` → apex 308 derived from `NEXT_PUBLIC_SITE_URL`, one-host image allowlist),
**`db-migrate.yml`** extended with a `pg_dump` snapshot and a GitHub Environment on the apply path,
**`EnvironmentRibbon`** (RC-362) above the announcement bar, **`BuildPanel`** (RC-363) with the
migration-state row.

### Phase 44: what is NOT true, recorded rather than implied

| Claim the phase document makes | What is actually true |
|---|---|
| Two Supabase projects; a preview never reaches production | **One project (A42). A preview reads and writes production data.** DEPLOYMENT §1.1 lists the four consequences and what a second project would buy |
| `check-env.ts` fails a preview pointing at production | It WARNS. That comparison would fail every preview build, and a gate that always fails gets deleted |
| `migrate-staging.yml` | Does not exist. There is no staging database to push to |
| A human approval gate on production migration | Declared. GitHub protects an environment only once somebody configures a required reviewer — an owner action, DEPLOYMENT §12 |
| Both drills executed and timed | **Neither has been run and no time is claimed.** DEPLOYMENT §11.1 says why |

### Phase 44: the four owner actions

1. Create the `production-database` GitHub Environment with a required reviewer.
2. Set `IP_HASH_SALT` and `RATE_LIMIT_SALT` in every Vercel environment.
3. Disable public sign-up in Supabase Auth and create the first owner user — `auth.users` is empty,
   so nobody can sign into the production Studio today.
4. Decide whether a second Supabase project is worth its cost.

---

### Superseded — Phase 43's state

**Phase 43 — Media Coverage + Higgsfield Finalization. DEVELOPMENT COMPLETE.** Ten generation briefs
became two: six slots carried an empty `fillableBy` that Phase 07's own prose had already answered,
and two carried GENERATE where it said LEAVE_EMPTY. Final reading REUSE 15 · RECROP 6 · GENERATE 2 ·
EMPTY 3. `media_crops` (`0410`–`0411`) makes re-crop a first-class alternative to generating. All
250 alt texts rewritten from prompt fragments into sentences that pass the SEED §43 rules, in a
committed file the generator will not overwrite. Landed as PR #48.

---

---

### Superseded — Phase 41's state

**Phase 41 — Accessibility + Security. DEVELOPMENT COMPLETE.** Every response carries the header set
with a per-request nonce CSP shipping report-only; the rate-limit key became an HMAC under two
salts and five more surfaces were wired; uploads are checked against the first 4 kB of the stored
original and a refusal destroys the Cloudinary object; a data request panel and CLI give subject
access and erasure; `0390` makes WCAG 1.1.1 one CHECK. Five gates joined `npm run check`. Three
documented controls were corrected rather than left claiming more than the code does: EXIF is not
stripped, `proxy.ts` assigns no `request_id`, and the environment page carries no dependency-audit
figure. Landed as PR #47 with a follow-up regenerating the content inventory for the three new
skip-link strings.

---

### Superseded — Phase 40's state

**Phase 40 — Performance. COMPLETE.** Migrations `0380`–`0381`: `web_vitals_samples`, ten columns and
no column an identifier could go in. `perf/budgets.json` as the single source for every budget;
`measure-bundles.mjs` taking the first-load figure from the served HTML because Next 16 prints none
and the webpack analyzer cannot run against Turbopack. Three findings: no priority hint on any image
site-wide (fixed), no `Cache-Control` on Studio (fixed), and ~98 kB of section registry on every CMS
route (measured, evidenced, tracked in PERFORMANCE §4.5, not fixed). Landed as PR #46, with a
follow-up fix teaching `design:check-registry` about `components/studio/` — the gate had failed
Phase 40's first CI run by refusing a row that was true.

---

### Superseded — Phase 38's state

**Phase 38 — Environment + Documentation + Logs. COMPLETE.** Three read-only System surfaces
sharing one redactor (key, value, shape; fixed token), eight environment checks that report
reachability only, ten allowlisted documents rendered without an HTML branch, and the third log
(`system_logs`, append-only, five-minute dedupe, 90/400-day retention). Landed as PR #43 with the
`scripts/build` tracking and documentation-key fixes in PR #44.

### Superseded — Phase 37's state

**Phase 37 — Studio Analytics. COMPLETE.** The Analytics tab reads one snapshot row per metric and
computes nothing; eighteen metrics are declared once, held to FEAT §28 by test, and every one is
either a figure with `n`, a denominator and a date, or `UNAVAILABLE` with the reason named.
Migrations `0350`–`0351`; `lib/analytics/{reads,availability,snapshot}.ts` and `metrics/`;
`lib/supabase/repositories/analytics.ts`; the tab (RC-338–341); `npm run analytics:snapshot`;
`/api/cron/analytics-snapshot`; flag `advanced_analytics`; amendment A38. Readings: `selectScope`
on the policy generator; `product_scale` needs five products; `customization` reports that no
column carries it; the no-fabrication suite runs against empty reads.

---

### Superseded — Phase 36's state

**Phase 36 — Google Sheets. COMPLETE; inert until the owner's setup.** A one-way export from the
research and enquiry tables to a spreadsheet tab, built without a new dependency, a stored credential
or a read path, and proved on the last of those by a build gate. The `google_sheets` flag is off, no
service account exists, every definition is `MANUAL`, and the hourly cron answers `skipped: flag_off`.
Migrations `0340`–`0342`; `lib/sheets/` (client, atomic writer, retry, schedule, allowlist, builders
split by import, run engine); `/studio/research/sheets`; `npm run sheets:sync`;
`sheets:check-no-read`; permissions `integrations.sheets.manage` / `.run`; amendment A37. Readings:
`CRON_SECRET` (A25); the row builders are five files by import (I4); the Sheets repository is exempt
from the no-auto-import guard with two fixture cases proving a catalogue write beside it is still
refused; `0341` is the generated policy file.

---

### Superseded — Phase 35b's state

**Phase 35b — Demo catalogue + image prompt book. COMPLETE; the images wait for the owner.** The
owner-authorised placeholder catalogue is thirty-five pieces, every demo row is on the hosted
project, and `docs/ASSET_GENERATION_PROMPTS.md` holds one ChatGPT prompt per product hero and one
room scene per furniture piece, each with its planned asset ID, exact slot and `WAITING_FOR_UPLOAD`
status. Amendment A36 records the rule that makes the imagery honest: a concept visualisation,
registered and labelled as one, never presented as a photograph.

`scripts/demo/content.ts` (35 products), `scripts/demo/build-sql.ts` (`npm run demo:sql`), the
regenerated register, the prompt book (45 entries, `PRODUCT-HERO-NNN` / `PRODUCT-SCENE-NNN`,
`rivya/product/<slug>`), amendment A36. Hosted: 35 products, 10 article bodies (7 published),
6 DRAFT projects, 6 DRAFT testimonials. Readings: category heroes and journal covers are not in the
book (the library binds them); product images go to `rivya/product/<slug>`; the hosted seed went
through SQL because the seeder needs a direct connection this environment does not have.

---

### Superseded — Phase 35's state

**Phase 35 — Shortlist + Confirmation. COMPLETE-WITH-FLAG-OFF.** The pipeline has its workspace
(why a row was shortlisted, the decision note behind a confirmation, two screens a merchandiser sits
in front of) and its gate (the stage-writer trigger). The one hand-operated bridge to an empty draft
product is built, proved to copy nothing, and switched off until the owner accepts amendment A35 by
enabling `research_product_bridge`.

### Phase 35: what is built

**Migrations `0330`–`0331`, no enum change.** `research_shortlist_entries`, `research_confirmations`
(`created_product_id` with no foreign key), `guard_research_stage_writer()` verbatim,
`research_write_stage()` (SECURITY DEFINER, service role only — the flag and the write share a
transaction because PostgREST gives the repository none). `0331` generated.

**Code.** `MOVEMENTS` + `InvalidStageTransitionError` in `lib/scraper/core/stage.ts`;
`review-actions.ts` (Shortlist opens an entry, Confirm needs a decision note and admits only a
shortlisted row, `returnToReview`, `archiveDecision`); `lib/bulk/operations/research/
{close-entry,archive-confirmation}.ts` and the five Phase 29 operations rerouted through
`moveStage` / `setDisposition` with their own `undoItem`; `RESEARCH_BULK_CAP = 200`;
`lib/supabase/{schemas,repositories/research}/…shortlist.ts`; `/studio/research/shortlist`,
`/studio/research/confirmed` (+ `confirmed/actions.ts`, the bridge), `PipelineBulkBar`,
`StartProductDialog`, the decision note on `RowActionBar`; `scripts/research/bridge-isolation.mjs`
under I4 and the `insertProduct` carve-out in `check-no-autoimport.mjs`; flag
`research_product_bridge = false`; seeded acknowledgement copy.

### Phase 35: readings the repository forced

1. **The flag needs a function** — `research_write_stage()` carries `rivya.stage_transition` under
   PostgREST; the trigger is verbatim and defines nothing.
2. **Bulk operations go through the machine** — the engine's generic snapshot restore would be
   refused by the trigger, so every research operation supplies its own `undoItem`.
3. **Confirm from REVIEW is refused with a sentence**, not silently left where it was: the
   movement table admits only `SHORTLISTED → CONFIRMED`.
4. **The RLS tests that updated `stage`/`disposition` directly** now set the flag in their own
   transaction (`phase25`) or call `research_write_stage()` (`phase29`); `phase35` proves the bare
   update is refused.
5. **`stage-guard-trigger.test.ts` lives in the RLS project** (`tests/unit/rls/phase35.test.ts`,
   describe block of that name): it needs a database and the unit project is offline by gate.
6. **The claim comes first** — `markProductStarted` is conditional on nothing started before, so a
   double click starts one product; a failed insert releases the claim.

### Phase 35: verification, as actually run

`npm run check`; the unit project including `pipeline-transitions`, `confirmation-no-import`,
`research-isolation` (bridge fixtures), `review-actions`, `bulk-engine`, `research-selection`,
`research-no-autoimport`; the RLS project with `RLS_TESTS_REQUIRED=1` including `phase35.test.ts`;
production build through the local PostgREST shim; `security:check-bundle`. Counts in
`docs/PHASE_31_TO_46_IMPLEMENTATION.md` §Phase 35.

### Phase 35: hosted parity

`0330`–`0331` applied to `ccvarsmzickdkryoakdg` with ledger rows; digest recorded in the
implementation document.

### Superseded — Phase 34's state

**Phase 34 — Product Direction Tool. COMPLETE.** Research becomes a written internal brief with the
evidence stapled to it; the tool writes no prose, the brief cannot be published or become a product,
and observed figures never render without their coverage and the words "observed in competitor
research".

### Phase 34: what is built

**Migrations `0320`–`0321`.** The brief (four statuses, checked category slug, no price/dimension/
material column, approval trigger), its evidence (rationale required, volatile kinds captured by
value), its revisions (SECURITY DEFINER trigger, status-preserving restore RPC).

**Code.** `lib/scraper/analytics/direction/{capture,export}.ts`, `lib/supabase/schemas/research-direction.ts`
(`.strict()`, four statuses), `lib/supabase/repositories/research/direction.ts` (reads of every
evidence target by select; no products import), the two routes and `actions.ts`, `EvidenceRail`,
`ObservedFigures`, `BriefStatusButton`, `print.css`, `npm run research:direction-export`;
`scripts/research/direction-isolation.mjs` under I4.

### Phase 34: readings the repository forced

1. **A checked slug, not a third key** (open question 13 → A34).
2. **Approval as a trigger** — the policy generator writes one predicate per leg.
3. **The harness rolls a session back**, so the RLS suite reads back inside the callback.
4. **A leaf of its own, because the manifest test governs every static route** (A34).

### Phase 34: verification, as actually run

`npm run check`; unit project including `direction-{no-publish,isolation,evidence-capture}`; RLS
project with `RLS_TESTS_REQUIRED=1` including `phase34.test.ts` (9 cases); production build through
the local PostgREST shim; `security:check-bundle`.

### Phase 34: hosted parity

`0320`–`0321` applied to `ccvarsmzickdkryoakdg` with ledger rows; digest recorded in the PR.

### Superseded — Phase 33's state

**Phase 33 — Visual Similarity, the first-party half. COMPLETE; competitor images are never fetched
(owner decision, amendment A33).** Rivya's own library is hashed, a re-upload of one of its pictures
is refused at the upload step by name, and the Studio page renders the band legend with its "does
not mean" column above everything and `PRECISION NOT YET MEASURED` beside every band.

### Phase 33: what is built

**Migrations `0310`, `0311`, `0313`** (`0312`, embeddings, allocated and unused). The research tables
exist and hold no rows; `media_asset_hashes` is first-party, in its own file, never joined.

**Pure hashers.** `lib/scraper/analytics/similarity/`: dHash, DCT pHash, Hamming, the band table,
seven-segment blocking (NEAR_DUPLICATE recall 1.0 by pigeonhole, measured against brute force on
every test run). Fixture distances are measured: a 10 % centre crop is 8 on the synthetic scene.

**The upload guard.** `lib/media/hashes.ts` (the ONE decoder module — `media:check-decoder` gate),
`lib/media/duplicate-guard.ts` (two injected reads, compared in TypeScript), wired into
`saveUploadedAssetAction` before the insert; refusal destroys the object and audits DENIED.

**Studio.** `/studio/research/similarity`: decision, flags, legend, coverage, library self-check
(`research.similarity.run`), run history. `npm run media:hash`, `research:similarity`,
`research:similarity-sample`; `.github/workflows/media-hash.yml`.

### Phase 33: readings the repository forced

1. **The owner declined the fetch-to-hash amendment** — the schema stays level; the fetcher is not
   built (A33).
2. **A 16-bit prefix cannot meet the document's own recall bar**; seven segments can, by
   construction.
3. **The guard's reads must be the service role's**, or an editor's upload would skip the research
   comparison.
4. **This container cannot reach Cloudinary**, so the 250-asset backfill is a dispatch-only
   workflow the owner runs; the Studio panel shows coverage until then.

### Phase 33: verification, as actually run

- `npm run check` green (now including `media:check-decoder`).
- Unit project including `similarity-{phash,bands,blocking,legend,decoder-scope}` and
  `media-duplicate-guard`; RLS project with `RLS_TESTS_REQUIRED=1` including
  `tests/unit/rls/phase33.test.ts` (13 cases).
- Production build through the local PostgREST shim; `security:check-bundle` clean.

### Phase 33: hosted parity

`0310`, `0311`, `0313` applied to `ccvarsmzickdkryoakdg` with ledger rows; digest recorded in the PR.

### The next exact action

**Phase 34 — Product Direction Tool.** `0320`–`0321`, the nine-section brief with captured
evidence, no PUBLISHED status, `research.direction.write` / `.approve`.

---

### Superseded — Phase 32's state

**Phase 32 — Opportunity Engine. COMPLETE, WITH NO MODEL ACTIVE.** Rivya has a ranked view of where
the market looks under-served, and anyone can see exactly why a row is where it is: a score is the
weighted mean of seven declared signals under a versioned model, every stored score keeps one
component row per signal, and the drawer's footer reproduces the total from those rows.

**Nothing is ranked, because nothing has been fetched and v1 is a DRAFT.** Activation is an owner
or admin's act on `/studio/research/opportunities`; the nightly cron answers
`skipped: no_active_model` until then. That is the shipped state, not a gap.

### Phase 32: what is built

**Migrations `0300`–`0302`.** `research_scoring_models` (lifecycle, one ACTIVE, the immutability
trigger verbatim), `research_opportunity_scores`, `research_opportunity_components`
(`included = (normalised is not null)`), and v1 seeded DRAFT as configuration.

**The formula, once.** `lib/scraper/analytics/opportunity/score.ts`; printed verbatim in SCRAPER
§23; a worked example with hand-written literals in `tests/unit/opportunity-score.test.ts`.
`large_format_fit` resolves all 24 category × flag cells with no default (exhaustive test).

**The first-party side is read, never joined.** `buildScoringContext()` selects `products` and
`materials` and hands counts and a token set to the signals; the comparison happens in TypeScript.
The no-auto-import guard still holds.

**Studio.** `/studio/research/opportunities`: provenance header, Scored / Insufficient-data tabs,
Explain drawer, exclusions panel, model panel (owner, admin) with the rank-movement diff before the
Activate button. `npm run research:score` with `--explain`; `app/api/cron/research-score` at
03:15 UTC; `npm run research:check-no-ml` in `check` and CI, proved to fail on a fixture.

### Phase 32: readings the repository forced

1. **A seeded model has no author.** `created_by` is nullable (A32).
2. **The diff needs no scan.** Normalisation lives in code; only weights differ between versions, so
   the rank movement is computed from stored components.
3. **A row with no band still has a density answer.** Unpriced rows fall in `(category, none)`;
   the worked example's second case was corrected to that reading.

### Phase 32: verification, as actually run

- `npm run check` green (now including `research:check-no-ml`).
- Unit project — see the PR for counts; RLS project with `RLS_TESTS_REQUIRED=1` including
  `tests/unit/rls/phase32.test.ts` (8 cases: seeded v1, I2, weights CHECK, one ACTIVE, the trigger
  naming the version, owner may draft and researcher may not, owner refused a score insert,
  excluded ≠ zero at the row).
- Production build through the local PostgREST shim; `security:check-bundle` clean.

### Phase 32: hosted parity

`0300`–`0302` applied to `ccvarsmzickdkryoakdg` with ledger rows; digest recorded in the PR.

### The next exact action

**Phase 33 — Visual Similarity, first-party half.** The owner's decision: competitor images are
referenced by URL only and never fetched. Pure hashers, `media_asset_hashes`, the upload duplicate
guard, the backfill of the 250 manifest assets.

---

### Superseded — Phase 31's state

**Phase 31 — Analytics + Comparison. COMPLETE.** The research corpus is measurable, and every
measurement carries its own error bars: three pure analyses — assortment, price architecture,
dimensions — each returning a coverage record (`n`, denominator, percentage, and a count per reason
for every row it could not use) beside its result. `/studio/research/compare` holds named sets a
person builds and recomputes; the dashboard states per-source coverage above everything else.

**Nothing is measured, because nothing has been fetched.** There are still no approved sources, so
every panel renders its empty state and `research_analytics_snapshots` holds only what the unit and
RLS suites wrote and removed. What exists is the machinery, proved against hand-computed fixtures
and against the database.

### Phase 31: what is built

**Migrations `0290`–`0292`.** `research_comparison_sets` and `research_comparison_members` (a
person's workspace, `research.write`), `research_analytics_snapshots` and
`research_metric_coverage` (the machine's record, **no session write policy of any kind**),
`is_strictly_ascending_bigint_array()` (a CHECK may not hold a subquery) and
`tg_research_comparison_set_prune_snapshots()` (a deleted set takes its history with it, because
`scope_id` names a set, a source or a category and cannot carry a foreign key to three tables).

**The coverage record is the contract.** `n + Σ excludedReasons = denominator`, seven reasons and no
eighth, `coverage_pct` GENERATED so the stored percentage cannot disagree with its integers, zero
over zero as 0 %. Below twelve usable rows a panel withholds every percentile and says
INSUFFICIENT SAMPLE.

**Currencies are never mixed, at three layers.** `computePriceArchitecture` throws
`MixedCurrencyError`; `snapshotScope` splits by currency first and writes one price snapshot per
currency; `currency` is part of the snapshot's unique key and required on a price row by CHECK, so
a combined figure has no key to live under. Quote-only rows are counted, never imputed as zero; a
range's comparable point is its lower bound.

**Three writers, one function.** `snapshotScope()` in `lib/scraper/workflows/analytics.ts` is
reached by `npm run research:analytics --snapshot`, by `app/api/cron/research-analytics` (02:30
UTC, `CRON_SECRET` per A25) and by the Studio Recompute action, which reads the rows as the person
and writes the snapshot as the system with `computed_by` recording who asked. Nothing recomputes on
page load.

**Charts are four token-only inline-SVG patterns** — `BarSeries`, `BandStrip`, `Scatter`,
`Sparkline` — each `role="img"` with a data table rendered from the same array, and no chart
library. They live at `components/patterns/<Name>/index.tsx` because that is the only path the
registry gate resolves (amendment A31).

### Phase 31: what is NOT built, and why

- **Any score, rank or opportunity statement.** Phase 32.
- **Currency conversion.** No rate source exists; inventing one fabricates every figure computed
  from it. Multi-currency sets render one panel per currency and no total.
- **The Studio Analytics tab and first-party metrics.** Phase 37 presents this computation beside
  first-party figures.
- **Any public surface.** I3 holds; the isolation guard's allowlist still holds exactly two.

### Phase 31: readings the repository forced

1. **`z.record` with an enum key is exhaustive in Zod 4.** The coverage schema uses
   `z.partialRecord`, or every record would have to name all seven reasons.
2. **A quantile edge at the minimum defines an empty band beneath it.** Edges at or below the
   minimum are skipped, as repeated edges are; a set whose prices all agree gets no edges and one
   band, which is the honest output.
3. **The registry gate, not the phase document, decides where a pattern lives.** Recorded as A31.

### Phase 31: verification, as actually run

- `npm run check` — green.
- Unit project — **154 files / 2,497 tests**, with no database.
- RLS project — **24 files / 545 tests** with `RLS_TESTS_REQUIRED=1`, against the migrated and
  seeded database, including `tests/unit/rls/phase31.test.ts` (13 cases: I2 on all four tables, the
  owner refused a snapshot insert, one target per member, the FIXED/QUANTILE edge rule, no key for
  a combined-currency price row, generated coverage, the prune trigger).
- `db:check-migrations` (85 migrations up to `0292`), `db:check-schema` (84 tables),
  `db:check-types`, `auth:check-policies`, `auth:check-rls` (84 tables, 276 policies),
  `research:check-isolation` — green.
- Production build against the seeded database through a local PostgREST, then
  `security:check-bundle` clean.

### Phase 31: hosted parity, measured rather than assumed

`0290`–`0292` are applied to `ccvarsmzickdkryoakdg` with ledger rows carrying the local files'
SHA-256 (85 rows on both). A structure digest over the four new tables — 40 columns, 37
constraints, 13 indexes, 10 policies, the two function bodies and the trigger, **103 objects** —
returns `9acc01582bfdada9d66d76252f60c3af` on both databases when both are read with
`search_path = public, extensions`. Read without it, local prints the `citext` operator
schema-qualified and the digest differs for that reason alone — the same lesson Phase 28 recorded.
The security advisor reports nothing new for the phase: the two functions revoke EXECUTE from
`public` and `anon`, and the only findings are the pre-existing Phase 20 inquiry functions.

### The next exact action

**Phase 32 — Opportunity Engine**: seven declared signals, a weighted mean a person can recompute by
hand, versioned models with an immutability trigger, and `INSUFFICIENT_DATA` where the inputs are
too thin.

---

### Superseded — Phase 30's state

**Phase 30 — Large-Format Research Workspace. COMPLETE.** The research subsystem now answers the
question Rivya actually cares about: SEED §56 puts large-format furniture first in the content
hierarchy, and `/studio/research/large-format` gives the same priority to research — a workspace
over the rows that are large by a stated, editable rule, with honest coverage figures for the rows
whose dimensions could not be read.

**Nothing is classified, because nothing has been fetched.** There are still no approved sources, so
`research_products` is empty and every panel renders its empty state. What exists is the machinery,
proved against fixture tables, against the database, and end to end against a live fixture source
that was deleted afterwards.

What it is NOT is a market analysis. Rivya has no published products, so a comparison against its
own catalogue would be an artefact of an empty catalogue wearing the clothes of a finding.

### Phase 30: what is built

**Migrations `0280`–`0281`.** Six columns on `research_products` (`scale_band`, `is_large_format`,
`longest_axis_mm`, `large_format_source`, `classified_at`, `classified_rule_id`),
`research_large_format_rules` with five ordered rules seeded as configuration, and
`research_saved_views`.

**`is_large_format` is three-valued, and the null means "we have no measurement".** A boolean would
force a row whose dimensions could not be parsed to `false`, and every distribution built on the
column would then under-report large work in proportion to how badly a source writes its pages — a
failure that looks exactly like a finding. The constraint
`research_products_unmeasured_has_no_verdict` refuses a verdict on an unmeasured row, and the
override action refuses it in a sentence before the constraint has to.

**Coverage is stated before anything is drawn from it.** The banner renders above every panel, each
panel takes a REQUIRED coverage prop, zero rows in scope reads as 0 % rather than 100 %, and no panel
drops the unknown bucket or an empty band. Price panels group by currency, have no field for a
combined total — a shape that cannot express the wrong answer — and count quote-only rows rather
than dropping them.

**An editor override is permanent.** `large_format_source = 'EDITOR'` freezes the row and
`research:reclassify-scale` skips it and REPORTS the skip, because somebody editing the rules needs
to know how many rows their edit did not reach.

**`research_saved_views` is the first owner-scoped research table.** Five of the six roles hold
`research.read`, so the scope carries the security rather than the permission; sharing is a second
SELECT policy rather than a widened scope. No admin client touches that table anywhere.

**The gap panel reports research coverage and says so in its heading** — no comparison with Rivya's
catalogue, no score, no opportunity language, asserted by a test that reads the component.

**Row selection, and the one bulk engine.** `/studio/research/large-format` and
`/studio/research/changes` now carry checkboxes, the Phase 24 toolbar and the Phase 29 action bar.
Neither screen implements any of that machinery: a Server Action parses the form and calls
`previewBulkOperation` / `applyBulkOperation`, and the single-row controls call the same Server
Actions the queue calls — Phase 29 wrote them to accept a bare product id for exactly this case. On
the queue the checkbox carries the PRODUCT id, because the five operations target a product and a
queue row is one field's movement on one of them.

**I3 bans the scale identifiers rather than the words.** `scale_band`, `scaleBand`,
`large_format_source` and `largeFormatSource` may not appear on a public surface; "dining" and
"console" obviously may, and `products.is_large_format` is a first-party column the public Large
Format page reads.

### Phase 30: what is NOT built, and why

- **Any comparison with Rivya's catalogue, and any opportunity or gap score.** Phases 31–32, after
  there is something to compare against.
- **A dimension inferred from a category, a price, an image or a name.** `UNKNOWN` stays `UNKNOWN`.
- **Selection on `/studio/research/explorer`.** It keeps the named unavailable state, which is still
  true there; Phase 30's document extends the explorer with filters and the saved-view control, not
  with a selection.
- **Visual similarity, product direction, the shortlist workspace, a Sheets export.** Phases 33–36.
- **Any public surface.** `is_large_format` on a research row and `products.is_large_format` on a
  Rivya row are different columns in different worlds, and the isolation guard proves it.

### Phase 30: three readings the repository forced

1. **The null verdict belongs to the MEASUREMENT, not to the band.** The first draft tied it to
   `scale_band = 'UNKNOWN'` in both the classifier and the CHECK constraint, and the phase document's
   own four verification rows caught it: a well-measured 1 150 mm piece whose proportions match no
   band signature is banded `UNKNOWN` and its size is perfectly well known. Recorded as amendment
   **A30**.
2. **A saved view needs an owner scope, not a permission.** Five of the six roles hold
   `research.read`; without `owner_user_id = (select auth.uid())` any of them could rewrite everyone
   else's views. That is also why sharing is a second SELECT policy: it widens who may READ a row and
   must not widen who may edit it.
3. **The change queue's checkbox is the product, not the change.** Selecting the change id would hand
   the engine ids that do not exist in `research_products`, and every row would preview as
   `row_not_found` — a failure that reads like missing data rather than like a wrong column.

### Phase 30: verification, as actually run

- `npm run check` — green, all twenty gates.
- Unit project — **144 files / 2,415 tests**, with no database.
- RLS project — **23 files / 532 tests** with `RLS_TESTS_REQUIRED=1`, against the migrated and
  seeded database.
- `db:check-migrations` (82 migrations up to `0281`), `db:check-schema` (80 tables),
  `db:check-types`, `auth:check-policies` (all four generated files match the matrix),
  `auth:check-rls` (80 tables, 266 policies), `research:check-isolation` (all four invariants
  against the database) — green.
- Both new guards proved to FAIL before being trusted: the surface allowlist relaxed to a prefix
  check, and the queue's checkbox switched to the change id.
- `research:reclassify-scale` proved end to end against a live fixture source: 2 100 mm → DINING and
  large, 900 mm → COFFEE and not large, AMBIGUOUS → UNKNOWN with no verdict, and an overridden row
  surviving a threshold raised past it and reported as skipped. The fixture source was deleted
  afterwards; `research_products` is back to zero rows.
- Production build against the seeded database through a local PostgREST, then
  `security:check-bundle` clean.

### Phase 30: hosted parity, measured rather than assumed

`0280` and `0281` are applied to `ccvarsmzickdkryoakdg` as well as locally, and the two databases
were compared rather than trusted. A structure digest over the two new tables and the six new
`research_products` columns — their types, nullability and defaults, sixteen constraint definitions,
eight indexes, nine policies and the five seeded rules, **67 objects** — returns
`29db158ed7d559a2769b50f2e35b804f` on both.

The hosted apply used a comment-stripped copy, and the stripper was PROVED for these two files
before it was trusted: two throwaway databases were built from the full 82-migration chain, one with
the files as written and one with the stripped copies substituted, and the same digest came back
from both — and from the working local database. That is the check that caught the stripper's first
version during Phase 29, when it collapsed blank lines inside three function bodies.

Behaviour on hosted: five seeded rules, all PUBLISHED and enabled; row security on both new tables;
**not one `anon` policy** on either (I2); `research_products` still empty, so nothing is classified;
and both ledger rows carry the local files' SHA-256, so `db:migrate` sees the two databases at the
same version — 82 rows each.

### The next exact action

**Phase 31 — Analytics + Comparison**, the first phase that reads across sources rather than within
one. It is also the phase that inherits the honesty rule this one established: every figure states
its coverage, and a comparison Rivya cannot make honestly is not made.

---

### Superseded — Phase 29's state

**Phase 29 — Change Detection + Review. COMPLETE.** The research subsystem is now useful OVER TIME
rather than at a point in time: a page Rivya has already read says something different, the
difference is classified against a stated rule, and a person decides what it means.

**Nothing has changed, because nothing has been fetched.** There are still no approved sources, so
there are no versions to diff and the change queue is empty. What exists is the machinery, proved
against fixture tables and against the database.

The governing sentence, and the reason almost every decision below went the way it did: **changes
are never automatically imported into Rivya products.** They are never automatically imported into
anything.

### Phase 29: what is built

**Migrations `0270`–`0271`, applied locally.** Seven tables in three postures, and the posture
answers one question — who may write:

- **DETECTED BY THE SYSTEM** — `research_changes`, `research_change_digests`. No write policy for
  any role, owner included. A change row a session could insert is a competitor price move somebody
  invented, arriving in a merchandiser's queue looking exactly like a real one.
- **DECIDED BY A PERSON** — `research_review_actions`, `research_notes`, `research_product_tags`.
  `research.confirm`, insert-only at the policy and append-only at a TRIGGER — which is the part
  that matters, because a policy stops PostgREST and a trigger stops the service role too.
- **CONFIGURED BY A PERSON** — `research_change_rules`, `research_tags`. `research.write`, the same
  posture as the material lexicon: a threshold is a parsing decision about somebody else's page.

**Diffs are version-to-version, never against the mutable current row**, and both snapshot keys are
stored. That is what makes a change record reproducible from evidence years later, after the rule
that produced it has been edited twice and the page no longer exists.

**Materiality is a stated rule with three levels**, per-source thresholds, and a Studio editor.
`NOISE` is recorded, hidden by default and never counted. Four of the eleven rules exist for a
named failure: a price STATE change overrides the percentage rule; the LARGEST axis decides a
dimension move rather than the average; an image is identified by its URL PATH; lists are compared
as SETS.

**The nine FEAT §25 actions**, each writing three things in an order chosen for what a crash between
any two leaves behind — the append-only log first, the domain effect second, the queue's stamp last.
Two clients, deliberately: the action row and the note as the PERSON so RLS judges them again, the
stage move and the stamp as the SYSTEM because those tables have no session write policy at all.

**Bulk review runs on the Phase 24 engine**, which is exactly what Phase 24's unavailable
registration was for. A new `extraPermission` field on the operation contract carries
`research.confirm`, so a researcher holding `bulk.execute` cannot reach in bulk what they cannot
reach one row at a time.

### Phase 29: what is NOT built, and why

- **No Rivya product is ever created, drafted or pre-filled from a research row** — permanently, by
  four independent guarantees plus a database-level test.
- **No image is fetched, hashed or compared visually.** An image change is a change to the URL SET.
- **The shortlist workspace** beyond the stage transition is Phase 35's.
- **Cross-source correlation** ("three sources raised prices this week") is Phase 31's analytics
  question, not a detection one.
- **No email, WhatsApp or push notification.** The digest is a Studio surface; outbound
  notification is Phase 38's decision and its consequences are not this phase's to take on the side.
- **The change queue has no row selection yet**, so the bulk toolbar stays in its named unavailable
  state on that screen while the five operations are live in the engine. Selection is Phase 30's
  workspace work.

### Phase 29: three readings the repository forced

1. **`unique (source_id, field)` does not make the global default unique**, because null is not
   equal to null. The phase document's constraint would have permitted any number of default rows
   for `price`, and the threshold in effect would then depend on which row the resolver read first —
   a bug that cannot be reproduced on demand. It ships as `unique nulls not distinct`.
2. **The append-only DELETE trigger made `research_sources` undeletable.** Deleting a source
   cascades to its products and thence to their decisions, and the trigger refused the cascade. The
   rule is now stated precisely — a decision about a row may not be erased WHILE THAT ROW EXISTS —
   and a cascade is distinguished by whether the parent is still visible, which it is not during
   one. Found by the RLS suite failing to clean up after itself, which is the cheapest possible
   place to find it.
3. **The threshold editor is on `/studio/operations/data-quality`, not `/studio/system/settings`.**
   The phase document places it on the settings page, which is gated on `system.settings.write` —
   held only by an owner and an admin. A threshold is `research.write`, and a researcher is exactly
   who notices a source flooding the queue. Following the document would have put the control
   behind a permission its user does not have.

### Phase 29: verification, as actually run

- `npm run check` — green, including the new `research:check-no-autoimport` gate.
- Unit project — **140 files / 2,343 tests**, with no database.
- RLS project — **22 files / 515 tests** with `RLS_TESTS_REQUIRED=1`, against a freshly recreated,
  migrated and seeded database.
- `db:check-migrations`, `db:check-schema`, `db:check-types`, `auth:check-rls`,
  `research:check-isolation` — green against that database.
- The no-auto-import gate proved to REFUSE a `products` write and a first-party write import from a
  fixture tree, and to PERMIT the allowlisted taxonomy read.
- Production build against the seeded database through a local PostgREST, then
  `security:check-bundle` clean.

### Phase 29: hosted parity, measured rather than assumed

`0270` and `0271` are applied to `ccvarsmzickdkryoakdg` as well as locally, and the two databases
were compared rather than trusted. A structure digest over the seven tables' columns, constraints,
indexes, policies, the two trigger functions and the two triggers — **147 objects** — returns
`e6dc835ab9fbdd8de0ddfc5ab9bb9079` on both.

The hosted apply used a comment-stripped copy, and the stripper was PROVED before it was trusted:
the stripped migrations were applied to a throwaway database and digested against one built from
the files as written, and the only differences were the `schema_migrations` ledger that `db:reset`
creates and the raw psql loop does not. A first version of the stripper collapsed blank lines
globally and changed three function bodies — harmless to behaviour, still a textual difference
between local and hosted, and exactly what the digest exists to catch; it now preserves every
dollar-quoted region byte for byte.

Behaviour on hosted: eleven seeded global defaults, all PUBLISHED; the unique constraint carries
`NULLS NOT DISTINCT`; `research_changes` has exactly one policy and it is a SELECT; not one `anon`
policy exists on any of the seven (I2); and both ledger rows carry the local files' SHA-256, so
`db:migrate` sees the two databases at the same version.

---

### Superseded — Phase 28's state

**Phase 28 — Normalization + Validation. COMPLETE.** The strings Phase 27 extracted are now
comparable data, and the data is judged before it is trusted. Three of FEAT §23's seven stages ship:
`NORMALIZED`, `VALIDATED`, `MATCHED`.

**Nothing has changed about what is fetched: still nothing, still behind the same three gates.**
There are no sources, so there is nothing to normalise. What exists is the machinery, proved against
fixture tables and against the database.

The governing sentence, and the reason almost every decision below went the way it did: **a value
Rivya could not parse is recorded as unparsed, never as a guess.** Every downstream comparison, scale
band, opportunity score and shortlist decision inherits that first judgement, and none of them can
tell a guessed figure from a read one.

### Phase 28: what is built

**Migrations `0260`–`0261`, applied locally.** Twenty-three normalisation columns on
`research_products`; `research_validation_issues`, `research_match_candidates` and
`research_material_lexicon` (forty seeded terms); `research_products_matched_category_fk` — the
**second and final** allowlisted research → public foreign key, which closes the allowlist; two
IMMUTABLE predicate functions; a rewritten `refresh_research_search_document`; and a trigger so a new
version reindexes its product.

**The normalizer is pure.** `lib/scraper/normalization/` — `schema`, `currency`, `units`,
`dimensions`, `materials`, `availability`, `lexicon`, `index` — takes a draft, a source's
configuration and a lexicon and returns a value. No I/O, no clock, no database. That is what makes
every rule a fixture table and what makes `research:renormalize` possible with zero network traffic.

**No currency conversion exists anywhere under `lib/scraper/`**, asserted by a test that reads every
file in the tree. `$` alone is `AMBIGUOUS`. Amounts are integer minor units read with the source's
own separators.

**`AMBIGUOUS` stores nothing** — `dimensions_mm` is null unless the parse state is `PARSED`.

**Eleven validation rules, all reachable, all evaluated before the write.** The database constraints
are backstops for a hand-written `UPDATE` and nothing else; a failing row is written, kept at
`VALIDATED` with its findings attached, and counted.

**Matching proposes, never decides.** Three tiers, auto-merge only on the source's own identifier, on
an identical title-and-price, or on a title above 0.95 with measurements agreeing within 5 %.
Everything else is a merchandiser's decision, and every duplicate flag is reversible and audited.

**`workflows/promote.ts` moves one stage per pass**, each transition through `core/stage.ts` and each
recorded as a pipeline event.

**Studio.** `/studio/research/explorer` (raw beside normalised beside provenance, filters in the URL,
`?row=<id>` drawer, permission-gated correction and duplicate controls);
`/studio/operations/data-quality` with a Research tab and the lexicon editor; a third command-palette
provider for *Scraped Products*.

**`scripts/research/renormalize.ts`** — the second of the three offline recomputation scripts, and it
never overwrites a hand-corrected field.

### Phase 28: what is NOT built, and why

- **Change detection between versions.** Phase 29. This phase normalises each version; it does not
  compare two.
- **Cross-source deduplication.** Out of scope permanently at this layer: two competitors listing
  similar objects is the signal Phase 31 reads, and collapsing them destroys it.
- **Currency conversion.** Never, without a dated rate source and an owner decision.
- **`brand_text` from the pipeline.** `RawProductDraft` has no brand field, and the two derivations
  that suggest themselves — the first word of a title, the source's own name — are both fabrications
  about somebody else's business. The column is filled by hand until a phase adds brand to the draft.
- **A saved-view or bulk action on the explorer.** Phases 29 and 30; the bulk toolbar is still
  registered in its unavailable state.

### Phase 28: verification, as actually run

- `npm run db:reset` → 77 migrations applied to an empty database; `npm run seed:content` clean.
- `npm run db:check-schema` → 71 tables, RLS on all, column tiers correct.
- `npm run db:types` → 70 tables, 33 enums, 42 callable functions.
- `npm run auth:check-rls` → 71 tables, 240 policies, every staff-select list matching the matrix.
- `npm run research:check-isolation` → I1 allowlist holds **2**, I2 no anon policy in the migrations
  **and in the database**, I3 and I4 clean.
- `npm run db:check-migrations` → 77 migrations up to `0261`, every number allocated in DATA_MODEL §12.
- `npm run test` → **155 files, 2,727 tests, all passing, none skipped**, including six new
  normalisation suites and `tests/unit/rls/phase28.test.ts` (38 cases) run against the database.
- `npm run check` → all 33 gates green, including `db:check-data-layer`, which caught thirteen
  queries outside the repository layer and forced them all into it.
- `npm run build` → production build succeeds against a local PostgREST, with
  `/studio/research/explorer` and `/studio/operations/data-quality` both present.

### Phase 28: the D9 ten, recorded

1. Code exists and is committed — two migrations, eight normalisation modules, two validation
   modules, two workflows, five repositories, the re-normalisation script, three Studio surfaces, a
   command-palette provider, six unit suites, one RLS suite, one e2e spec.
2. Migrations applied locally **and to the hosted project**, with ledger rows carrying the files'
   real SHA-256 checksums. Hosted now reads 77 ledger rows / 71 tables / 240 policies / 40 lexicon
   terms — level with local on every figure. See the parity note below.
3. Tests written and passing: 2,727, none skipped.
4. Gates pass, including `research:check-isolation` with its now-closed two-entry allowlist.
5. Documentation updated: SCRAPER §19, DATA_MODEL §12 and the vocabulary table, STUDIO_GUIDE §12.5
   and §13.2, CANONICAL-DECISIONS **A28**, CHANGELOG, PROJECT_STATE, this file.
6. No business fact fabricated: no competitor, brand, domain or price anywhere. The lexicon's forty
   terms are words to recognise on other people's pages, never a claim about what Rivya makes.
7. Nothing in the manifest regenerated; no competitor image fetched — `image_urls` are strings.
8. Remaining issues documented — see "what is NOT built" above.
9. The next phase is named: **29 — Change Detection + Review**.
10. Hosted is level with the repository through `0261`.

### Phase 28: three defects found and fixed rather than worked around

- **`array_length` on an empty array is NULL, and a CHECK evaluating to NULL passes.**
  `research_material_lexicon_has_patterns` admitted exactly the row it was written to refuse. Found
  by an RLS test asserting the refusal rather than assuming it; now `cardinality(patterns) >= 1`.
- **A CHECK constraint may not contain a subquery**, and the phase document's illustrative SQL uses
  one twice. Two IMMUTABLE functions carry what the constraints cannot.
- **`image_url_unreachable_shape` was written to catch shapes the draft schema already refuses**,
  which would have made the rule unreachable — this phase's own named risk, arrived at from the
  inside. It now catches what actually survives that filter: a reference a broken template built.

### Phase 28: hosted parity, measured rather than assumed

The two migrations were transcribed into `mcp__Supabase__apply_migration` with their `--` and
`/* */` comments stripped — **and the stripper was itself proved** before it was trusted: the
stripped files were replayed into a scratch database alongside every other migration, and a
structure digest over 2,514 objects (columns, constraints, policies, function definitions, indexes,
comments, triggers) came back byte-identical to the database the originals produce.

Compared against local afterwards, with the same `search_path` on both:

| Category | Objects | Result |
|---|---|---|
| Columns | 1,068 | identical |
| Constraints | 552 | identical |
| Indexes | 307 | identical |
| Policies | 240 | identical |
| Triggers | 108 | identical |
| Function bodies | 95 | identical once comments and whitespace are removed |
| Table/column comments | 144 | 143 identical, 1 pre-existing difference |

**Phase 28's own objects are byte-identical**: all four functions (same md5 AND same length), all 37
constraints on the three new tables plus `research_products`, and all 11 comments.

**Two pre-existing drifts were found and are recorded rather than fixed**, because neither is this
phase's and neither changes behaviour:

- **Eighteen function bodies from Phases 08–25 carry their inline comments on local and not on
  hosted** — an earlier session's hosted apply stripped them. The executable SQL is identical: with
  comments and whitespace removed, all 95 function bodies hash the same on both databases
  (`926fa225…`).
- **`inquiries.pipeline_status`'s comment differs by one character**: local reads "DATA_MODEL §1.4",
  hosted reads "DATA_MODEL 1.4". The section sign was lost in Phase 20's apply.

Both would be closed by re-applying the affected migrations with their comments intact. Neither
affects a query, a constraint, a policy or a type, so neither is worth a migration of its own — a
phase that touches one of those functions for another reason should carry the comments back.

### Phase 28: a CI failure fixed in the same branch, and it was Phase 26's

`main` had been RED since Phase 26 merged — through three merges — and the reason was in this
session's own code rather than anywhere near Phase 28.

`.github/workflows/ci.yml` runs `npm run test:unit` as **step five, before `db:reset`**, and sets
`DATABASE_URL` for the whole job so the database gates further down can use it. The workflow says in
as many words that the unit project must therefore need no database. Phase 26 added two files that
did: `tests/unit/source-health.test.ts` and the SQL half of `tests/unit/source-schedules.test.ts`.
Both reasoned carefully about the fixture advisory lock and neither about the ordering — so instead
of skipping, they connected to a database with no migrations in it and failed. Twenty-two
assertions, every run, since 10 September.

It passed locally every time because a developer's database is already migrated. It is reproducible
in one command: point `DATABASE_URL` at an empty database and run the unit project.

The fix is where a database test belongs. `tests/unit/rls/**` is the project CI runs at the very
end, after the migrations and the seed, with `RLS_TESTS_REQUIRED=1` so a missing database is a
failure rather than a skip — which is the posture both files' own headers said they wanted. So:

- `tests/unit/source-health.test.ts` → `tests/unit/rls/source-health.test.ts`, now taking the
  harness's client and therefore `FIXTURE_LOCK`, because it runs beside suites that wipe tables.
- The SQL half of `source-schedules.test.ts` → `tests/unit/rls/cron-interval-sql.test.ts`.
- The twenty-one-expression table both halves are asked moved to
  `tests/unit/cron-interval-cases.ts`, because a table copied into two files is a table that stops
  being the same one — and the whole point is that both implementations answer the same rows.

**And the invariant is now a gate rather than a comment**, which is the durable half:
`npm run db:check-unit-offline` fails the build if a unit-project test imports `pg` or reads
`DATABASE_URL`. The rule was written down in `ci.yml` all along, and being written down is exactly
why it was broken quietly. The gate was verified to fail on both offence shapes before being wired
into `npm run check` and into CI.

### Phase 28: nineteen review findings, and the eleven that were real

After the phase merged, the diff was re-read adversarially rather than declared finished. Nineteen
findings came back; each was checked by execution or by SQL rather than taken on its word, eight
were wrong, and **eleven were real and are fixed here**. They fall into four families, and three of
the families are one mistake made repeatedly.

**A CHECK constraint refuses only on FALSE — NULL passes.** `0260` documents this once and then
broke it twice more. `research_material_lexicon_token_shape` was case-INSENSITIVE, because `token`
is `citext` and citext overloads `~` to `texticregexeq`; a token of `Teak` satisfied a constraint
written to demand lower case. And `has_no_blank_pattern` let a SQL NULL element through, because
`btrim(null) = ''` is NULL rather than TRUE. **Migration `0262`** fixes both — `token::text` to
resolve the case-sensitive operator, and an explicit `p.entry is null` test — and two RLS
regression tests now insert exactly the rows that used to be accepted.

**`0262` is applied to the hosted project as well as locally, and was proved to BEHAVE there rather
than merely to exist.** Against `ccvarsmzickdkryoakdg`: `OAK` is refused by the token shape and `oak`
accepted; `has_no_blank_pattern` refuses an array containing a SQL NULL and one containing
whitespace, and accepts a good one. The ledger row carries the local file's SHA-256
(`ae6146e1…`), so `db:migrate` sees the two databases at the same version rather than re-running it.
The forty seeded rows are untouched and none of them is non-lower-case.

**The pipeline event violated its own table's constraint.** `research_pipeline_events_moves_somewhere`
requires `from_stage` and `to_stage` to differ OR both to be present; three call sites in
`match.ts` wrote an event with neither. `recordEventAtCurrentStage()` in `lib/scraper/core/stage.ts`
now reads the product and writes its current stage into both columns, and it is the only way those
three sites record anything.

**A merchandiser could not clear a duplicate they were permitted to clear**, because the event write
went through the session client and the events table is service-role-only. The two-client model is
now explicit and documented at the top of `explorer/actions.ts`: **the domain write runs as the
person, so RLS still judges it; only the audit event runs as the system.** The lockout that had been
added to work around the symptom is gone.

**Five parser defects, all of the same species: a confident wrong answer where the design calls for
`AMBIGUOUS`.** `readCurrency` welded a currency word to an adjacent number and read `CHF` out of
`chfront`; a real ISO 4217 allowlist of ~155 codes replaced an 18-word denylist, and a code counts
only when it sits within four characters of a digit. `readPrice` invented a range from a VAT line or
a discount percentage; it now scans amounts with percentages excluded and a range token required
between them. The zero guard tested the first amount rather than any of them. And the dimension
parser's positional cursor mis-assigned the third number of a `W × D × H` triple once a diameter had
claimed a slot.

**Three defects the review found in the review's own subject matter**, all fixed here:

- The severity filter inlined up to twenty thousand product uuids into a PostgREST `in.(…)` filter —
  which lives in the QUERY STRING, so it would have started failing at a few hundred findings, in an
  opaque way, at exactly the moment an operator needed it. It is capped at two hundred ids ordered
  by most recent detection, **and the screen says when the cap bites** rather than showing a
  truncated list that looks complete.
- `?row=` and `?source=` reached `.eq()` on `uuid` columns unvalidated, so a typed-in value threw a
  500 where every other filter on the screen ignores what names nothing. Both are shape-checked now.
- **The new offline gate had the hole it exists to close.** It read `*.test.ts` and nothing else, so
  a unit test could reach a database through one `import './helper'` and pass — and the same commit
  that added the gate added a shared module beside the tests. It now walks each test's import
  closure through relative and `@/` specifiers (136 tests, 473 modules) and names the test that
  pulls an offending module in. `tests/unit/db/unit-offline-gate.test.ts` holds six cases including
  that exact indirection; the fixtures assemble the offending strings at run time, because spelling
  them out would make the gate fail on its own test — and exempting the path is how a gate stops
  being one.

Verification after the fixes: `npm run check` green; unit project **136 files / 2,279 tests**; RLS project **479 passed** with `RLS_TESTS_REQUIRED=1` against a freshly reset and seeded
database; `db:check-migrations`, `db:check-schema`, `db:check-types` and `research:check-isolation`
(all four invariants, database included) green; a production build against that database through a
local PostgREST, then `security:check-bundle` clean.

### Phase 28: the next action it named, now taken

Phases 29 and 30 were stopped at the owner's instruction on 2026-09-11 and resumed the same day.
Phase 29 is above. It diffs consecutive `research_product_versions` rows — which is why Phase 28
stamped `normalized` and `normalizer_version` on each version rather than only on the product, so
"did the page change, or did we start reading it differently" stays answerable.

---

### Superseded — Phase 27's state

**Phase 27 — Scraper Extraction. COMPLETE.** The pipeline produces structured rows. FEAT §27's
adapter architecture is built as an EXECUTION BOUNDARY with its own record rather than as a hope
that nothing throws, because "a broken source adapter must not break other sources" is a claim about
failure and a claim about failure needs a record or it cannot be checked.

**Nothing has changed about what is fetched: still nothing, still behind the same three gates.**
There are no sources, so there is nothing to extract from. What exists is the machinery, proved
against fixtures.

### Phase 27: what is built

**Migrations `0250`–`0251`, applied locally AND to hosted, with the ledger rows.**
`research_product_versions` — append-only, deduplicated by `unique (research_product_id,
content_hash)`, so an unchanged page produces NO new row. `research_adapter_runs` — one row per
(run, source, adapter), cumulative across the many cron ticks a run is drained over, holding the
first five errors and the ABORTED flag. `research_products.current_version_id` becomes the foreign
key `0231` declared its column for and deferred, `on delete set null` so removing a version does not
remove the product that was observed.

**The adapter contract, and what it withholds.** `AdapterContext` carries the source configuration,
a URL matcher, a logger and a budget predicate — and no database handle, no `fetch`, no file system,
no Cloudinary client, no clock. Every omission prevents something specific: a `fetch` in an adapter
is a request that skipped robots.txt and the delay; a database handle is a path from a third party's
markup to a write.

**`RawProductDraft` is strings-only.** `priceText`, `dimensionTexts`, `availabilityText` — every
field the source's own text, with a `confidence` map recording what was FOUND and a `provenance` map
recording which strategy read it. A parsed number fails Zod validation, at the boundary and again at
the write.

**A REAL DENIAL-OF-SERVICE VECTOR, AND THE HONEST ACCOUNT OF HOW IT WAS FOUND.** The contract suite
feeds every adapter a hundred kilobytes of unclosed `<div>`, and the first time the generic adapter
was actually registered the test run hung indefinitely. `node-html-parser` is super-quadratic in
nesting depth: 500 levels 29 ms, 2,000 levels 791 ms, 4,000 levels nearly six seconds, twenty
thousand levels hours. That page is well inside the fetcher's 2 MB cap and trivially served by
anybody who would like Rivya to stop reading them. The CPU budget cannot catch it — the runaway is
one synchronous call into a dependency, and JavaScript cannot pre-empt one. `lib/scraper/adapters/
parse.ts` estimates depth in one linear pass WITHOUT building a tree, refuses past 200 levels, and is
the only sanctioned parse in the tree; the contract suite asserts no other file imports `parse` from
the library. **The test was not made smaller.**

**Four isolation layers, each with a record.** Per item: try/catch, measured budget, Zod check. Per
source per run: ten consecutive failures set `ABORTED`, and the ROW — not the in-memory tracker — is
what makes that survive the tick boundary. Per source across runs: three consecutive ABORTED runs
open the circuit five consecutive FETCH failures open. Cross-source: proved by interleaving two
sources with adapter A throwing on every item.

**Versions, not overwrites.** The content hash is over the DRAFT rather than the page body, and
excludes `confidence` and `provenance` — so an adapter fix that finds the same value by a different
route does not read as every product changing at once in Phase 29's queue. Array order IS hashed.

**A work item is `DONE` when extraction fails.** It was fetched; retrying would ask a third party for
a document Rivya already holds because our reading of it was wrong. Repaired offline by
`scripts/research/reextract.ts`, which never imports the fetcher and is asserted not to.

**Surfaces**: `/studio/research/runs/[runId]` gains per-source adapter panels (seen, extracted,
failed, the first five errors, the ABORTED note) and a version list where each row opens beside the
strategy that read each field. The snapshot is NAMED and never linked.

### Phase 27: what is NOT built, and why

- **Any normalization.** No number is parsed, no unit converted, no currency resolved, no category
  matched. Phase 28, once, over stored evidence.
- **`PAGINATE`.** No adapter follows a next-page link, so no adapter declares the capability —
  advertising one the engine cannot honour is the failure `registry.ts` argues against at length.
- **A real vendor adapter.** `source-a` and `source-b` are FEAT §27's placeholder names with
  `supports()` false. A real one is the owner's, after policy review, and a CI guard fails the build
  on any external host named under `lib/scraper/adapters/**`.
- **A hard CPU kill.** Recorded as amendment A27 rather than claimed: the budget measures and
  `budgetSpent()` lets a loop stop itself; the bound that actually holds is the input guard.
- **A signed-in e2e path.** Guarded by `STUDIO_STORAGE_STATE` and skipped, for the reason Phases
  23–26 record.

### Phase 27: verification, as actually run

1. `npm run db:reset` — **75 migrations** apply from clean; `db:types` regenerated, `db:check-types`
   clean; `db:check-migrations` confirms every number is allocated in DATA_MODEL §12.
2. Local and hosted both report **75 migrations, 68 tables, 232 policies**.
3. Ten new unit suites, **386 assertions**, including the pathological-input case asserted to be
   REFUSED IN UNDER 250 ms — the regression that matters is somebody moving the guard after the
   parse.
4. `tests/unit/rls/phase27.test.ts` — 23 cases. Every role including OWNER is refused a write to
   either table, in both directions, and the `on delete set null` / cascade behaviours are proved by
   deleting inside a rolled-back transaction.
5. `npm run test` — **2,499 passing, none skipped**.
6. `npm run check` — all **33** gates green; the isolation guard now prints five assertions.
7. A production build against the seeded database through the local PostgREST shim; `security:check-bundle` clean.

### Phase 27: the D9 ten, recorded

1. Code exists and is committed — two migrations, the adapter tree (contract, draft schema, two
   registers, the bounded parser, the generic adapter's five strategies, two placeholders), the
   isolation boundary, the extraction workflow, two repositories, the offline re-extraction script,
   two Studio panels, ten unit suites, one RLS suite, one e2e spec.
2. Migrations applied locally and to hosted with ledger rows and matching counts (75 / 68 / 232).
3. Tests written and passing: 2,499, none skipped.
4. Gates pass, including the widened `research:check-isolation`.
5. Documentation updated: SCRAPER §18 (the adapter chapter and "how to write an adapter"),
   DATA_MODEL §12, CANONICAL-DECISIONS **A27** and the new D1 row, CHANGELOG, PROJECT_STATE, this
   file.
6. No business fact fabricated: no competitor, brand, domain or price anywhere, fixtures included.
7. Nothing in the manifest regenerated; no competitor image fetched — `imageUrls` are strings.
8. Remaining issues documented — see "what is NOT built" above.
9. The next phase is named: **28 — Normalization + Validation**.
10. Hosted is level with the repository through `0251`.


### Superseded — Phase 26's state

**Phase 26 — Comparator Source Management. COMPLETE.** Adding a competitor is now a Studio task
rather than an engineering one. All twenty-three FEAT §26 fields are stored, validated, editable and
consumed by the Phase 25 engine, and the claim that matters is proved rather than asserted: the
end-to-end spec builds a complete second source through the interface — politeness settings, three
URL patterns, four category mappings, a schedule — and then asserts `git status --porcelain` is
**empty**.

**Nothing has changed about what is fetched: still nothing, and still behind the same three gates.**
This repository ships zero source rows and seeds none. What Phase 26 added is the workflow around
the gate, never a way past it.

#### Phase 26: what is built

**Migrations `0240`–`0241`, applied locally AND to hosted through the Supabase MCP, with the ledger
rows.** Four enums. Three child tables — `research_source_url_patterns`,
`research_source_category_map`, `research_source_schedules` — each carrying its own constraints and
audit trail rather than three keys in a jsonb blob nobody can review. Eight new columns on
`research_sources`. Three politeness ceilings tightened to FEAT §26's numbers (60 rpm, a 1,000 ms
floor, four at a time), so a form stricter than its table is no longer possible in either direction.

**Health is a VIEW, and it is the first derived relation in this schema.**
`research_source_health_v` computes last run, seven-day success rate, queue depth, schedule cadence
and health on READ — `DISABLED → FAILING → DEGRADED → STALE → HEALTHY`, in that precedence.
`security_invoker = true` is the load-bearing word: without it a relation over nine staff-only
tables is readable by anyone PostgREST will speak to. Because a view has no policies, its GRANTS are
the whole of its access control, and `check-research-isolation.mjs` gained a fifth assertion for
exactly that — anon holding any privilege on any research view fails the build. Tables are
deliberately out of that check's scope: Supabase grants every role every privilege on every new
table in `public`, and RLS, not the grant, is the boundary there. The first draft of the check
included tables and would have failed on all twelve.

**Six hours, parsed in SQL.** `research_source_schedules_min_interval` calls
`research_cron_min_interval_minutes()`, which reads the minute and hour fields and returns the
smallest gap between two fires — **0, not null, for an expression it cannot read**, because a null
would make the CHECK `null >= 360`, which PostgreSQL treats as satisfied. The rule exists twice on
purpose: as a constraint nothing can bypass, and in `lib/scraper/core/cron.ts` so a form can say
what is wrong before the write. A 21-row table runs both implementations against each other and the
database half really runs.

**EXCLUDE wins, always, whatever the priority**, and an EXCLUDE that will not compile still
excludes. Folding the four pattern kinds into one ordering would have made the priority column a way
to configure a refusal away. Patterns are matched against the absolute URL *and* the
path-and-query, because a leading-slash glob is what an operator actually writes and an anchored
expression compiled against the whole address matched nothing, silently.

**An unmapped category is a first-class result, never a guess.** `normaliseLabel` lowercases,
collapses whitespace and does nothing else — no stemming, no synonyms, no defaulting to the first
category — and the dashboard counts what is left over.

**The tester makes no request; the probe makes exactly one.** The tester is a plain GET on the
page, answered from stored patterns and the cached robots file, so twenty candidate URLs can be
checked without a packet — including the ones that turn out to be disallowed — and the result is a
link somebody can share. The probe goes through `lib/scraper/workflows/probe.ts`, which uses the
same fetcher the drain loop does, so robots.txt, the source's delay and the circuit breaker all
apply; it writes an audit row with the operator's name on it.

**Readiness and policy status are two columns because they are two questions.** A researcher marks a
source `READY_FOR_REVIEW`; an owner or admin records `APPROVED`, `RESTRICTED` or `BLOCKED` with a
mandatory note. Both acts need `research.write` AND `system.settings.write`, checked as a pair in
the server action because RLS gates a row rather than a column.

**Surfaces**: `/studio/research/sources` (list with derived health), `/sources/new`,
`/sources/[sourceId]` (all 23 fields, the three child editors, the tester, the probe, readiness, the
policy panel and the enable control rendered *disabled with its reason*), plus health pills and an
unmapped-category count on the dashboard.

#### Phase 26: what is NOT built, and why

- **Any adapter.** `lib/scraper/adapters/registry.ts` holds a DESCRIPTOR — key, version,
  capabilities, `supports()` — with exactly one entry, `generic`, declaring `DISCOVER` only.
  Claiming `EXTRACT` before Phase 27 writes the extractor would advertise a capability the engine
  cannot honour.
- **`SITEMAP`, `CATEGORY_CRAWL` and `FEED` collection modes.** In the enum so adding them is code
  rather than a migration; `SEED_URLS` is the only one the engine runs today.
- **A timezone other than UTC.** The column exists because FEAT §26 field 19 names it, and the
  CHECK refuses anything else: `nextCronRun` evaluates every field in UTC, so a stored zone would
  be a column the scheduler silently ignores.
- **A rendered builder for the three extraction configs.** They are JSON textareas with Zod schemas
  behind them, because their shape belongs to the Phase 27 adapter that reads them.
- **A signed-in e2e path.** Guarded by `STUDIO_STORAGE_STATE` and skipped, for the reason Phases 23,
  24 and 25 record: a real session needs an auth server the local shim does not run.

#### Phase 26: verification, as actually run

1. `npm run db:reset` — **73 migrations** apply from clean; `seed:content` — 486 inserted;
   `db:types` regenerated and `db:check-types` clean.
2. Local and hosted both report **73 migrations, 66 tables, 230 policies**, zero `anon` policies on
   any `research_*` table, zero `anon` grants on the health view, and zero source rows.
3. `node scripts/research/check-research-isolation.mjs` → exits 0 with **exactly one** allowlisted
   crossing, `research_source_category_map_category_fk`, pointing at `categories`.
4. The five health states proved by inserting run histories and reading the view back, plus the
   circuit-open case that must be `FAILING` whatever the run history says.
5. `psql` refuses `*/5 * * * *`, `0 */4 * * *` and `not a cron`; accepts `0 */6 * * *`, the
   wrap-around `0 0,18 * * *` and `30 3 * * *`.
6. **Two constraint defects found by their own tests and fixed.** `check (category_id is not null or
   is_ignored)` turned `on delete set null` into `on delete restrict`, so a merchandiser could not
   delete a category a researcher had once mapped to; it is replaced by a generated `mapping_state`
   with three values and a CHECK on the one thing that is never true. And the pattern matcher only
   ever tested the absolute URL, so `/collection/*` matched nothing at all.
7. `npm run test` — **2,158 passing, none skipped**, including 334 across six new unit suites and
   `tests/unit/rls/phase26.test.ts` (24 cases).
8. `npm run check` — all **33** gates green. A production build against the seeded database through
   the local PostgREST shim renders all three new routes; `security:check-bundle` clean.

#### Phase 26: the D9 ten, recorded

1. Code exists and is committed — two migrations, five `lib/scraper` modules, three repositories,
   three Studio routes with eleven server actions, seven components, six unit suites, one RLS
   suite, two e2e specs.
2. Migrations applied locally and to hosted, with ledger rows and matching counts (73 / 66 / 230).
3. Tests written and passing: 2,158, none skipped.
4. Gates pass, including the widened `research:check-isolation`.
5. Documentation updated: SCRAPER §17 (the field table verbatim plus what shipped), DATA_MODEL,
   STUDIO_GUIDE, CANONICAL-DECISIONS **A26**, CHANGELOG, PROJECT_STATE, this file.
6. No business fact fabricated: zero sources, zero competitor names, zero domains. Every fixture
   uses an `example`-reserved host or loopback.
7. Nothing in the manifest regenerated; no competitor image fetched, and none ever will be.
8. Remaining issues documented — see "what is NOT built" above.
9. The next phase is named: **27 — Scraper Extraction**.
10. Hosted is level with the repository through `0241`.

#### Phase 26: what the owner must do before anything is fetched

Unchanged from Phase 25, and now with a screen for each step:

1. Set `CRON_SECRET` and `SCRAPER_USER_AGENT` in Vercel — see ENVIRONMENT §5.2.
2. Decide, per website, whether its terms permit Rivya to read it. **This is not an engineering
   question and this repository has not answered it.**
3. Add the source in Studio → Research → Sources, record the policy review, enable it, and switch
   `research_enabled` on.


### Superseded — Phase 25's state

**Phase 25 — Product Scraper Foundation. COMPLETE.** Rivya can now read a competitor's website —
politely, on a schedule, under a kill switch — and store what came back somewhere no visitor can
reach. It extracts nothing structured (Phase 27) and normalises nothing (Phase 28).

**Nothing has been fetched from anybody, and nothing will be until three separate gates are open:**
an owner records a policy review approving a source, that source is enabled, and the
`research_enabled` flag is switched on. This repository ships **zero** source rows and seeds none.
That is the shipped state, not a gap — a source row is an assertion that Rivya may read a real
third party's website, and that judgement is the owner's.

#### Phase 25: what is built

**Migrations `0230`–`0234`, applied locally AND to hosted through the Supabase MCP, with the ledger
rows.** Six enums. Nine tables: `research_sources` (politeness settings as columns, because they
are enforced in the lease query), `research_jobs`, `research_runs`, `research_work_items` (the unit
of progress — a run is drained across many cron ticks and survives a cold start),
`research_fetches`, `research_raw_items`, `research_products`, `research_pipeline_events`
(append-only) and `research_robots_cache`. `research_lease_work_items()` is SECURITY DEFINER and
granted to the service role alone: `for update skip locked` is the entire concurrency design and
PostgREST cannot express it. `0233` is the generated RLS; `0234` corrects the `status` allowlist
Phase 23 wrote on `research_search_documents` before it could know a source has no stage, and fills
the index by trigger.

**The stage machine.** FEAT §23's seven stages, forward one step at a time and backward by any
amount. Rejection is NOT a stage — `disposition` is a separate column, so a rejected row keeps the
stage it reached. `lib/scraper/core/stage.ts` is the only writer of `stage` anywhere, and it writes
the pipeline event in the same call, event first. Moving a stage is `research.confirm`, not
`research.write`: the dividing line is the column, not the screen.

**The politeness posture** (`docs/architecture/SCRAPER.md`). One named user agent with no fallback.
robots.txt fetched once per host per day, with a `Disallow` meaning no request is made at all and
the refusal recorded. `Crawl-delay` as a floor, never a ceiling. Rate limit, delay and concurrency
enforced in the lease query rather than by `sleep()` calls a killed function loses. Exponential
backoff with jitter, `Retry-After`, a circuit breaker at five consecutive failures, and a kill
switch checked before EVERY fetch.

**Four permanent prohibitions enforced by a build gate**: no headless browser, no proxy rotation,
no CAPTCHA solving, no browser impersonation.

**Snapshots** gzipped into a PRIVATE Supabase Storage bucket — never Cloudinary, which serves from
a public CDN — content-addressed, date-partitioned, 180-day retention, pruned by the same cron.

**Surfaces**: `/studio/research/{dashboard,sources,jobs,runs,runs/[id],scrape}`, two command
providers against `research_search_documents`, and `app/api/cron/research` on a five-minute Vercel
cron.

#### Phase 25: what is NOT built, and why

- **Structured extraction.** `research_raw_items.raw` accepts ONLY `{ title, canonicalUrl, links }`
  and its Zod schema is `.strict()`, so a "quick price regex" fails at the write rather than at
  review. Phase 27 builds the adapter architecture; this phase must not pre-empt it, and the schema
  is the commitment device that stops it.
- **A `research_product` command provider.** The index and the trigger exist, but at this phase a
  research product is a URL and a stage — a palette result would be a bare link with nothing to
  recognise it by. Phase 29 builds the explorer such results should open.
- **Source management.** `/studio/research/sources` is read-only. The remaining FEAT §26 fields,
  the category mapping, the URL patterns and the health view are Phase 26; a half-form here would
  be a second place to define one source.
- **A `system_logs` row for a circuit opening.** That table is Phase 38's. `lib/scraper/core/log.ts`
  is the seam: it writes the line to the console — which on Vercel IS the cron invocation's log —
  and returns the reason in the tick summary, so the route's JSON says it too. Phase 38 replaces
  the body of one function.
- **A signed-in e2e path.** Guarded by `STUDIO_STORAGE_STATE` and skipped, for the reason Phases 23
  and 24 record: a real session needs an auth server the local shim does not run.

#### Phase 25: verification, as actually run

1. `npm run db:reset` — 71 migrations apply from clean; `seed:content` — 486 inserted;
   `db:types` regenerated with no drift.
2. Local and hosted both report **71 migrations, 63 tables, 218 policies**, zero `anon` policies on
   any `research_*` table, zero source rows, and seven anon-callable functions — the same seven the
   `ANON_CALLABLE` allowlist names.
3. `node scripts/research/check-research-isolation.mjs` → exits 0. Then **each invariant was
   planted and proved to fail**: a foreign key from `research_products` to `categories` (I1), an
   `anon` policy on `research_products` (I2), a `researchProduct` identifier in `lib/catalog` (I3),
   a `puppeteer` import in `lib/scraper/core/fetch.ts` and a `lib/scraper` import in
   `lib/supabase/repositories/products.ts` (I4). All five failed with the file and the reason named;
   all five restored.
4. **The drain loop run end to end against a real fixture HTTP server**, which is the only way the
   claims that matter can be checked, because they are about requests that must NOT happen:
   - robots.txt requested **exactly once**, served from the 24-hour cache thereafter;
   - `/private/secret` and a `/private/x` discovered mid-run both recorded `DISALLOWED`, and
     **neither appears in the fixture server's own request log**;
   - the gap between two fetches was 2,312 ms against the host's 1-second `Crawl-delay` and the
     source's configured 250 ms — the floor won;
   - the kill switch produced zero requests and a WARNING line;
   - a `429` with `Retry-After: 30` returned the item to `PENDING` with `attempts = 1` and a
     129-second backoff, because the ladder beats a number supplied by the server we are already
     struggling with.
5. `npm run test` on a reset-and-seeded database — **1,800 passing, none skipped**, including four
   new unit suites and `tests/unit/rls/phase25.test.ts` (31 cases, every research table seeded
   before the anon read so a zero means a policy refused rather than an empty table).
6. Two new e2e specs against a real `next dev` over the shim: 10 passed, 8 skipped for the
   storage-state reason — including `/api/cron/research` refusing an unauthenticated request and
   the sitemap containing no research route.
7. `npm run check` — all **33** gates green.

#### Phase 25: two things this phase found in existing code

- **`tests/unit/rls/function-grants.test.ts` never loaded the fixture.** Its last test inserts a
  product as the owner, and it only worked because some other suite happened to run first. The
  advisory lock serialises those files but says nothing about their order, so adding one suite was
  enough to break it. It now loads the fixture itself.
- **That same suite caught four SECURITY DEFINER trigger functions this phase left callable by
  `anon`.** PostgreSQL grants EXECUTE to `public` on a new function by default, and on Supabase
  `public` includes `anon`. `0234` revokes them, as `0211` does for the eleven public-index
  triggers. A gate written two phases ago failing on code written today is the whole point of
  having it.

#### Phase 25: the D9 ten, recorded

1. Code exists and is committed — five migrations, `lib/scraper/**` (core and workflows), eight
   research repositories, six Studio surfaces, two command providers, the cron route, two scripts.
2. Migrations applied locally and to hosted, with ledger rows and matching counts (71 / 63 / 218).
3. Tests written and passing: 1,800, none skipped, plus 10 e2e and the fixture-server run.
4. Gates pass, including the new `research:check-isolation`.
5. Documentation updated: **SCRAPER.md created**, DATA_MODEL (§12 and the research register as
   built), SECURITY (T5 as built, and the politeness posture), STUDIO_GUIDE, ENVIRONMENT (§5.2
   gains `CRON_SECRET` and `SCRAPER_USER_AGENT`), CANONICAL-DECISIONS A25, CHANGELOG,
   PROJECT_STATE, this file.
6. No business fact fabricated: zero sources, zero products, and the one row D10 governs — a source
   — cannot be enabled without an attributed owner approval, at the row.
7. Nothing in the manifest regenerated; no competitor image fetched, and none ever will be.
8. Amendments recorded: A25 (six readings).
9. The next phase is named: **26 — Comparator Source Management**.
10. Hosted is level with the repository through `0234`.

#### Phase 25: what the owner must do before anything is fetched

1. Set `CRON_SECRET` (Sensitive) and `SCRAPER_USER_AGENT` (plain) in Vercel — see ENVIRONMENT §5.2.
   Until then the cron refuses itself, which is the intended behaviour.
2. Decide, per website, whether its terms permit Rivya to read it. **This is not an engineering
   question and this repository has not answered it.**
3. Record the approval on a source, enable it, and switch `research_enabled` on.


### Superseded — Phase 24's state

**Phase 24 — Bulk Management. COMPLETE.** One engine, one audit trail, one undo window. Eleven
registered operations across three modules run through `lib/bulk/run.ts` and nothing loops on its
own: an operation without a `bulk_operations` row has no preview, no confirmation token, no
per-item snapshot and no undo, and a build gate refuses one whose preview writes.

**Every bulk surface renders with nothing to operate on, because `products` and `media_assets` hold
no rows a seed may create.** That is D10 working, not a gap.

#### Phase 24: what is built

**Migrations `0220`–`0221`, applied locally AND to hosted through the Supabase MCP, with the ledger
rows.** `bulk_operations` stores the exact previewed id list, so Apply re-reads it rather than
trusting the request and a stale tab cannot apply a preview built from a different filter; the cap
of five hundred is a CHECK on the row, because the number is what makes the batching arithmetic
safe. `bulk_operation_items` holds the per-item before/after that makes the 24-hour undo real and
keeps the audit log readable — one `audit_logs` row per operation, five hundred item rows behind a
link. `bulk_imports` and `bulk_import_rows` record what an uploaded file contained; the file itself
is not retained after apply. `0221` is the generated RLS: four shape-C tables read under
`bulk.execute`, no write policy for any session role, and delete revoked twice over on the two
record tables — in policy and in grant.

**The engine.** `lib/bulk/` — the `BulkOperation` contract (`kind`, `targetEntity`, a Zod
`paramsSchema`, `isDestructive`, a write-free `preview`, `applyItem`, an optional `undoItem`), a
registry each operations module registers into through an exported function so it can be rebuilt,
`run.ts` (preview → token → apply, re-checking the permission and the typed count server-side and
batching at fifty) and `undo.ts`. Nine product operations, three media, five research registered
`available: false` with `owningPhase: 29`.

**The four steps and the confirmation.** Select and Preview live on separate surfaces, reached by a
redirect, and the confirmation token never enters the URL. A destructive operation asks for the ROW
COUNT as digits — a fixed word becomes muscle memory inside a week and a number cannot — and the
server re-checks it against a count it computes itself, because a Server Action is an HTTP
endpoint.

**Gates and scripts.** `scripts/bulk/check-bulk-registry.mjs` (in `npm run check` and CI), proved
to fail on a preview that writes and on a destructive flag set wrong. `db:check-data-layer` joined
`npm run check` in the same edit — it ran in CI and not locally, which is how Phase 23 reached main
red. The local PostgREST shim now mints a service-role key beside the anon one.

#### Phase 24: what is NOT built, and why

- **A transaction per batch.** PostgREST gives the engine one statement per call and no transaction
  handle. What fifty actually buys is bounded memory, a progress point and a `PARTIAL` outcome that
  names exactly which rows landed — the property the phase document wanted the transaction for.
  Recorded as amendment **A24** rather than left for a reader to notice as an omission.
- **"Select all matching filter".** The catalogue holds no products and the cap is five hundred, so
  the list is unpaginated today. When it outgrows one page this becomes the Phase 14 filtered list,
  which is what `MAX_SELECTION` exists to bound.
- **The five research operations.** Registered, refusing, and naming Phase 29. `research_products`
  does not exist until Phase 25 fills it, and a surface that pretended otherwise would be a surface
  that could act on rows that are not there.
- **A signed-in e2e path.** The Studio blocks of the three new specs are guarded by
  `STUDIO_STORAGE_STATE` and skip, because a real session needs an auth server the local shim does
  not run and a forged cookie is refused by `getUser()`. They are marked skipped in the report
  rather than omitted, so the gap is visible.

#### Phase 24: verification, as actually run

1. `npm run db:reset` — 66 migrations apply from clean. `npm run seed:content` — 486 inserted.
2. `npm run db:check-schema`, `auth:check-rls`, `auth:check-policies`, `db:check-hosted-layout` —
   green; local and hosted both report 66 migrations, 54 tables, 199 policies, and zero `anon`
   policies on any `bulk_*` or `research_*` table.
3. **The engine run end to end against a real PostgreSQL over the local PostgREST shim, as the
   service role**, on two hand-seeded products — one ready to publish, one not. This is what the
   phase's three real defects were found by, and none of them was reachable from a unit test:
   - `bulk_operations_confirmed_pair` refused the first row the engine writes. Replaced by two
     one-way constraints (**A24**).
   - The same constraint then refused the finish, because the token is CLEARED when it is spent.
   - `row_version_before` held the version the operation READ, so undo mismatched on every row it
     had itself changed, skipped all of them, and reported each as edited by somebody else. It now
     holds the version the operation LEFT behind; the regression guard is an ordering assertion.
   After the fixes: preview reports 1 will apply and 1 excluded with its unmet readiness items
   named; apply publishes one, reports the other by id and ends `PARTIAL`; undo restores it to
   `DRAFT` and ends `SUCCEEDED`.
4. `npm run test` on a reset-and-seeded database — **1,691 passing, none skipped**, including four
   new unit suites and `tests/unit/rls/phase24.test.ts` (18 cases).
5. The three new e2e specs run against a real `next dev` over the shim: 6 passed, 11 skipped for
   the storage-state reason above.
6. `node scripts/bulk/check-bulk-registry.mjs` → exits 0 reporting 11 operations across 3 modules;
   planting a write in a preview and clearing a required destructive flag → exits 1 each time,
   naming the file. Restored.
7. `npm run check` — all **32** gates green.

#### Phase 24: the D9 ten, recorded

1. Code exists and is committed — two migrations, `lib/bulk/**` with three operations modules, five
   bulk repositories, four Studio surfaces, the five shared controls, one gate script.
2. Migrations applied locally and to hosted, with ledger rows and matching counts (66 / 54 / 199).
3. Tests written and passing: 1,691, none skipped, plus the e2e specs above.
4. Gates pass, including the new `bulk:check-registry` and `db:check-data-layer` now in `check`.
5. Documentation updated: DATA_MODEL (the bulk section rewritten as built, §12), STUDIO_GUIDE §7.7
   and §7.8 and guardrail 13, CANONICAL-DECISIONS A24, CHANGELOG, PROJECT_STATE, this file.
6. No business fact fabricated: no product invented to operate on, no import able to publish
   (`status` is absent from the writable allowlist, enforced by absence), no concept asset
   launderable (four immutable columns refused at the write).
7. Nothing in the manifest regenerated; `media:assert-no-regen` green.
8. Amendments recorded: A24 (five readings).
9. The next phase is named: **25 — Product Scraper Foundation**.
10. Hosted is level with the repository through `0221`.


### Superseded — Phase 23's state

**Phase 23 — Global Search + Product Relationships. COMPLETE.** Everything published is findable and
the connections between things are data rather than inference. `/search` returns grouped, ranked,
paginated results and the SEED §26 empty state in the same words it used when it could not search at
all; the header carries an ARIA 1.2 combobox that degrades to a plain GET form; the Studio palette
reaches eight entity types, each behind its own permission; and `product_relations` — an edge with no
vocabulary since Phase 03 — has a fixed nine-name model, a sibling table for non-product sources,
four suggestion rules that propose and never write, and a workspace that accepts, dismisses and
removes.

**On a seeded database public search returns categories and journal articles and no products,
because the seed creates none.** That is the shipped state, not a gap.

#### Phase 23: what is built

**Migrations `0210`–`0214`, applied locally AND to hosted through the Supabase MCP, with the ledger
rows.** `search_documents` (one flattened document per entity; `entity_type` allowlisted to eight
values by CHECK, so no research row is insertable by any path; a second CHECK making the three
Studio-only types incapable of `PUBLIC`; a stored generated `search_vector` weighting title A,
subtitle B, body and keywords C). `research_search_documents` created EMPTY beside it with its own
three-value allowlist, `visibility` pinned to `STAFF` by CHECK and no `anon` policy — two phases
before the subsystem that fills it. `search_queries` with no IP, no user agent and a CHECK refusing
an actor on a public search. `0213`: `content_relations`, `relation_suppressions`,
`product_attribute_terms`, and four new columns plus three CHECKs on `product_relations`. `0212` and
`0214` are the generated RLS.

**Four functions and eleven triggers.** `rv_unaccent` and `rv_keyword_text` are IMMUTABLE wrappers,
because the generated column will not take `extensions.unaccent` (STABLE) or the generic
`array_to_string` (STABLE). `refresh_search_document()` is `security definer` and is the ONLY writer
of the index — there is no INSERT or UPDATE policy for any session role, so a member of staff cannot
hand-write a search result. `search_documents_query` and `search_documents_count` are `security
invoker`, granted to `anon`, because PostgREST cannot express `websearch_to_tsquery`, `ts_rank_cd` or
`similarity` as filters.

**`lib/search/`, `lib/relations/`, and the surfaces.** Query parsing that drops nonsense rather than
400ing on it; grouping in a fixed order with near matches in a band of their own; the rebuilt
`/search`; `app/api/search/suggest` (GET, anon-key, prefix-matching, capped at eight across three
groups, `s-maxage=60`); `SearchCombobox` + `Listbox`; `SearchResultCard`; eight command providers in
one file; `/studio/catalog/relationships` with its coverage, picker, edges and suggestions panels.

**Gates and scripts.** `scripts/search/check-search-scope.mjs` (in `npm run check` and CI),
`reindex.ts` with a `--dry-run` drift report, `prune-queries.ts` at 90 days.

#### Phase 23: what is NOT built, and why

- **Drag reordering in the relationship workspace.** `reorderRelationsAction` exists with its audit
  row and its permission check; the pointer interaction does not, and it would be that page's first
  client island. STUDIO_GUIDE §7.5 says so rather than implying otherwise.
- **Creating an edge by hand from the workspace.** It stays on the product's Related tab, where the
  editor is already looking at the piece. A second create form is a second place for one act to go
  wrong.
- **Suggestions for a project, an article or a collection.** All four rules take a product on the
  source side; `suggestRelations` returns an empty list for the others rather than inventing a rule
  to fill the panel, which is what FEAT §11 forbids.
- **A rendered journal body in the index.** The prose lives in `page_sections`, and flattening
  section content is a Phase 39 question. The standfirst, excerpt and category name are indexed;
  half a body called a whole one would be worse than neither.
- **Rate limiting on the suggest endpoint.** Input caps and the edge cache only; a request-rate
  limiter is Phase 41's call, as the phase document says.

#### Phase 23: verification, as actually run

1. `npm run db:reset` — 64 migrations apply from clean. `npm run db:types` — regenerated, committed.
2. `npm run db:check-schema` — 50 tables, tiers correct, D10 gate on all 13 content tables.
   `npm run auth:check-rls` — 50 tables, 193 policies, every staff-select list matches the matrix.
   `npm run auth:check-policies` — both generated files match. `npm run db:check-hosted-layout` — green.
3. A research `entity_type` in `search_documents` → refused by CHECK, proved as the superuser (a
   session insert is refused by RLS a step earlier, which is a different fact and is tested
   separately). Anon policies on `research_*` → zero.
4. `node scripts/search/check-search-scope.mjs` → exits 0; adding `research_products` to
   `lib/search/query.ts` → exits 1 with the file and line. Restored.
5. `npm run test` with `RLS_TESTS_REQUIRED=1` on a reset-and-seeded database — **1,611 passing, none
   skipped**, including the four new unit suites and `tests/unit/rls/phase23.test.ts`.
6. The three e2e specs run against a real `next dev` over the local PostgREST shim: 25 passed, 11
   skipped (the combobox is hidden below `lg` by design; the signed-in Studio block needs a storage
   state this repository does not yet ship).
7. Live, by hand: `/search?q=resin` renders a category group; `?q=resim` renders the near-match band
   under its own heading; `?q=zzzzzzqqqq` renders the SEED §26 copy with zero result cards;
   `/api/search/suggest?q=re` returns one prefix match with `s-maxage=60`; `?q=a` returns 400.
8. `reindex.ts --dry-run` twice → identical per-type counts, zero writes; `--apply` → rebuilt, then
   the dry run reports no drift.
9. `npm run check` — all 31 gates green, including the raised island budget, the new scope gate, and
    `db:check-data-layer`, which was added to `check` after CI caught what `check` could not: the
    first push held `.from()` calls in `lib/relations/**` and the workspace. All of it moved into
    `lib/supabase/repositories/relations.ts`.
10. `npm run seed:content` twice → inserted 486 then unchanged 486; `content:check-inventory`
    regenerated with the 20 new strings.

#### Phase 23: the D9 ten, recorded

1. Code exists and is committed — five migrations, two `lib/` domains, the public page, the suggest
   endpoint, two patterns, eight providers, the workspace and its actions, three scripts.
2. Migrations applied locally and to hosted, with ledger rows and matching counts.
3. Tests written and passing: 1,611, none skipped, plus 25 e2e.
4. Gates pass, including the new `search:check-scope`.
5. Documentation updated: DATA_MODEL (the search and relations sections rewritten as built, §12),
   STUDIO_GUIDE §6 and §7.5, BUSINESS_RULES BR-D11, CANONICAL-DECISIONS A23, CHANGELOG,
   PROJECT_STATE, this file.
6. No business fact fabricated: zero attribute terms, no generated "did you mean", no relation
   written by a rule, no price on a search card.
7. Nothing in the manifest regenerated; `media:assert-no-regen` green.
8. Amendments recorded: A23 (six readings).
9. The next phase is named: **24 — Bulk Management**.
10. Hosted is level with the repository through `0214`.


### Superseded — Phase 22's state

**Phase 22 — Homepage / Store Merchandising. COMPLETE; EVERY SLOT EMPTY, WHICH IS THE SHIPPED
STATE.** The owner has the controls — what appears in Selected Works, which collections are
featured, how the store's categories are ordered, what is pinned in each, and when — and has used
none of them yet, because there is nothing published to curate. With zero published products
every slot resolves to its fallback: editorial tiles with no price and no product link, or nothing
at all. No product card is fabricated anywhere, and `npm run cms:check-copy` now refuses a
`/product/<slug>` literal in any renderer.

### Phase 22: what is built

**Migrations `0200` and `0201`, applied locally AND to hosted through the Supabase MCP, with the
ledger rows.** `merchandising_slots` (Tier A + `status`; key, surface, owning Studio route,
allowed types, minimum, maximum, `auto_fill` with its rule-named CHECK, fallback mode, fallback
section) and `merchandising_entries` (Tier A + status and the publication pair; type, entity,
position, pin, half-open window, the sweep's `window_state`, note). The eleven slots inserted as
structure under the `allow-insert` marker — four global and one `CATEGORY_PINNED_<SLUG>` per D3
category through `sync_category_pinned_slot()`, which also fires for a category added or renamed
later. `guard_merchandising_entry()` refuses a type the slot does not admit, an entity that does not
exist, and a collection still in concept (`RV061`–`RV063`). `merch_move_entry()` moves one place
atomically under RLS; `merch_run_schedule()` is the cron's merchandising pass. `0201` is generated:
shape A on both, the entry's window and its slot's status folded into the public clause.

**THE LADDER, ONCE.** `lib/cms/merchandising.ts` — live entries, re-checked targets, curated if
the minimum is reached, a recency top-up if the owner switched it on and wrote the rule, else the
fallback mode — with provenance `CURATED` · `RULE_FILLED` · `FALLBACK`. `lib/cms/merchandising-
register.ts` carries the eleven keys, the three editorial CTA paths and the one rule's words;
`tests/unit/merchandising-register.test.ts` holds it level with `0200` and reads the resolver's
source for "popular", "trending" and "random".

**THE SEAM HELD.** `selectProducts` and `selectArticles` kept their signatures and gained a slot-
backed body; `lib/cms/references.ts` resolves the slot key from the block's `slot_key` or the
page's default (`/` → the homepage slots), and builds the EDITORIAL_BLOCK tiles from the fallback
section before render. Afterwards, separately, the three reference renderers learned the modes:
`HIDE_SECTION` returns nothing, `EDITORIAL_BLOCK` adds tiles, `SHOW_EMPTY_STATE` is the Phase 11
sentence. `featured-collections` is the 34th block (A22), addable on `/` and `/collection`, not
seeded. `MerchandisedRow` (RC-243) renders `STORE_FEATURED_ROW` above the catalogue and a
category's pinned region above its grid on the default view, with `global_content` headings.

**FOUR STUDIO SCREENS ON ONE EDITOR.** `SlotEditor` — entries with move, pin, release, remove and
window controls (one action, one state per row); a picker of PUBLISHED entities grouped by type,
with concept collections withheld and the reason inline; settings; and the resolver's own answer
as *What the public sees now*. `/homepage` owns Selected Works and the journal strip, shows the
featured band read-only with a link, and edits the hero still and the Selected Works heading under
`content.write`. `/store` reorders categories one place at a time — a SEED §56 inversion is
refused once with the warning and allowed on an acknowledged second submit — with *Restore
recommended order*, and each category's pinned slot beside it. `/featured` owns the two featured
slots. `/scheduling` is a month table of live entries per slot per day with gaps and overflows
marked, the windows that open or close, and a jump to the owning screen. Every form posts the
screen it was drawn on; the action refuses a slot owned elsewhere; every write is audited, in the
activity feed, and followed by a revalidation of the surface. 118 Studio strings; two public
strings seeded under `UI_LABEL.merchandising.*` and applied to hosted through the emitter.

**THE CRON GAINED ITS PASS.** `app/api/cron/content-schedule/route.ts` runs the content sweep and
then `merch_run_schedule()`, unions the paths, revalidates once, and reports both.

### Phase 22: what is NOT built, and why

- **No curation.** Every slot is empty because nothing is published to curate. The owner curates
  from Studio → Merchandising or nobody does.
- **No typed entity search in the picker.** The picker is a grouped `<select>` of published rows —
  a few dozen at most on this catalogue — which works without JavaScript and offers exactly what the
  resolver will show. Phase 23 owns search.
- **No drag handle.** Ordering is a button pair, keyboard-operable and atomic, as `CollectionCurator`
  argued in Phase 16; a pointer affordance can be layered later without touching the write path.
- **The pinned region does not reorder the grid.** `CATEGORY_PINNED_*` governs a region above the
  grid on the category's default view; the grid keeps its own order and a pinned piece also keeps
  its natural place. Interleaving pins into a paginated, faceted query would put pieces that fail
  a filter above pieces that pass it.
- **`featured-collections` is not on the homepage.** Adding a section to a seeded page is an
  editor's act; the block reads the homepage slot by default the moment it is placed.
- **The e2e walk cannot run here** (the proxy blocks the dev server's Supabase reads, and the
  curation walk needs a signed-in merchandiser). It skips with a stated reason, never passes
  silently.

### Phase 22: verification, as actually run

1. `npm run typecheck`, `npm run lint` (0 errors; the 6 pre-existing e2e-fixture warnings),
   `npm run format:check`, every `npm run check` gate including the extended copy gate — green.
2. `npm test` with `DATABASE_URL` on the local PostgreSQL 16 cluster: **1,534 tests across 116
   files, none skipped** — 32 new: 12 in `merchandising-resolve` (the ladder step by step, the caps,
   a DRAFT slot; `HIDE_SECTION` renders nothing, `SHOW_EMPTY_STATE` the sentence, `EDITORIAL_BLOCK`
   tiles with no product route, no price label, a CTA only to the three paths), 8 in
   `merchandising-register`, 12 in `rls/phase22` (anon reads an entry only while live in a
   PUBLISHED slot; the editor cannot curate and the merchandiser can; a concept collection, a
   wrong type, a missing entity, a backwards window and a rule-less `auto_fill` are refused for the
   owner; the sweep is the service role's).
3. `db:check-migrations` (59 migrations to `0201`), `db:check-schema` (44 tables, RLS on all,
   the two new tables' tiers declared), `auth:check-rls` (175 policies) and `auth:check-policies`
   — green locally; the same counts confirmed on hosted by query after the MCP apply.
4. Every guard, the move function, the sweep and the categories trigger probed by SQL with
   savepoints: wrong type, missing product, concept collection, category accepted in the featured
   slot, backwards window, rule-less `auto_fill`, `published_at` stamped, a move swapping
   positions, a sweep opening one window and closing another with two `activity_events` rows and
   `paths = ["/"]`, a second sweep returning no paths, a new category creating its slot and a
   renamed slug carrying it.
5. `npm run seed:content` locally — the two new strings applied, 215 rows.
6. Hosted: `0200` and `0201` applied through the Supabase MCP and recorded in
   `public.schema_migrations` with the files' SHA-256; the two strings applied through
   `scripts/seed/emit-sql.ts`; queried afterwards for 44 tables, 175 policies, eleven slots (seven
   `CATEGORY_PINNED_*`), 215 strings, RLS on both tables, and `anon` unable to execute
   `merch_run_schedule()` or `merch_move_entry()`.

### Phase 22: the D9 ten, recorded

1. Code exists and is committed — the tables, the ladder, the swap, the block, the row, the four
   screens, the cron pass.
2. Migrations applied locally and to hosted, with ledger rows and matching counts.
3. Tests written and passing: 1,534, none skipped.
4. Gates pass, including the extended copy gate.
5. Documentation updated: DATA_MODEL (the merchandising section rewritten as built, §8.13, §12),
   STUDIO_GUIDE §8 (eleven slots, the editor, the four screens), CONTENT_GUIDE §2 (34 blocks),
   COMPONENT_REGISTRY (RC-243; RC-236's tiles), BUSINESS_RULES BR-D10, TESTING, CANONICAL-DECISIONS
   A22, CHANGELOG, PROJECT_STATE, this file.
6. No business fact fabricated: zero entries, no placeholder card, no behavioural ordering, the
   editorial tiles drawn only from a section an editor wrote.
7. Nothing in the manifest regenerated; `media:assert-no-regen` green.
8. Amendments recorded: A22.
9. The next phase is named: **23 — Global Search + Product Relationships**.
10. Hosted is level with the repository through `0201`, and level on seeded strings.

### Superseded — Phase 21's state

**Phase 21 — 3D Product Experience. CODE COMPLETE; ZERO MODELS, WHICH IS THE FINISHED STATE; THE
FLAG IS OFF.** A visitor can pick an object up and turn it over wherever a model exists, and none
does: the manifest holds no GLB, none is generated (a model's form and dimensions are a product
specification, D10), and the phase ships the viewer, the inspector, the Studio surface and four
mount points that all render nothing until the owner supplies a model with a poster.
`three_d_viewer` is OFF on both databases and stays off until then.

### Phase 21: what is built

**Migrations `0194` and `0195`, applied locally AND to hosted through the Supabase MCP, with the
ledger rows.** `media_assets.viewer_settings jsonb` shape-checked by `is_valid_viewer_settings()`;
the FEAT §14 ceilings (15 MB, 250,000 triangles) as CHECK constraints beside the inspector's words;
`media_assets_model_poster_before_association` — a model may exist without a poster and may not be
put on a page without one; `media_assets_association_is_model`; the `associated_project_id`
foreign key Phase 06 declared ahead of its table; image guards on the poster and thumbnail
references; `model_variant_labels` with `material_id is null or owner_verification <>
'NOT_REQUIRED'` and the Phase 08 authority trigger; `set_model_association()`, SECURITY INVOKER,
writing the asset side and `products.model_media_id` in one transaction. Renumbered from the phase
document's `0190` — amendment **A21**.

**THE VIEWER COSTS THE PAGE NOTHING UNTIL ASKED FOR, AND THAT IS PROVED THREE WAYS.**
`LazyModelViewerMount` puts the mount's client half behind `next/dynamic`; the island imports
`components/three/ModelViewer` with `ssr: false` only on a press or on an intersection the probe
allows (viewport ≥ 768 px, motion not reduced, `saveData` off, `deviceMemory` ≥ 4, WebGL present);
and `scripts/perf/check-bundle.mjs` walks every route's CLIENT import graph — through `'use
client'`, stopping at `'use server'` and `server-only` — and fails on any `three`,
`@react-three/*` or `meshoptimizer` specifier, proved on a planted import. The chunk measures
**303.6 kB gzipped** against the 350 kB budget. The first measurement was 391 kB: `zod` had reached
the viewer through `lib/media/model.ts`, so the viewer now reads the zod-free
`lib/media/viewer-settings.ts` and `tests/unit/model-policy.test.ts` reads the sources to keep it so.

**EVERY FEAT §12 CONTROL, BY POINTER, TOUCH AND KEYBOARD.** Orbit, zoom, pan, reset, fullscreen,
finish inspection, variant switching (a tab list with roving focus), dimension indicators, four
lighting and three environment presets built from Phase 02 palette tokens resolved from the
document at mount — no HDR, no fetch. The canvas is `role="img"` with a name and a description
listing every key; fullscreen is a fixed surface under `FocusTrap`; `Escape` leaves it, and below
768 px closes the viewer outright; under reduced motion there is no auto-rotate, no damping and no
intro. `KHR_materials_variants` is read by a first-party loader plugin (three lists the extension as
external). Draco from `public/draco/`, the Basis transcoder from `public/basis/` (fetched only for a
KTX2 texture), meshopt bundled — all from `three@0.186.0`, licences in the registry as RC-905/906/907.

**METADATA IS PARSED, NEVER TYPED.** `lib/media/inspect.ts` reads a GLB's JSON chunk with no
decoder — bytes, extensions, declared triangles (accessor counts survive compression), textures,
variants, self-containment — so the browser refuses a 20 MB uncompressed file with both reasons
named before the signature. `saveModelAction` reads the uploaded bytes back from the delivery
origin, runs the decoder pass (`lib/media/inspect-server.ts`: gltf-transform, the Node Draco
decoder `draco3d`, the same meshopt module the viewer bundles), writes `model_format`,
`file_size_bytes`, `poly_count` and `texture_count` from what it read, creates a placeholder
finish label per variant key, and DESTROYS a refused file rather than recording it.
`POST /api/studio/models/inspect` runs the same inspection without saving; `scripts/media/inspect-model.ts`
does it from the shell.

**D10 AT THE SWITCHER AND THE OVERLAY.** A label that names a material is a product fact: the CHECK
lifts it to at least `OWNER_VERIFICATION_REQUIRED`, the trigger keeps `VERIFIED` for owner and
admin, the Server Action refuses other roles with a `DENIED` audit row, and `publicVariantLabels()`
hands the material to the viewer only at `VERIFIED`. `DimensionOverlay` receives values the server
parsed from `products.dimensions` and imports no engine; a test reads its source. Posters are
chosen from the image library, never captured from the viewer (A21, BR-E3): a captured frame is a
rendering presented as a photograph.

**STUDIO.** `/studio/media/models` — `ModelUploader` (the decoder-free inspection in front of
`MediaUploader`, which gained a `preflight` step and notes), `ModelTable`, and
`ModelInspectorDrawer` opened through `?asset=`: re-inspect, poster and thumbnail, viewer settings
with the public viewer as live preview, finish labels, association. 119 Studio strings; 25 public
strings seeded under `UI_LABEL.model.*`.

**FOUR MOUNT POINTS.** `/product/[slug]` below the gallery; `/collections/[slug]` through the
`three-d-resin` block's slot (`lib/cms/references.ts` resolves the model and the materials, and the
band draws its own imagery when there is none); `/portfolio/[slug]` after the story;
`/collection/3d-resin` below the grid for every product on the page with a public model.

**A GAP FOUND AND CLOSED ON HOSTED.** 31 `global_content` rows seeded in Phases 17–20 had never
reached the hosted project — the contact form's labels among them — because `seed:content` needs a
`DATABASE_URL` the sandbox cannot open. `scripts/seed/emit-sql.ts` emits the runner's INSERTs with
the runner's own `seed_content_hash`, so the rows are indistinguishable from a runner's; 56 rows
(31 + this phase's 25) went through the MCP, and hosted holds 213, level with local.

### Phase 21: what is NOT built, and why

- **No model.** None exists, none is generated, and the phase document says so twice. The owner
  supplies the first GLB through `/studio/media/models`; until then every mount renders nothing.
- **No poster capture.** A frame rendered from a model and presented as the poster is a rendering
  presented as a photograph (BR-E3). Posters are `IMAGE` assets chosen from the library, enforced by
  `guard_model_still_references()`. Amendment A21.
- **No AR, room visualisation or 3D configurator** — out of scope by the phase document.
- **The mid-range-device timing in PERFORMANCE §8.3 is NOT YET MEASURED**, because there is no
  model to time. The chunk size is measured; the first-interactive-frame number waits for the first
  GLB.
- **The e2e suites cannot run here** (the proxy blocks the dev server's Supabase reads). Both are
  written with two branches — no mount (prove the absence is clean) and a mount (drive the poster,
  the control, the keys) — and skip with a stated reason rather than passing silently.

### Phase 21: verification, as actually run

1. `npm run typecheck`, `npm run lint` (0 errors; 6 pre-existing `no-html-link-for-pages`
   warnings in e2e fixtures), `npm run format:check`, every `npm run check` gate including the new
   `perf:check-bundle` — green.
2. `npm test` with `DATABASE_URL` on the local PostgreSQL 16 cluster: **1,502 tests across 113
   files, none skipped** — 1,234 in the unit project (34 in `model-policy`, 19 in `model-inspect`
   including a Draco file encoded and decoded end to end, 7 in `model-mount`) and 268 in the RLS
   project (11 in `phase21`: a label is readable by anon exactly while its model is PUBLISHED; anon
   and the researcher cannot write one; an editor can; a material on a NOT_REQUIRED label is
   refused for every role; a merchandiser can mark a label awaiting the owner and cannot mark it
   VERIFIED; the owner can; `set_model_association()` is not callable by anon, fails as a whole for
   an editor with both sides unchanged, writes both sides for the owner, and is refused without a
   poster).
3. `db:check-migrations` (57 migrations to `0195`), `db:check-schema` (42 tables, RLS on all),
   `auth:check-rls` (165 policies) and `auth:check-policies` — green locally; the same counts
   confirmed on hosted by query after the MCP apply.
4. Every 0194 constraint, trigger and the association function probed by SQL with savepoints:
   eighteen expectations, all met (viewer_settings shape, min < max, unknown key, bad camera, 16 MB,
   250,001 triangles, association without a poster, self as poster, label with material and
   NOT_REQUIRED, label on an IMAGE, both targets, moving a model between products releases the
   first, clearing releases both sides, a product pointing at an IMAGE).
5. The viewer chunk bundled standalone with esbuild 0.24 and measured: 303.6 kB gzipped, 252 kB
   brotli, with the composition recorded in PERFORMANCE §8.3.
6. `scripts/perf/check-bundle.mjs` run clean, then run against a planted static import of the
   viewer in `ProductGallery` — it named the file, the chain and the specifier — then restored.
7. Hosted: `0194` and `0195` applied through the Supabase MCP and recorded in
   `public.schema_migrations` with the files' SHA-256; queried afterwards for 5 label policies, 9
   media_assets checks, 8 functions, 165 policies total, and `anon` unable to execute
   `set_model_association()`. Feature flags on hosted: `commission_configurator` ON,
   `three_d_viewer` OFF.

### Phase 21: the D9 ten, recorded

1. Code exists and is committed — the viewer, the inspector, the Studio surface, the four mounts.
2. Migrations applied locally and to hosted, with ledger rows and matching counts.
3. Tests written and passing: 1,502, none skipped.
4. Gates pass, including the one this phase added.
5. Documentation updated: PERFORMANCE §4.3/§8.3, MEDIA_GUIDE §7.3 and §8, COMPONENT_REGISTRY
   (RC-228, RC-401 built; RC-904/905/906 approved with licences; RC-907 added), DATA_MODEL
   (§12 re-registered, `model_variant_labels`, the media_assets checks), STUDIO_GUIDE §10.3,
   SECURITY §3 and §7.1, BUSINESS_RULES BR-E7, TESTING §4 and §6, ENVIRONMENT (the emitter),
   CANONICAL-DECISIONS A21, CHANGELOG, PROJECT_STATE, this file.
6. No business fact fabricated: zero models, no captured posters, material names only at VERIFIED,
   dimensions only from `products.dimensions`, every viewer string a `global_content` row.
7. Nothing in the manifest regenerated; `media:assert-no-regen` green.
8. Amendments recorded: A21.
9. The next phase is named: **22 — Homepage / Store Merchandising**.
10. Hosted is level with the repository through `0195`, and level on seeded strings for the first
    time since Phase 17.

### Superseded — Phase 20's state

**Phase 20 — Inquiry + WhatsApp Flow. CODE COMPLETE; THE INBOX IS EMPTY, WHICH IS THE FINISHED
STATE.** The conversion model is real: an enquiry is validated, written and given a reference code
BEFORE any WhatsApp message is composed, and a failed write produces no URL because the failure
member of the returned union has no such property. `commission_configurator` is switched ON, on both
databases — and nothing appears on `/custom-commissions` yet, because all three commission templates
are still DRAFT. The flag says the feature is built; publishing a form is the owner's editorial act.

### Phase 20: what is built

**Migrations `0190`, `0191` and `0193`, applied locally AND to hosted.** Three tables, four enums,
the reference-code sequence, seven functions, the generated RLS — the first policy file in this
repository to carry an anon INSERT — and a narrowing of the append-only trigger that the test suite
forced (below).

**`inquiries` IS THE ONLY TABLE A STRANGER MAY WRITE AND THE ONLY WRITE WITH NO SESSION BEHIND IT.**
D1 forbids customer accounts, so the person filling in the form is nobody: the `with check` is doing
the work `requirePermission` does everywhere else. Probed under `set role anon`: a forged
`pipeline_status`, a forged `assigned_to`, a forged `updated_by` and a forged `whatsapp_state` are
each refused, and the trigger discards a `reference_code` the caller supplied.

**THERE IS NO ANON SELECT ON ANY OF THE THREE.** An enquiry carries a name, a phone number and a
city; one `using (true)` and the customer list is a GET away with the publishable key that ships in
every browser. `tests/unit/rls/phase20.test.ts` asserts the zero, including that anon cannot read
the row it has just written.

**`INSERT ... RETURNING` DOES NOT WORK FOR `anon` ON A TABLE WITH NO SELECT POLICY**, and finding
that out changed the write path. PostgreSQL applies the SELECT policy to the RETURNING clause, so
the insert succeeds, the read-back is refused, and the error is `new row violates row-level security
policy` — which reads exactly like a rejected write and is not one. The application generates the
id; `inquiry_reference_code()` returns the trigger-allocated code for a ten-minute window. Amendment
**A20**.

**THE APPEND-ONLY LOG COULD NOT BE DELETED, AND THE RLS SUITE FOUND IT.** `inquiry_events` refused
UPDATE and DELETE outright, including the CASCADE from `inquiries` — so deleting an enquiry was
impossible for anybody, superuser included, and the suite could not clean up its own fixture.
"Nothing deletes an enquiry" is a rule about the STUDIO and is enforced there (no delete policy for
any session role; SPAM and ARCHIVED are statuses so a judgement can be reversed). Migration `0193`
narrows the trigger: an event may go only when its enquiry is already gone.

**THE FIVE-LEVEL LADDER REPLACES PHASE 10's TWO STEPS.** "The longest field" is not "the least
valuable field": a 400-character requirements note is the most valuable thing in the message and was
the first thing the old version cut. `tests/unit/whatsapp-shorten.test.ts` exercises each rung by
making the message too long in exactly one way, and asserts the reference code survives all five.
Level 5 re-renders the same template with the non-essential tokens emptied, so it invents no words.

**`contact-form` IS THE FIRST BLOCK PROMOTED FROM PLANNED TO BUILT.** Declared in Phase 08, seeded
in Phase 09, built now. Its fields are fixed (they map to columns) and its enquiry types are not
(the list is editorial).

**THE PRODUCT ENQUIRY NEEDS NO DIALOG.** Phase 15's rail already links to
`/contact?product=<slug>&type=product`; the form reads the slug after mount and files against it. A
slug that no longer resolves files a GENERAL enquiry rather than refusing one.

**THE CONFIGURATOR'S SUBMIT IS LIVE AND PHASE 19 NEEDED NO UNPICKING.** Passing the new `submit`
prop turns it on; without it the island still renders the disabled button, which is what the
flag-off state and `tests/e2e/configurator.spec.ts` describe.

### Phase 20: what is NOT built, and why

- **No `global_content` group `CONTACT`.** SEED §21's four facts already live in one
  `contact-details` section that the footer and `/contact` both read; a second home is the failure
  §21's own sentence warns about. Amendment A20, and verification step 1 therefore returns nothing.
- **No `inquiry_attachments` anon INSERT**, though the phase document names one: an attachment
  references `media_assets` and anon cannot create one, so the policy would describe a path that
  cannot satisfy its own foreign key. `attach_inquiry_references()` is SECURITY DEFINER instead.
- **No `VIEWED` event.** The enum has it; Phase 20 writes none. A row per page render is how an
  audit trail becomes noise, and a GET with a side effect is a GET that cannot be retried.
- **No product enquiry DIALOG.** See above — the rail's existing link is the path.
- **No CONSULTATION surface.** The kind exists and the view is filled; nothing on the public site
  produces one yet, and inventing a "book a consultation" button would be inventing a service.
- **Nothing published on `/custom-commissions`.** The flag is on and all three templates are DRAFT.

### Phase 20: verification, as actually run

- `npm test` with `DATABASE_URL` set — **1432 pass, none skipped** (109 files).
- `npm run check` — clean. `db:check-migrations` — 55 migrations to `0193`, every number allocated.
- `db:check-schema` — 41 tables, RLS on all, column tiers correct. `auth:check-rls` — 41 tables,
  160 policies, every staff-select role list matching the matrix. `auth:check-policies` — the four
  generated files match. `db:check-types` — the generated types match the database.
- **The anonymous path probed directly under `set role anon`**: insert accepted, zero rows readable
  back, four forged columns refused, the supplied reference code discarded, the reference function
  returning `RIV-2026-…`, a `rivya/brand/` attachment silently not attached and an incoming one
  attached as `USER_UPLOAD`/`DRAFT`, and the handoff recorded once and refused the second time.
- Hosted level through `0193` and matching local exactly: 41 tables, 160 policies, 55 migrations.
- `commission_configurator` switched on in both databases.
- **Playwright did not run.** The sandbox network policy denies the Supabase host, so `next dev`
  cannot serve a page. `tests/e2e/inquiry-flow.spec.ts` is written to skip with a stated reason.

### Phase 20: the D9 ten, recorded

1. **Scope implemented** — the three tables and their RLS, the schemas and repository, the five-rung
   ladder and the number resolution, `submitInquiry`, the contact form, the product path, the
   configurator's submit, the five-view inbox with its detail screen, the audited export, the flag.
2. **Relevant tests run** — 1432 pass, none skipped; the e2e suite skips for a stated environmental
   reason.
3. **No known scope-breaking error.** The cascade defect the suite found is fixed in `0193`.
4. **Documentation updated** — CANONICAL-DECISIONS **A20**, DATA_MODEL §12 and the tier table,
   BUSINESS_RULES BR-B1/BR-B2, SECURITY §8, STUDIO_GUIDE §11.
5. **CHANGELOG updated.**
6. **PROJECT_STATE updated**, including the phase table.
7. **SESSION-STATE updated** — this section.
8. **Remaining issues documented** — see below.
9. **Next phase identified** — **Phase 21, 3D Product Experience.** Its flag, `three_d_viewer`, is
   registered and off.
10. **Repository recoverable** — every commit pushed to `claude/rivya-living-art-phases-64hq5i` and
    merged to `main` at the owner's instruction.

### Standing issues, carried

- **CI was red on every run from 9 September until the repository went public on 10 September** —
  real failures first (the unit step running the RLS project before `db:reset`, the idempotency
  step asserting a pre-Phase-09 shape, the seed failing on a media-less database, three design
  gates outside `npm run check`, and a build step with no Supabase URL to pre-render from), then
  no runner at all once the private repository's Actions minutes were spent. All five causes are
  fixed after the Phase 21/22 merge; the `verify` job on the fix is the first green run of this
  branch's history and the reference point from here on. The build now runs in CI against
  `scripts/db/local-rest.mjs` over the job's own seeded database (`docs/ops/ENVIRONMENT.md`,
  "GitHub Actions"), so `security:check-bundle` inspects real output there. `npm run check` now
  includes the three design gates. What `npm run check` still does NOT run locally, because it
  needs a database or a build: `db:reset`, `db:check-types`, `content:check-inventory`, the seed
  idempotency walk, `security:check-bundle`. Run them before a phase closeout.

- **Hosted seeded strings were 56 rows behind local until Phase 21** — 31 of them from Phases
  17–20, including the contact form's field labels. Closed through `scripts/seed/emit-sql.ts`
  and the MCP; the two databases now hold 213 each. Any future seed module needs the same step
  until `DATABASE_URL` to hosted is reachable from where the runner runs.

- `verify` is red on the account's Actions runner with a signature that is not a code failure
  (`runner_id: 0`, ~2s, no steps, red on `main` too) and is **not re-run**, per the free-tier
  instruction.
- The Playwright suite cannot execute here: the network policy denies the Supabase host.
- **Six secrets remain exposed in chat transcripts and unrotated** — the owner's task, after all
  phase work.
- **`content/seed/contact.ts` holds the studio's real phone number, WhatsApp number and email, and
  they are seeded `OWNER_VERIFICATION_REQUIRED`.** From Phase 20 that verification state is
  load-bearing rather than bookkeeping: `resolveWhatsAppNumber` will not dial a number the owner has
  not confirmed, so until the `contact-details` section is VERIFIED the handoff falls back to
  `NEXT_PUBLIC_WHATSAPP_NUMBER` and, if that is unset, records `whatsapp_state = 'UNAVAILABLE'`. The
  enquiry is saved either way. **Verifying that section is an owner action, not a developer one.**
- **`content/seed/media-bindings.ts` is still EMPTY**, and its header still says the Higgsfield
  migration "has never executed". It has: 250 assets are in Cloudinary and in `media_assets` on both
  databases. So every seeded SECTION on the site is still unbound and renders the SEED §47 fallback.
  Journal covers are unaffected — they bind through the article record's own `media` map — but the
  wider binding pass is outstanding work that belongs to nobody's phase yet.
- **`npm test` wipes the local seeded content.** `tests/unit/rls/phase08.test.ts` blanket-deletes
  `pages` and `page_sections`, so re-run `seed:content` before checking any seeded-content claim
  locally. This cost a confused half-hour chasing a "93 inserted" that was simply the suite's doing.
- **A schema fingerprint must fix `search_path` on both sides.** `pg_get_indexdef` renders an
  operator class according to the reader's path, so the same index reads as
  `extensions.gin_trgm_ops` locally and `gin_trgm_ops` on hosted.
- **Hosted carries 20 of the 30 demonstration products, the six categories, and nothing else of the
  demonstration content.** The owner authorised the data and chose to publish it live; the run was
  interrupted part way through the third batch and has not been resumed. **Awaiting the owner:
  finish it, roll it back, or leave it.** Nothing further should be written to hosted demo content
  until that is answered. `npm run demo:purge` removes every marked row in one command either way.
- **The local cluster stops when the container idles**, and the RLS suite then fails with
  `ECONNREFUSED 127.0.0.1:5433` on three function-grant tests before the rest skip. Restart with
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/rivya/data -o '-p 5433' -l /var/lib/postgresql/rivya/pg.log start"`
  and re-run; it is never a code failure.

### Superseded — Phase 19's state

**Phase 19 — Bespoke / Custom Configurator. CODE COMPLETE; THE FEATURE IS SWITCHED OFF, WHICH IS THE
FINISHED STATE.** Eleven steps exist, every question read from the database, and the Zod schema is
generated from the same rows. It ends at a VALIDATED PAYLOAD: the review step's Submit button is
rendered disabled with no handler, because D1 requires an inquiry to be persisted before any
WhatsApp redirect and persistence is Phase 20's. `commission_configurator` ships OFF, so
`/custom-commissions` still renders its six Phase 09 sections and no visitor sees a form that would
save nothing.

### Phase 19: what is built

**Migrations `0170`–`0172` and `0184`, applied locally AND to hosted**, plus `0180`–`0183` from the
same session. Four form tables, `feature_flags`, the generated RLS, the demonstration marker, the
publication-date fix, the rate limiter and its RLS, and the duplicate function.

**A REFUSING CONSTRAINT TRIGGER CANNOT SURVIVE PostgREST.** Studio writes one row per statement per
transaction, so reordering ten steps means ten transactions, nine of them transiently illegal —
and `deferrable` does not help, because "deferred" means "at commit" and each statement commits
alone. `normalise_form_step_order()` REPAIRS instead of refusing, and forces `contact` last;
`cms_set_form_step_order` assigns every position in ONE statement so the repair pass is a no-op and
a single reorder writes half the revision history it otherwise would.

**A FORM CANNOT BE PUBLISHED WITHOUT SOMEWHERE TO REPLY TO.** `enforce_form_publishable()` refuses
PUBLISHED for a form with no enabled `contact` step, a contact step asking for neither a phone
number nor an email address, or an enabled choice question with no choices. The builder states all
three above the button and re-computes them in the action so every failure is reported at once.

**NOTHING IN THIS GROUP CAN HOLD A PRICE.** `validation` carries an allowlist CHECK of nine Zod
keys; the field-type enum has no money in it. `tests/unit/no-pricing.test.ts` greps the migration
and is mutation-tested — and it originally PASSED both mutations: SQL doubles a quote where
JavaScript backslashes it, so a JS string-stripper run over SQL inverts pairing from the first
doubled quote onward; and `\b` creates no boundary before `_`, so `\bprice\b` cannot match
`price_modifier`. Both are fixed and both mutations now fail.

**ZOD 4 SKIPS AN ABSENT OPTIONAL KEY ENTIRELY.** `z.object` decides a key is optional from whether
its INPUT type admits `undefined`, so `z.preprocess(fn, schema.optional()).refine(v => v !==
undefined)` never runs for a MISSING key — a required field whose key was absent passed validation.
Verified empirically; `unansweredRequired()` now checks presence outside the schema.

**THE FLAG REGISTER LIVES IN THE CODE, NOT THE TABLE.** A flag key is an identifier that breaks its
call sites when removed; `feature_flags` holds only the flags somebody has TOUCHED, so absent is off
and a fresh database, a restored backup and a preview branch behave identically with nothing seeded.
`isEnabled()` is server-side, so an off feature is absent from the response rather than hidden in
it. `/studio/system/flags` reads for all six roles — amendment **A17**, closing STUDIO_GUIDE open
question 5 — and writes for owner and admin, with the switch ABSENT rather than disabled for anyone
else.

**THE RATE LIMITER ARRIVED TWENTY-TWO PHASES EARLY** — amendment **A18**.
`app/api/inquiries/upload-sign` is unauthenticated by design (D1 forbids a visitor account), and an
unlimited credential minter is an open file host with Rivya's Cloudinary bill attached.
`consume_rate_limit()` counts and decides in one statement, the key is a salted hash rather than an
address, and it fails CLOSED.

**THE BUILDER IS ONE COLLAPSED COLUMN AND THERE IS NO LIVE PREVIEW** — amendment **A19**, which
records the divergence from STUDIO_GUIDE §7.6's two-pane sentence. Mounting the real configurator in
the Studio would overwrite a visitor's `sessionStorage` draft in the same browser and spend the
rate-limit allowance protecting the upload endpoint. *Duplicate from template* IS built, as
`cms_duplicate_customization_form()` (`0184`): the whole copy in one transaction, because three
PostgREST writes are three transactions and an interruption between the steps and the questions
leaves a form that looks finished and asks nothing.

**`npm run db:check-data-layer` WAS RED AND IS NOW GREEN.** Two calls reached PostgREST outside the
repository layer — `consume_rate_limit` from `lib/security/rate-limit.ts`, and the journal's curated
strip, which was also casting rows with `as unknown as` and so skipping Zod. Both now go through
repositories.

### Phase 19: what is NOT built, and why

- **No submission.** The review step's Submit is disabled with no handler. Phase 20 persists the
  inquiry and hands off to WhatsApp; D1 requires the save first, so a working button here would
  either drop the brief or redirect with nothing stored.
- **`commission_configurator` is OFF**, and Phase 20's exit criteria are what switch it on.
- **No live preview pane in the builder**, and no `validation` editor — both A19, both with the
  reason recorded rather than left to be rediscovered.
- **No form deletion.** Steps and questions can be deleted under `destructive.execute`; a form
  cannot, because nothing yet cleans up the bindings and revisions a deleted form leaves, and an
  unpublished form costs nothing.
- **No secondary "preview as visitor" session.** See A19.

### Phase 19: verification, as actually run

- `npm test` with `DATABASE_URL` set — **1388 pass, none skipped** (106 files).
- `npm run check` — clean.
- `npm run db:check-migrations` — 52 migrations to `0184`, every number allocated in DATA_MODEL §12.
- `npm run db:check-schema` — 38 tables, RLS on all, column tiers correct, D10 gate on all 12
  content tables.
- `npm run auth:check-rls` — 38 tables, 153 policies, every staff-select role list matching the
  matrix. `npm run auth:check-policies` — the three generated files match.
- `npm run db:check-data-layer` — green again; see above.
- **`cms_duplicate_customization_form()` probed against the local database**: the furniture template
  copied to 11 steps and 16 questions, each question under the right step, DRAFT, not default, no
  seed identity — and an `EXCEPT` both ways between source and copy over key, position, type,
  options, validation, required and WhatsApp flags returned **0 rows in each direction**. The copy
  was then deleted.
- Hosted verified directly: the function exists as SECURITY INVOKER with `anon` revoked and
  `authenticated` retained, and its ledger row carries the file's checksum.
- **Playwright did not run.** The sandbox network policy denies the Supabase host, so `next dev`
  cannot serve a page. `tests/e2e/configurator.spec.ts` is written to skip with a stated reason
  rather than to be deleted.

### Phase 19: the D9 ten, recorded

1. **Scope implemented** — the four tables and `feature_flags`, the RLS, the seed resolution, the
   configurator island and its block, the public upload endpoint and its limiter, both Studio
   surfaces, the duplicate function, the flags module, the tests.
2. **Relevant tests run** — 1388 pass, none skipped; the e2e suite skips for a stated environmental
   reason.
3. **No known scope-breaking error.** The data-layer gate that was red is fixed.
4. **Documentation updated** — CANONICAL-DECISIONS A17/A18/**A19**, DATA_MODEL §12 (`0180`–`0184`)
   and the column tiers, BUSINESS_RULES BR-F2b/BR-F4b, STUDIO_GUIDE §7.6 and §13.12 (open question 5
   closed), DEMO_CONTENT.md.
5. **CHANGELOG updated.**
6. **PROJECT_STATE updated.**
7. **SESSION-STATE updated** — this section.
8. **Remaining issues documented** — see below.
9. **Next phase identified** — **Phase 20, Inquiry & WhatsApp Handoff.** It persists the brief this
   phase validates, and its exit criteria are what switch `commission_configurator` on.
10. **Repository recoverable** — every commit pushed to `claude/rivya-living-art-phases-64hq5i`.

### Superseded — Phase 18's state

**Phase 18 — Journal. CODE COMPLETE; NOTHING IS PUBLISHED, WHICH IS THE FINISHED STATE.** Nine
categories and ten article IDEAS exist — a title and an angle each, no body. SEED §20 says in
capitals: seed as DRAFT, do not publish automatically. `/journal` renders SEED §29's sentence; every
article URL 404s; the nine category pages render with empty lists.

### Phase 18: what is built

**Migrations `0160`/`0161`, applied locally AND to hosted.** Three tables, `pages.kind += ARTICLE`,
two triggers that turn phase-document prose into schema rules, and the generated RLS file.

**`reading_minutes` IS DERIVED BY A TRIGGER, WHICH IS WHAT "NEVER TYPED" HAS TO MEAN.** The phase
says the value is computed at 200 words per minute; leaving that to the application makes it derived
only on the paths that remembered. `set_article_reading_minutes()` overwrites the column from the
linked page's VISIBLE sections on every write — probed with 999, stored NULL. It reads `heading`,
`body` and `supporting` and not `payload`, which is block configuration. NULL rather than 1 when
there is nothing to read.

**AN ARTICLE CANNOT BE PUBLISHED WITHOUT A BODY.** The risk table assigns that to
`lib/cms/publishing.ts`; `enforce_article_has_body()` is the copy that cannot be bypassed. No page,
an empty page and a page whose only section is hidden are all refused, each naming the article.

**THE ONLY DATE-GATED PUBLIC READ ON THE SITE.** `published_at <= now()` alongside the status, which
is both the scheduling mechanism and the guard that does not depend on a cron running on time.

**THE SEED'S FIELD NAMES WERE WRONG, AND THE MISTAKE WAS A PUBLISHING ONE.** Phase 09's records put
each article's ANGLE — the studio's internal brief — into `excerpt`, which is what a card renders.
Ten briefs would have appeared on `/journal` as summaries the moment anything went live. The angle
now lives in `angle_note`; `excerpt` is null.

**`lib/cms/related.ts` HOLDS FEAT §11's ONE AUTOMATIC RULE**, with the reason a rule exists at all
written beside it. Curated first; below three, fill from the same primary category, newest first,
excluding this article and anything a curated edge already points at. Mutation-checked: removing the
dedupe fails the test.

**THREE GUARDS FIRED AND ALL THREE WERE RIGHT.** `site-routes` caught two undeclared route families.
`seed-modules` caught a new seed-key namespace and changed the design — `journal-ui.ts` follows
`global:UI_LABEL.*` like its two most recent siblings. `studio-nav` caught
`/studio/content/journal/categories`, which D4 did not list; recorded as **amendment A16**.

**`Pagination` (RC-234) LOST ITS TWO COUPLINGS TO THE CATALOGUE** — a `CatalogQuery` and
`UI_LABEL.catalog.*` — and now takes `hrefFor` and four resolved labels.

### Phase 18: what is NOT built, and why

- **No article bodies, and no published article.** SEED §20 forbids both. The ten ideas are briefs.
- **No RSS feed.** The phase lists `/journal/rss.xml` and holds it behind an amendment nobody has
  granted; its own verification says to assert the 404 and the absent feed link instead, which
  `tests/e2e/journal.spec.ts` does.
- **No `unpublish_at`.** The phase's Studio section names one and its own Database section gives
  `journal_articles` no such column. Scheduling forward works; taking an article down is a button.
- **No secondary categories in the Studio.** `journal_article_categories` exists with its RLS; the
  editor sets the primary one, which is what the related rule and the category pages read. A second
  picker for a relationship nothing yet renders would be a control with no effect.
- **The related strip resolves article edges only.** An editor can already link an article to a
  product, a project or a collection, and both of those tables hold zero published rows — a strip
  that resolved them would render an empty heading on every article.

### Phase 18: verification, as actually run

- `npm test` — 1339 pass, none skipped.
- `npm run check` — clean.
- `seed:content` — nine categories, ten DRAFT articles, zero published, all covered and filed; a
  second run reports zero changes; only Phase 19's three commission forms remain deferred.
- The four journal behaviours probed directly on hosted, inside a block that rolled itself back:
  a typed `reading_minutes` discarded, the no-body publish refused by name, the page path synced on
  link, and 400 words → 2 minutes.
- Hosted level through `0161`, fingerprint-matched against local over the journal objects — 178
  lines, `f55c1a1e3258265162046c0288386bb0`.
- **Playwright did not run.** The sandbox network policy denies the Supabase host.

### Phase 18: the D9 ten, recorded

1. **Scope implemented** — migrations, both triggers, schemas, repositories, the related rule, the
   seed resolution, three public routes, RC-220, the Studio editor and categories screen, tests.
2. **Relevant tests run** — 1339 pass, none skipped; the e2e suite skips for a stated environmental
   reason.
3. **No known scope-breaking error.**
4. **Documentation updated** — DATA_MODEL §Journal, CONTENT_GUIDE, STUDIO_GUIDE §11 and its
   guardrails, COMPONENT_REGISTRY RC-220 and RC-234, CANONICAL-DECISIONS A16 and the D4 map.
5. **CHANGELOG updated.**
6. **PROJECT_STATE updated**, including the phase table.
7. **SESSION-STATE updated** — this section.
8. **Remaining issues documented** — see below.
9. **Next phase identified** — **Phase 19, Bespoke / Custom Configurator.**
10. **Repository recoverable** — every commit pushed to `claude/rivya-living-art-phases-64hq5i`.

### Superseded — Phase 17's state

**Phase 17 — Portfolio / Projects. CODE COMPLETE; THE ARCHIVE IS EMPTY, WHICH IS THE FINISHED
STATE.** `portfolio_projects`, `portfolio_project_media` and `testimonials` exist and hold zero
rows. `/portfolio` renders SEED §28's empty state; `/portfolio/[slug]` answers 404 for every slug.
A project exists when the owner enters one, confirms it happened, and — if it names a client —
records that client's consent. Nothing in this repository may do any of those on their behalf.

### Phase 17: what is built

**Migrations `0150`–`0153`, applied locally AND to hosted.** `0150` creates the three tables, the
`client_consent_state` enum, both evidence gates, `reject_concept_project_media`, `PROJECT` on the
`pages.kind` check and the extension to `sync_entity_page_status`. `0151` is the GENERATED RLS file.
`0152` fixes the `evidence_note` exposure. `0153` adds `sync_project_page_path`. No enum split was
needed this time: a BRAND-NEW type is usable in the transaction that creates it — only
`ALTER TYPE … ADD VALUE` is restricted, which is what forced the split in Phases 14 and 16.

**TWO gate functions, one per table.** The data model described one shared `enforce_evidence_gate()`
and that design cannot work: plpgsql resolves a record field at execution, so a single function
referencing `client_display_name` and `attributed_to` is created without complaint and then raises
`record "new" has no field …` on the first write to whichever table it was not written for.
`DATA_MODEL.md` §8.12 is corrected and renumbered — it carried §8.6, which
`products.specifications_omitted` already holds and two other lines cite.

**THE GATE ORDERING BUG, found by probing rather than by reading.** The phase document's own
pseudo-code puts the `WITHDRAWN` branch LAST. With that ordering, withdrawing consent on a row that
is currently PUBLISHED is REFUSED — the statement meets the publish check on its way past, the check
fails, the write is rejected, and the project stays live under the name of the person who has just
asked not to be named. Both gates handle withdrawal FIRST and unconditionally. Amendment A15·a.

**`evidence_note` is unreadable to `anon`, and the first fix did nothing.** RLS filters ROWS, not
COLUMNS. A column-level `REVOKE` was applied and measured: `has_column_privilege` stayed true,
because the table-level `GRANT` covers it. `0152` revokes `SELECT` on the table from `anon` and
re-grants a named column list. `select *` is consequently refused for `anon` on that table, which is
the intended shape: a careless public read fails loudly rather than leaking.

**`lib/portfolio/gates.ts` is a pure mirror of both triggers**, and
`tests/unit/rls/phase17.test.ts` is an agreement test: for every combination of verification, name
and consent it asks the mirror whether the row may publish, asks the DATABASE to publish the same
row, and requires the two answers to match. Mutation-checked — the test was shown to fail when the
mirror was altered.

**The Studio authors a project end to end.** `/studio/content/portfolio` lists with a permanent
zero-row explanation and creates from a title and an address; `[projectId]` carries Verification
(first, because "why is this not live" is the question an editor arrives with), Identity, Client and
consent as a separate form with a separate permission, the story page, the gallery and related
content, with publish and unpublish under the panel. `/studio/content/testimonials` does the same
for quotes.

**Three things caught before they shipped.**
- The editor first reused the collection editor's `setRelationAction`, which hardcodes
  `source_type = 'COLLECTION'`; every edge made from a project would have claimed the project's id
  was a collection. It has its own action now, with the source type as a compile-time constant.
  `ActionForm` typed its state by importing `CollectionActionState` from that editor — which is what
  let the mistake type-check — and now takes a shared `StudioFormState`.
- Reading an absent `client_consent` as `NOT_APPLICABLE` would have erased a recorded consent, its
  date and its recorder, by unticking a checkbox. Absence means unchanged.
- The `/portfolio` empty state had never seeded SEED §28's HEADING — only its body — so the page had
  been rendering half of it since Phase 09. Found by writing the test that asserts both lines.

**RC-219 `PortfolioCard`** replaces Phase 11's `ReferenceCards` placeholder for projects: 3:2 at
every width, `project_type` as a text eyebrow, and no date, client or location — `EntityCard` does
not carry them.

### Phase 17: what is NOT built, and why

- **No project, no project photograph, no testimonial.** Not an omission: none of the three tables
  is in `SeedableTable`, so a seed record targeting one does not compile, and D10 forbids inventing
  the content anyway. The 30 products the owner asked for earlier remain blocked on the same rule.
- **No `CreativeWork` JSON-LD on a project page.** It would want a creator, a date and an image, and
  each is a business fact that is absent or gated. Structured data is read by machines that cannot
  see the page's carefulness.
- **No drag ordering in the gallery** (amendment A15·d): keyboard-unreachable, needs a client
  library, and does not work with JavaScript off.
- **No testimonial rendering on the public site beyond the block that draws nothing** — there are no
  consented quotes to draw.

### Phase 17: verification, as actually run

- `npm test` — 1316 pass, none skipped, including the 32-case agreement test and the new
  `portfolio-empty` suite.
- `npm run check` — clean: format, lint, types, the data-layer and migration-content gates, the
  copy-in-JSX gate, the client-boundary walk, the island budget and the WhatsApp usage gate.
- The concept-media refusal was probed directly against the local cluster: SQLSTATE `23514`,
  message `concept media cannot be attached to a portfolio project (…)` — which is the string the
  editor's refusal matcher looks for, so the wording is tied to a test rather than hoped for.
- The empty-state assertion was mutation-checked: removing the seeded heading fails it.
- Hosted is level through `0153`, fingerprint-verified against local — 146 lines,
  `79215119657489fc98cdff8f6ead4d5c` on both.
- **Playwright did not run.** The sandbox network policy denies the Supabase host, so every route
  answers 500. `tests/e2e/portfolio.spec.ts` detects that through a baseline route and skips with
  the reason rather than reporting a false failure.

### Phase 17: the D9 ten, recorded

1. **Scope implemented** — migrations, both gates, schemas, repositories, the block, the public
   routes, both Studio surfaces, the card pattern and the tests. Four spec departures recorded in
   A15 rather than taken silently.
2. **Relevant tests run** — 1316 pass, none skipped; the e2e suite skips for a stated environmental
   reason.
3. **No known scope-breaking error.**
4. **Documentation updated** — DATA_MODEL §8.12 (corrected and renumbered) and §9,
   BUSINESS_RULES BR-D5/BR-D9/BR-H3, STUDIO_GUIDE §11 and the guardrail register,
   COMPONENT_REGISTRY RC-219, CANONICAL-DECISIONS A15.
5. **CHANGELOG updated.**
6. **PROJECT_STATE updated** — including the phase table, which had stopped at 14.
7. **SESSION-STATE updated** — this section.
8. **Remaining issues documented** — `verify` red on the account's Actions runner and not re-run,
   per the free-tier instruction; the e2e suite unrunnable here; six secrets still unrotated. The
   §28 heading is applied on BOTH local and hosted: `seed:content` wrote it locally and reports zero
   changes on a second run, and hosted was updated in place carrying the runner's own
   `seed_content_hash`, so the next seed run there still recognises the row as its own rather than
   as owner-edited.
9. **Next phase identified** — **Phase 18, Journal.**
10. **Repository recoverable** — every commit pushed to `claude/rivya-living-art-phases-64hq5i`.

### Superseded — Phase 16's state

**Phase 16 — Collections as Exhibitions. CODE COMPLETE; NOTHING IS PUBLISHED, WHICH IS THE FINISHED
STATE.** Ten collection concepts exist as a name, a slug and an order. None is confirmed, none is
published, none has an exhibition page, and `/collections/<any slug>` answers 404. FEAT §9 asks for
exactly that: a collection is a concept until the owner says it is real, and nothing in this
repository may say so on their behalf.

### Phase 16: what is built

**Migrations `0140`–`0142`, LOCAL ONLY.** `0140` adds `OWNER_CONFIRMED` and `RETIRED` to
`collection_concept_state` and nothing else — `db:migrate` runs each file in one transaction and
PostgreSQL refuses to USE an enum value added in it, so the transaction boundary has to be a file
(measured; Phase 14 needed the same split). `0141` adds the eight `collections` columns,
`entity_relations`, the two new enums, `COLLECTION` on the `pages.kind` check, the publish gate, the
concept-authority trigger and the two sync triggers. `0142` is the GENERATED RLS file.

**APPLIED TO HOSTED, AND FINGERPRINT-MATCHED.** `0140`–`0143` are on `ccvarsmzickdkryoakdg` with
ledger rows carrying the runner's own SHA-256, so `db:migrate` sees them as applied and unedited.
(`0143` turned out to be outstanding there too — hosted was at `0132`, not `0143` as an earlier
draft of this file claimed.) A 106-line fingerprint over columns, constraints, policies, indexes,
triggers, function bodies, security flags, ACLs and enum values matched local exactly:
`634f45127e65b14242324683344542b1` on both.

That match took a correction worth recording. The first comparison agreed on 106 lines but not on
the hash, and the difference was three function BODIES — `enforce_collection_concept_authority`,
`sync_collection_page_path` and `sync_entity_page_status`. `pg_get_functiondef` returns the stored
text INCLUDING its comments, and those were the three functions whose inline comments I had dropped
when inlining the SQL into the MCP call. Behaviour was identical; the hosted definitions were simply
poorer to read. Re-applied verbatim, and the hashes then matched.

**The gates were proved to BEHAVE on hosted, not merely to exist.** A probe inside a single
statement created a collection, tried to publish it, tried a self-edge and tried a blank note, then
raised deliberately so the whole thing rolled back: `collection zz-hosted-gate-probe cannot be
published while concept_state = DRAFT_COLLECTION_CONCEPT (FEAT §9)`,
`entity_relations_no_self`, `entity_relations_note_present`. Nothing was left behind — verified.

**The ten concepts are replayed to hosted**, inserted with the same seed metadata local holds, all
ten slugs returned by the insert. The row-level content fingerprint comparison was not run: the
tool call was declined.

**The two gates.** `enforce_collection_publish_gate()` refuses PUBLISHED unless the concept is
OWNER_CONFIRMED; `enforce_collection_concept_authority()` refuses the confirmation to anyone but
owner or admin and stamps `owner_confirmed_at`/`_by` from the session, clearing them on withdrawal.
A merchandiser CAN update `collections` under RLS — only this trigger stops the confirm — which is
why the Studio checks `content.verify` as well.

**`sync_entity_page_status` runs PAGE → COLLECTION**, and the direction is measured rather than
preferred: the reverse has no legal transition edge and crosses two disjoint permission sets that
`SECURITY DEFINER` cannot bridge. Verified: publishing an unconfirmed concept's page raises
`collection unconf cannot be published while concept_state = DRAFT_COLLECTION_CONCEPT`, naming the
collection, and the page stays unpublished.

**Two blocks, taking the catalogue to 30** (amendment A14): `collection-products` and
`signature-media`, each with a renderer, both registries and the type tuple in agreement.

**The exhibition route** `/collections/[slug]` is a CMS page — every band is a `page_sections` row,
rendered by the same `renderCmsPage` that serves `/about`. It adds only the `CollectionPage`
JSON-LD. The sitemap needed no change.

**The Studio editor** at `/studio/catalog/collections/[collectionId]`: the confirmation in its own
band, exhibition fields, the curator, `RelatedContentPicker` (built to be reused by Phases 17 and
18) and "Create exhibition page", which inserts the ten template bands empty and in order.

### Phase 16: what is NOT built, and why

- **No published collection, and no exhibition page.** Both are owner acts. The phase says so and
  the database enforces it.
- **No `rich-text` renderer**, so the template inserts ten bands rather than eleven. Building one
  needs a sanitiser, an element allow-list, an embedded-media decision and a real editor — none of
  which is this phase's subject. A14.
- **No `opengraph-image.tsx`.** The metadata path already serves `og:image` from the editor's chosen
  asset through the `og` preset, and file-based metadata would silently override it. A14.
- **No drag-and-drop reordering.** Move up / Move down is the keyboard-operable half that has to
  exist anyway; a pointer affordance can be layered on later without touching the write path.
- **No relationship engine.** Phase 23 owns scoring and suggestion; every edge here is hand-made.

### Phase 16: verification, as actually run

**Tests.** 1275 unit and RLS tests pass, none skipped, including `tests/unit/rls/phase16.test.ts`
(both publish gates, the concept authority and its stamping, the merchandiser refusal, Shape C
invisibility, the filtered DELETE, and that RLS hides a draft piece through the curation join) and
`tests/unit/exhibition-template.test.ts` (only BUILT blocks, FEAT §8 order, element 9's deliberate
absence, and that the template writes no copy).

**Gates.** `npm run check` passes: typecheck, eslint (0 errors), prettier, media id collisions, the
no-regeneration assertion, the transition-SQL check, the section-copy check, the client boundary
(123 modules reachable from 50 client components), the island budget (still five, with MediaVideo
on demand) and the WhatsApp check. `db:check-schema` reports 25 tables; `db:check-data-layer` finds
no `.from(`/`.rpc(` outside the repositories.

**The seed, against the database.** Ten rows, all DRAFT / DRAFT_COLLECTION_CONCEPT; zero with any
of `statement`, `statement_long`, `subtitle`, `page_id`, `hero_media_id` or `signature_media_id`
set; zero published; zero pages of kind COLLECTION. A second run reports 304 unchanged, 0 inserted.

**Two gates were proved non-vacuous rather than assumed.** The studio-nav gate was shown to name
`/studio/catalog/collections/[collectionId]` when its `requirePermission` is removed; the
`entity_relations` anonymity and filtered-DELETE assertions were rewritten against a COMMITTED
fixture edge after the first draft passed against an empty table — `asSession` rolls back, so a row
inserted in a previous block does not exist for the next.

**The e2e suite cannot run in this sandbox, and the spec now says so rather than failing.** The
network policy denies the Supabase host, so `/`, `/about`, `/collection` and every other route
answer 500. The first run of the new spec reported `expected 404, received 500` and pointed at
collections; it now checks a baseline route first and skips with the real reason, never in CI. The
three Phase 15 specs are in the same position and have never executed here either.

### Phase 16: the D9 ten, recorded

1. **Scope implemented** — migrations, gates, triggers, schemas, repositories, two blocks, the
   route, the template, the Studio editor and the ten concepts. Three spec departures recorded in
   A14 rather than taken silently.
2. **Relevant tests run** — 1275 pass, none skipped; the e2e suite skips for a stated environmental
   reason, not a silent one.
3. **No known scope-breaking error.**
4. **Documentation updated** — DATA_MODEL §12 and the `collections` table, STUDIO_GUIDE §7.3,
   CONTENT_GUIDE §2, CANONICAL-DECISIONS A14.
5. **CHANGELOG updated.**
6. **PROJECT_STATE updated.**
7. **SESSION-STATE updated** — this section.
8. **Remaining issues documented** — hosted migrations outstanding; `verify` red on the account's
   Actions runner; the e2e suite unrunnable here; six secrets still unrotated.
9. **Next phase identified** — Phase 17, Portfolio.
10. **Repository recoverable** — every commit pushed to `claude/rivya-living-art-phases-64hq5i`.

### Superseded — Phase 15's state

**Phase 15 — Product Detail Experience. CODE COMPLETE; THE ROUTE RENDERS FOR NOBODY, WHICH IS THE
FINISHED STATE.** `/product/[slug]` serves published products only and 404s otherwise, and
`products` holds zero rows — so today it serves nothing. That is the intended end of this phase: a
product exists when an owner types one in (SEED §32), and the Studio is the only thing that can.

### Phase 15: what is built

**Migrations `0130`–`0132`, LOCAL AND HOSTED.** `product_specs` with its non-blank checks and
`unique (product_id, label)`; `is_valid_dimensions()` and the `products_dimensions_shape`
constraint; the generated RLS file; and `products.specifications_omitted`. Hosted was verified
against local by fingerprint — columns, constraints, policies, indexes, triggers and the function
definition all match, and the function refuses inches, zero, negatives, string values and arrays
identically on both. The ledger rows carry the runner's own SHA-256, so `db:migrate` will not
re-apply them.

**The public route.** `/product/[slug]` with `generateStaticParams` over published products,
`generateMetadata` with the SEED §41 fallbacks, `Product` JSON-LD whose `offers` key is emitted only
for `FIXED`, and five patterns: `ProductGallery` (RC-238), `ProductSpecifications` (RC-239),
`ProductMaterialStory` (RC-240), `ProductInquiryRail` (RC-241), `RelatedContent` (RC-242). Every
band is absent when it has nothing to show, rather than empty.

**The Studio.** Four tabs under `/studio/catalog/products/[productId]` — Media, Materials,
Specifications, Related — each a route rather than a pane. The eleventh readiness item,
Specifications, is required and satisfiable either by a spec row or by the recorded decision that a
piece publishes none.

**Hosted content.** The 16 Phase 15 `UI_LABEL` rows — the seven dimension labels, the gallery's
four strings, the two material-band strings, the two related headings and the specification heading
— were replayed to hosted and fingerprint-matched against local (`caa84a6a…`, 16 rows, both sides).
This mattered more than it looks: `ProductSpecifications` DROPS a dimension the CMS cannot name
rather than showing `length_mm` to a visitor, so without these rows the deployed specification block
would have rendered every measurement as nothing at all.

**Tests.** 1245 unit and RLS tests pass with none skipped, including `spec-rendering` (twelve cases,
all about absence) and `tests/unit/rls/phase15.test.ts` (the `0130` guards, the dimensions
constraint, and the RLS asymmetry the Studio's writes are shaped around). The three e2e specs
execute and skip: this sandbox cannot reach the Supabase host, so there is no published product to
find. They are written to be run where there is.

### Superseded — Phase 14's state

**Phase 14 — Product Catalog. CODE COMPLETE; THE CATALOGUE IS EMPTY, WHICH IS THE FINISHED STATE.**
`/collection` and all seven `/collection/[category]` pages are browsable, server-rendered from the
URL, filterable and pageable with JavaScript disabled — and every one of them renders SEED §27's
"this collection is being prepared", because `products` holds zero rows and no seed will ever add
one. The Studio catalogue editor is the only way that changes.

Phases 12 and 13 merged as PR #16; Phase 11 as PR #15.

### Phase 14: what is built

**Migrations `0120`–`0122`, LOCAL ONLY.** `FIXED` on `price_state`, the `availability_state` and
`edition_state` enums, six columns on `products`, the two listing indexes dropped and recreated in
their full form (`0008` created them short with an instruction to do exactly this), the replaced
price-coherence constraint, the edition-size constraint, and `reject_concept_product_media`. Hosted
is still at `0080` — applying these is owner-side, like every migration since `0050`.

**`lib/catalog/`** — `query.ts` (the whole listing parsed out of the URL, with a canonical builder
that omits what it dropped), `price.ts` (the only place a price becomes words), `validation.ts`
(FEAT §21 and §22 as pure functions, shared by the form and the action), `labels.ts`, `rail.ts`,
`listing.tsx`. Two repositories: `catalog-listing.ts` for the public read, `catalog-admin.ts` for
the Studio write.

**Four patterns, all server components, zero client JavaScript** — RC-217 `ProductCard`, RC-223
`FilterRail` (planned as `FilterBar` (public)), RC-234 `Pagination`, RC-237 `SortSelect`.

**The Studio catalogue editor.** `/studio/catalog/{products,categories,collections,materials}`, with
the ten-item FEAT §22 checklist computed from the saved row, publication refused with the unmet items
named, and a "Not ready" column on the list running the same computation per row.

**`content/seed/catalog-ui.ts`** — 22 rows for the listing's own controls, because a
server-rendered filter rail needs words for its groups and D2 leaves no room for typing them
into JSX.

### Phase 14: what is NOT built, and why

- **A link on a product card.** `/product/[slug]` is Phase 15. An anchor now would put a 404 behind
  every card in the grid, which is the dead door `resolveInternalTarget` exists to refuse.
- **The gallery editor with media roles**, the relationship editor, the customization form builder
  and bulk import — Phases 15, 23, 19 and 24. Each has a stub route with a real permission check.
- **The Specifications readiness item.** Eleven items were planned; ten shipped. `product_specs` is
  Phase 15's table, and an item that always reads "Missing" because the table it counts does not
  exist would train an owner to ignore the checklist.
- **The mobile filter drawer** RC-223 planned. A drawer opened by a button is a Client Component,
  and the phase requires the rail to filter with JavaScript disabled. A `<details>` disclosure would
  satisfy both and is the obvious Phase 41 revision.
- **The authenticated Studio e2e half.** `test.fixme`, as in Phases 04 and 05 and for the same
  reason: no reachable auth server, so no real session. The layers beneath it are proved where they
  can be — the write policies against a real PostgreSQL, the readiness gate as pure functions.
- **Visual baselines**, for the fifth phase running. Still no media.

### Phase 14: verification, as actually run

| Step | Result |
|---|---|
| 1 · `db:reset` + `db:migrate` + `db:types` | ✓ 31 migrations apply to an empty database; the types diff is the six columns and two enums and nothing else |
| 2 · quote-only product carrying a price | ✓ refused by `products_price_state_coherent`, including a zero |
| 3 · concept asset on a `product_media` row | ✓ refused by the trigger, naming the asset, on INSERT and on UPDATE |
| 4 · `collection-empty.spec.ts` against the empty catalogue | ✓ all seven category pages 200, own heading, SEED §27, **zero** `[data-product-card]` |
| 5 · three products with the four price states | ✓ each label from `COMMERCE_LABEL`; the `REQUEST_QUOTE` card contains not one digit; the limited edition states its size |
| 6 · filters, sort and page 2 with JavaScript disabled | ✓ all three; `?sort=price` and `?page=0` dropped from the canonical URL |
| 7 · `rel="next"` on page 1, `rel="prev"` on page 2, canonical per page | ✓ — and `?page=99` answers 404 rather than the 500 PostgREST's PGRST103 would otherwise cause |
| 8 · publication refused with a named unmet item | ✓ as pure functions in `catalog-studio.spec.ts`; the browser half is `test.fixme` |
| 9 · `select count(*) from products` | ✓ 0, after the fixture was removed |
| 10 · axe on `/collection/furniture` | ✓ zero critical or serious violations; no horizontal overflow |

**1000 unit assertions** (86 files), including 17 database guards in `tests/unit/rls/phase14.test.ts`.
`npm run check` clean; a production build compiles every new route.

### Phase 14: the D9 ten, recorded

| # | Point | Evidence |
|---|---|---|
| 1 | Scope implemented | `/collection`, `/collection/[category]`, four patterns, the four Studio catalogue surfaces, migrations `0120`–`0122`, the seed addition. Out of scope by the phase's own list and left alone: any seeded product, `/collections/[slug]`, bulk import, the relationship editor, the customization builder, search, and every cart affordance |
| 2 | Relevant tests run | 1152 unit assertions across 90 files (17 of them database guards), `collection.spec.ts` + `collection-empty.spec.ts` + `catalog-studio.spec.ts` at 1440, the full non-snapshot e2e suite at 1440 (98 passed), the design-system snapshots at 1440 |
| 3 | No known scope-breaking error | None. The known GAPS are listed above under *what is NOT built* and are all phase boundaries or the auth-server limitation Phases 04 and 05 already carry |
| 4 | Documentation updated | `DATA_MODEL.md` (the constraint as strengthened, the index replacement), `BUSINESS_RULES.md` (BR-C5), `STUDIO_GUIDE.md` (§7.1.1), `CONTENT_GUIDE.md` (§8.5), `COMPONENT_REGISTRY.md` (four rows to BUILT, three planned behaviours corrected), `CANONICAL-DECISIONS.md` (A13), `INITIAL_CONTENT_INVENTORY.md` regenerated |
| 5 | `CHANGELOG.md` | Phase 14 entry added |
| 6 | `PROJECT_STATE.md` | Phase-status row, the hosted-migration gap, and the "what does not exist" section |
| 7 | `docs/SESSION-STATE.md` | This block |
| 8 | Remaining issues documented | Hosted is at `0080` and needs `0120`–`0122`; the Higgsfield migration is still unrun; the six exposed secrets are still unrotated; GitHub Actions still provisions no runner |
| 9 | Next phase identified | Phase 15 — Product Detail Experience, under *Next Exact Action* |
| 10 | Repository recoverable | `npm run db:reset` replays all 31 migrations onto an empty database; `npm run db:types` produces no diff after it; `git status` is clean and the generated inventory is committed |

**The RLS fixture had to change.** `loadFixture` attached two `is_concept = true` assets to
`product_media`, which `reject_concept_product_media` now refuses — so the whole RLS suite failed to
load. Both are non-concept now, and a third asset carries the flag, attached to nothing, for the test
that proves the refusal. Note also that `tests/unit/rls/phase08.test.ts` DELETES every row from
`pages` and `page_sections`: after running the RLS suite locally, re-run `npm run seed:content` before
looking at the site.

---

**Phase 13 — Large Format Experience. CODE COMPLETE; NOT MEASURED.** `/large-format` renders, and
the phase's real contribution is smaller and wider than the page: a link is now rendered only when
its destination is live.

### Phase 13: what is built

**Three renderers** — `category-intro`, `category-list`, `customization-note` — so twenty of the
twenty-eight blocks have one and `/large-format` needs no further block.

**`lib/site/resolve-target.ts`.** An editor's `href` is a database value: `typedRoutes` cannot see
it, and a page whose sections are all DRAFT answers 404 while looking exactly like a real path.
`getSiteChrome` now carries `livePaths` — pages with at least one section the anonymous client can
see — and `SectionActions` and `CategoryListSection` both drop a link whose destination is not in
it, rendering the content without the anchor rather than hiding the content. Proved in both
directions: with `/custom-commissions` unpublished the page has no anchors in its body at all, and
publishing one section on it brings both CTAs back.

**Entry-level marks on three of the six groupings**, where the seed flagged the whole list before.

**A text-only card as a designed layout**, because one grouping has no photograph in the library —
recorded as DQ-14 in `HIGGSFIELD_ASSET_STATUS.md`, not filled from a neighbouring family.

### Phase 13: what is NOT built, and why

- **`components/patterns/WideHero.tsx`**, which the phase document lists. It would be a second
  implementation of what `HeroSection` and `ResponsiveMedia` already do: 21:9 desktop, 9:16 mobile,
  two assets rather than a CSS crop, motion behind `HeroMotion`'s five gates. `/large-format`'s hero
  uses the same `hero` block as every other page and needs nothing new. A wrapper would be a second
  place for the art-direction rules to drift.
- **The visual baselines**, for the fourth phase running: no media, so a snapshot records a page of
  fallback wells.
- **Any media binding.** The 18-asset `large-format` bucket is named in the phase document and
  cannot be bound until the Higgsfield migration runs.

### Phase 13: verification, as actually run

| Step | Result |
|---|---|
| 1 · publish `/large-format` | ✓ 4 of 5 sections; the customization statement refused by the verification constraint |
| 2 · entry-level query | ✓ exactly three withheld keys — conference, seating, architectural — and exactly the other three render |
| 3 · anchors inside `<main>` | ✓ none at all, because `/custom-commissions` has nothing published; publishing one section on it brought both CTAs back, then it was returned to DRAFT |
| 4 · `large-format.spec.ts` at 1440 and 390 | ✓ 12 assertions including the no-dead-anchor scan and zero serious axe violations |
| 5 · `resolve-target.test.ts` | ✓ 9 cases: live, not-live, empty, `#`, trailing slash, query, fragment, external, protocol-relative, `/search` |
| 6 · full unit suite | ✓ 942 tests |

**The local cluster had to be restarted mid-phase** — the container had lost it. It lives at
`/var/lib/postgresql/rivya/data` and its config says port 5432, so it must be started with an
explicit override: `pg_ctl -D /var/lib/postgresql/rivya/data -o '-p 5433'`. Starting the packaged
cluster instead takes 5432 and blocks it.

---

**Phase 12 — About + Process. CODE COMPLETE; NOT MEASURED.** `/about` and `/process` render from
the CMS, and both are built to read as complete while the claims inside them wait for the owner.
What is not done is the same pair Phase 11 left: the visual baselines and the Lighthouse numbers,
both waiting on media that does not exist yet.

Phase 11 merged as PR #15; Phase 10 as PR #14.

### Phase 12: what is built

**`scale-statement`** — seventeen of the twenty-eight blocks now have renderers, and `/about` needs
no further block. It is the site's one editorial 21:9 crop, with a separate 4:5 mobile asset rather
than a CSS crop of the wide one.

**The `/process` chapter layout.** A chapter is ONE section carrying ONE stage, which is what lets
the owner verify one stage without verifying the rest. Its number is its position among the
chapters that rendered — `SectionList` counts per block type and passes an `ordinal`, because a
renderer is a pure function of its own props and cannot see the page. Seeded as "01 — BRIEF", three
verified chapters would have read 01, 04, 06; they now read 01, 02, 03, and the bands alternate on
the same index.

**`ChapterMedia` (RC-216)** — one clip plays at a time across the page, gated by
`IntersectionObserver` on top of the five gates `HeroMotion` applies. Loaded through `next/dynamic`,
because `ProcessStepsSection` is imported by every page with a process band.

**A Studio verification banner** on every flagged section, quoting the section's own claim and, where
the specification has wording, its wording: SEED §16's "Avoid specific production claims until
verified" is seeded verbatim against step 04. The other six notes are this project's and are
labelled as such in each row's `description`.

### Phase 12: what is NOT built, and why

- **Visual baselines** (`about.visual.spec.ts`, `process.visual.spec.ts`). Same reason as Phase 11:
  `media_assets` is empty, so every image is the SEED §47 fallback well and a baseline would record
  a composition that is not the composition.
- **Any media binding**, so no chapter has a clip and `ChapterMedia` mounts nothing today. The
  Phase 12 media table names every family; binding is an edit to `content/seed/media-bindings.ts`
  once the Higgsfield migration has run.
- **The `/custom-commissions` destination** of About's closing CTA. Phase 19 builds that page; the
  route exists and answers 404 by design, which the About spec asserts as an acceptable outcome
  rather than treating as a broken link.

### Phase 12: verification, as actually run

| Step | Result |
|---|---|
| 1 · `npm run check` | ✓ 28 gates |
| 2 · publish `/about` and `/process` | ✓ 9 sections refused by the verification constraint — About's scale and bespoke, and all seven chapters. `/about` renders 3 of 5, `/process` its hero |
| 3 · verify three chapters out of order (authored positions 3, 6, 8) | ✓ they render 01, 02, 03 with one inverted band, then were returned to the launch state |
| 4 · `about.spec.ts` + `process.spec.ts` at 1440 and 390 | ✓ 22 assertions: seeded order, one `h1`, flagged sections absent, no forbidden copy, zero serious axe violations |
| 5 · `process-numbering.test.tsx` at 1, 3, 5 and 7 chapters | ✓ contiguous numbering and correct alternation, through the real `SectionList` |
| 6 · island budget after adding `ChapterMedia` | ✗ **failed** — the homepage would have shipped it. Fixed with `next/dynamic`; the gate now separates initial-bundle islands from lazy ones and was re-proved to fail on a sixth static island |
| 7 · re-seed and confirm | ✓ 7 records updated, 9 verification notes written, chapters reshaped to `chapter` with label-only eyebrows |

**933 unit tests**, 81 files.

---

**Phase 11 — Homepage + Material Experience. CODE COMPLETE; NOT MEASURED.** All thirteen SEED §10
sections render from the CMS in seeded order, the two motion islands are built, and the homepage's
client budget is measured and enforced. What is not done is the performance MEASUREMENT and the
visual baseline, and both wait on the same thing: `media_assets` is empty, so every image on the
page is the SEED §47 fallback well. A Lighthouse run against that would report an LCP for a page
with no images, and a snapshot would record a composition that is not the composition.

Phase 10 merged as PR #14; Phase 09 as PR #13; Phase 08 as PR #12. Phase 07 remains CODE COMPLETE
with its Higgsfield migration unrun.

### Phase 11: what is built

**Ten renderers, so sixteen of the twenty-eight blocks are built.** `manifesto`, `selected-works`,
`material-story`, `material-palette`, `commission-cta`, `three-d-resin`, `portfolio-strip`,
`secondary-objects`, `journal-strip`, `final-cta`. `components/sections/registry.ts` maps none of
them to `null` any more, and `tests/unit/cms-sections.test.tsx` asserts the two registries agree in
both directions.

**Entry-level owner verification** (`lib/cms/entry-visibility.ts`). The section-level column is the
right mechanism when the claim IS the section and the wrong one when a published band holds one
unverified item among five. Fifteen entries across five sections now carry the flag themselves;
each renders as nothing and is addressable in a test by `data-entry-key`. `BlockModule.entryArrays`
declares which payload arrays are editorial, because inference got it wrong in both directions —
"any object array" swept in `/contact`'s form fields, "has a `title`" missed the commission band's
six `label`-carrying capabilities.

**Three reference blocks with an honest empty state.** `lib/cms/selectors/` answers `OK`, `EMPTY`
or `NOT_YET_BUILT`; `components/patterns/EditorialFallback` renders a seeded `EMPTY_STATE.*`
sentence inside `data-empty-reason`. Never a skeleton, which says "loading" when nothing is
loading, and never a placeholder card, which is a product that does not exist.

**`HeroMotion` (RC-214) and `MaterialSequence` (RC-215).** The hero's still is now always the LCP
element and the clip is a layer over it that mounts after paint behind five gates, or does not
mount at all. The sequence observes scroll and never captures it; its stages are server-rendered
and passed in as children, and the dimming is `data-[active=false]`, which matches nothing until
the island runs.

**An island budget that counts modules, not chunks** (`scripts/site/check-island-budget.mjs`,
wired into `npm run check`). Five islands on `/`, named, with the fifth recorded as amendment A11.
It immediately found a real cost: `MediaSlot` — a Server Component nearly every renderer imports —
was importing `MediaVideo`, so every route with any section carried the video island. `BlockVideo`
moved into its own module (RC-235).

**Homepage JSON-LD.** One `application/ld+json` block, `WebSite` + `Organization`, a name and a URL
and nothing else. It renders nothing at all when either is missing.

### Phase 11: what is NOT built, and why

- **`tests/e2e/homepage.visual.spec.ts`.** Deferred, not forgotten. A baseline taken now records a
  page whose every image is a fallback well; it would be thrown away the day
  `npm run media:migrate:higgsfield` runs. What a snapshot would actually catch at eight widths —
  a band that overflows its viewport — is asserted directly in `tests/e2e/homepage.spec.ts`, and
  that assertion found amendment A12 on its first run.
- **The Lighthouse numbers.** `lighthouserc.json` and `.github/workflows/lighthouse.yml` exist; the
  workflow is **manual dispatch only** because of the owner's standing instruction about Actions
  minutes, and because a run against a media-less page would measure the wrong thing.
- **Any media binding.** `MEDIA_BINDINGS` is still empty and the hero's `motion-desktop` slot is
  unbound. An entry naming an asset that does not exist is a hard seed failure, so binding waits on
  the Higgsfield migration. The four `material-story` stages are seeded with `media_index: null`
  for the same reason.
- **The 21:9 hero motion gap.** The manifest holds no 21:9 video at all; the desktop clip is 16:9
  and plays inside the 21:9 still with `object-fit: cover`. Recorded in `content/media-slots.ts`
  (`home.hero.video`, resolution `GENERATE`) rather than filled by a new generation.

### Phase 11: verification, as actually run

Against a local PostgREST over the seeded local cluster, with the homepage's sections walked
DRAFT → REVIEW → APPROVED → PUBLISHED to reach the launch-day state.

| Step | Result |
|---|---|
| 1 · `npm run check`, including the new island gate | ✓ 28 gates |
| 2 · publish all thirteen homepage sections | ✓ 11 published, 2 refused by `page_sections_verified_before_publish` — positions 2 and 8, the two whose claim IS the section |
| 3 · `homepage.spec.ts` at all eight widths | ✓ 48 assertions: seeded order, one `h1`, no skipped level, zero fabricated cards, one JSON-LD block |
| 4 · the 15 withheld entry keys, scoped by block type | ✓ zero elements each, and all five parent sections still render |
| 5 · `homepage-motion.spec.ts`, both branches | ✓ four static stages and no `data-active` under reduced motion; a stage marked active with motion allowed; no `<video>` at any width, no clip being bound |
| 6 · horizontal overflow at eight widths | ✗ **failed at every width**, and that is amendment A12 — `w-full` meant 1920px product-wide. Fixed, re-run green |
| 7 · homepage client JS, gzipped, from a production `next start` | ✓ 171.7 kB against a 180 kB budget |
| 8 · island count | ✓ 5, named, gate proved to fail on a sixth |
| 9 · `curl /` piped to `grep -c ld+json` | ✓ 1, with no `offers`, `aggregateRating` or `award` |
| 10 · no-JavaScript HTML | ✓ 11 sections, 4 stages, 1 `h1`, 0 `<video>`, 0 `data-active` |

**924 unit tests**, 80 files, plus 96 e2e assertions on the two new specs across the eight QA
widths, and zero critical/serious axe violations on `/` at 390px and 1440px.

The whole e2e suite was run twice at 1440px and 390px after the A12 fix — 147 passed, 55 skipped
(the skips are the fixtures that need a reachable Supabase project). One run had a single failure,
`DropdownMenu opens on ArrowDown`, which passed alone, passed with its own spec at both widths, and
passed in the second full run: a flake under parallel load against `next dev`, recorded rather than
re-run until quiet. It is not related to A12 — that change moved widths, not focus.

The eight design-system visual baselines were regenerated. **The old ones recorded the bug**: at a
1440px viewport the gallery's baseline was 2264px wide.

### Phase 11 against D9's ten points

Eight hold outright: tests run, no known scope-breaking error, documentation updated
(`COMPONENT_REGISTRY.md`, `PERFORMANCE.md`, `TESTING.md`, `CONTENT_GUIDE.md`, `DESIGN_SYSTEM.md`,
`HIGGSFIELD_ASSET_STATUS.md` and two amendments), CHANGELOG updated, PROJECT_STATE updated,
SESSION-STATE updated, remaining issues documented, next phase identified, repository recoverable
(three commits, pushed, PR #15 open).

**Point 1 — scope implemented — is the one that does not, and it is media rather than code.** The
phase's media table binds each section to a Higgsfield family; `media_assets` is empty on both
databases because `npm run media:migrate:higgsfield` has never run, and a seeded entry naming an
asset that does not exist is a hard seed failure. So no binding was written, the four material
stages carry `media_index: null`, the hero's motion slots are declared and unbound, and two exit
criteria — the Lighthouse numbers and the eight-width visual baseline — wait on the same thing.
Everything that does not depend on an asset is done and verified. That is why the phase reads CODE
COMPLETE rather than COMPLETE.

---

**Phase 10 — Public Website Foundation. COMPLETE.** Rivya is a website a stranger can load: one
Server-Component shell, thirteen static routes, the metadata, sitemap and revalidation plumbing, and
the WhatsApp module. Every visitor-visible string in the chrome is a database row.

Phase 09 merged as PR #13; Phase 08 as PR #12. Phase 07 remains CODE COMPLETE with its Higgsfield
migration unrun.

### Phase 10: what is built

**The shell.** `app/(site)/layout.tsx` — skip link → announcement → header → `<main id="main">` →
footer. `lib/site/chrome.ts` fetches everything it needs once per request behind `React.cache`
(four parallel queries: `global_content`, `navigation_items`, `categories`, and the one
`contact-details` section), and the layout is its only caller.

**Three client islands, and no more.** `MegaMenu` and `MobileNav` hold open/closed state;
`SiteErrorCopy` is a context provider that renders `children` unchanged and exists only because
Next requires `error.tsx` to be a Client Component and a Client Component cannot query. The
announcement bar's dismissal is a `<form>` posting to a Server Action — no JavaScript, no island.

**A cookieless public read client.** `lib/supabase/public.ts`. The cookie-bound client would make
every route dynamic and would silently hold an expired token outside the `/studio` matcher that
`proxy.ts` refreshes. All twelve CMS routes build static as a result; `renderCmsPage` switches
clients only in draft mode.

**Thirteen routes**, one per D3 static path, twelve delegating to `renderCmsPage(path)`.
`tests/unit/site-routes.test.ts` asserts the file system and `lib/site/routes.ts` agree exactly —
proved by deleting `terms/page.tsx` and watching it fail.

**Metadata, robots and sitemap.** `lib/seo/metadata.ts` walks the SEED §41 chain — the path's entry,
the GLOBAL entry, then the `SEO_DEFAULT` strings — and emits `noindex` for a page with no live
sections whatever its row says. `sitemap.xml` inner-joins the sections so it lists only URLs that
actually load.

**`app/api/revalidate`**, POST only, `REVALIDATE_SECRET`-guarded with a constant-time compare, 503
when unconfigured.

**`lib/whatsapp/`** with two builders. `buildHandoffUrl` requires a non-optional `inquiryId` and now
also refuses a blank one at runtime; `buildDirectContactUrl` takes a closed union of three chrome
surfaces. Token allowlists in both directions, graceful shortening that never touches the inquiry
id, and a 1800-character cap.

**Two Studio additions.** An "On site" column on `/studio/content/pages` — a direct link when the
page is published, the draft-mode preview route when it is not — and `/studio/content/navigation`,
previously a stub, now listing every menu item with whether its `href` resolves. That second one is
the compensating control for `NavLink`'s `as Route` cast: a database href cannot be checked at build
time, so it is checked where it is typed.

**Migration `0080`** — a `UI_LABEL` group for `global_content`. Applied to hosted, which is current
at 28 migrations.

**Seed module `site-chrome.ts`**, 16 rows: the skip link, the menu controls, the dismiss button, the
search control, the landmark names, the two §45/§46 error CTAs, and the greeting a chat opens with
when there is no enquiry to reference.

### Phase 10: what is NOT built, and why

- **A page a visitor can read.** Every route renders and every one answers 404: Phase 09 seeds all
  53 sections `DRAFT`, and `renderCmsPage` refuses a published route with nothing on it (SEED §55).
  This is the designed outcome, not a gap. Publishing is an editorial act in Studio, and 25 of those
  sections cannot be published at all until the owner verifies what they claim.
- **`aria-current="page"`.** It needs the request pathname, which a Server Component cannot read
  without `headers()` — that would make every public route dynamic to mark one link. Deferred to
  Phase 41 with the trade recorded in `ACCESSIBILITY.md` §2.3a. It is a 2.4.8 AAA concern, not an AA
  failure.
- **A "skip to navigation" link.** Deliberately not built: the header is the first thing in the DOM,
  so a link at the top that jumps two elements forward adds a control to the tab order for nobody.
- **`MegaMenuPanel.tsx`.** The panel's contents are server-rendered by `SiteHeader` and passed as
  `children`, which is what lets the category cards use `MediaImage`. A second client file would
  have passed that markup straight through.
- **Category thumbnails.** `MEDIA_BINDINGS` is still empty and no category has a `hero_media_id`,
  so every mega-menu card renders text-only. That is Phase 09's recorded gap plus the unrun
  Higgsfield migration, not a Phase 10 omission.

### The defects the verification steps found

1. **`revalidatePath` was invalidating nothing, and returning 200.** Two independent causes, both
   invisible: without `export const revalidate` on the site layout every route builds as a pure
   static file with no cache entry behind it; and `revalidatePath` must be called with **no** `type`
   for a literal path — passing `'page'` alongside `/about` fails to match. Found by publishing a
   section and watching the page keep 404ing. `x-nextjs-cache` flipping `HIT` → `MISS` is what
   proved the fix.
2. **`stripCommentsAndStrings(source, { strings: false })` did not scan strings**, so the `//` in
   every URL started a "line comment" and blanked the rest of the line. The new WhatsApp gate was
   written against that view and passed a planted `https://wa.me/…` while reporting success. Phase
   06's `check-video-props.mjs` reads the same view and had the same hole. Two regression tests.
3. **`buildHandoffUrl` did not refuse a missing inquiry id at runtime.** The type stops a
   TypeScript caller; anything else got a message with an empty Inquiry ID, looking entirely normal
   and traceable to nothing. Found by writing the test for the type-level guarantee.

### Phase 10: verification, as actually run

Against a local PostgREST (`npm run site:rest`) over the seeded local cluster, because `supabase-js`
speaks HTTP and a bare Postgres verifies nothing about a page.

| Step | Result |
|---|---|
| 1 · `npm run check` incl. both new gates | ✓ 27 gates |
| 2 · `next build && next start`, `/about` DRAFT → 404, published → 200 | ✓ and the same for `/process` via the endpoint |
| 3 · `site-shell.spec.ts` at eight widths | ✓ skip link first, one `<h1>`, one `<main>`, distinct landmark names |
| 4 · `navigation-a11y.spec.ts` keyboard model + axe | ✓ 98 assertions, zero critical/serious |
| 5 · `grep -rn "wa.me" app components` | ✓ none, and the gate proves it by planting one |
| 6 · `buildHandoffUrl` without `inquiryId` | ✓ `@ts-expect-error` in the test holds the type; a blank id throws |
| 7 · `POST /api/revalidate` without / with the secret | ✓ 401 / 200, and the named path refetches |
| 8 · media failure keeps the ratio box | ✓ `MediaFrame`'s existing behaviour, unchanged by the move |
| 9 · `curl /sitemap.xml` | ✓ exactly the two paths with published sections |
| 10 · delete a route file, run the parity test | ✓ fails, naming the missing path |

**1020 unit tests**, 78 files, none skipped, with `RLS_TESTS_REQUIRED=1`.

---

**Phase 09 — Initial Website Content Seed. COMPLETE.** The empty CMS is now a coherent draft
website: every page, section, navigation item, label, empty state, FAQ, SEO default, WhatsApp
template and Studio helper string from the specification is in the database as
`content_seed_version = 'rivya-v1'`, and re-running the seed is safe forever after.

Phase 08 (Content Management Engine) is complete and open as PR #12. Phase 07 remains CODE
COMPLETE with its Higgsfield migration unrun. Phase 06 merged as PR #8; Phase 04 closed out in
PR #5 and #7; Phase 03 merged as PR #4.

### Phase 09: what is built

**Two migrations, `0070` and `0071`.** Most of what the phase document assigned to `0070` was
already done by earlier phases, and the file says so: `content_seed_version` has been the column
name since Phase 03, so there was no rename. What was missing — and is now there —
`content_seed_runs.deferred_count`, the seed lookup indexes (seven of ten tables had no `seed_key`
index and none had a version index), and `set_owner_edited` hardened to SECURITY DEFINER. `0071`
adds a `BRAND` group, because SEED §6 names it as a Studio location.

**Eighteen seed modules, 231 records applied and 22 deferred.** Every string is the
specification's, verbatim. The homepage's 13 sections, about, large-format with its six category
entries, the /collection landing and seven category pages (created by that module, taking `pages`
to 20), commissions, seven process steps, portfolio, journal, contact, ten FAQs, SEO, the label
library and Studio help.

**Five verdicts, three guards.** `inserted`, `updated`, `unchanged`, `skipped (owner edit)`,
`deferred`. `unchanged` exists because a no-op re-run was rewriting all 231 rows and
`write_revision` fires on any update — 231 revisions per re-seed saying nothing changed. `deferred`
is per-RECORD, not per-module, because the two deferring modules are mixed.

**The §54 inventory**, generated from the database rather than the modules: 316 rows, 80 awaiting
owner verification, 22 deferred. `content:check-inventory` regenerates and diffs, wired into CI.

### Phase 09: what is NOT built

- **Any public route.** Nothing under `app/(site)/` consumes `resolvePage`. The copy, the
  windowing, the media resolution and the renderers all exist; no route calls them. Phase 10.
- **Ten of the homepage's thirteen renderers.** Amendment A8's split: the copy is seeded against
  block types that have no renderer, so the page would show three sections today.
- **The `t()` swap.** `studio-help.ts` seeds the Studio strings into `global_content` under the
  keys `components/studio/strings.ts` already declares; making `t()` read them with the constant as
  its fallback is the remaining half, deliberately not done in the same commit that first wrote the
  rows.
- **Any media binding.** `content/seed/media-bindings.ts` is empty and says why: the Higgsfield
  migration has never run, so `media_assets` holds no Higgsfield rows and every binding would fail
  the run rather than bind. The bindings the phase plans are listed in that file.

### The three defects the verification steps found

Each was invisible without running the step that caught it.

1. A dry run on an empty database reported **91 failures**, one per reference — it writes no pages,
   so every section's `page_id` resolved to nothing. Phantom failures on a run whose whole job is
   to report what *would* happen.
2. Then **31 rows** reported themselves owner-edited on a clean re-run. PostgreSQL stores jsonb
   keys by length then bytewise, not insertion order, so a payload written as
   `{is_video, autoplay, scrim}` reads back reordered: identical data, different hash.
3. The generated inventory embedded **page UUIDs**, which change on every `db:reset` — a committed,
   diff-checked file cannot contain per-database values.

### Phase 08: what is built

**The database.** Six migrations, `0050`–`0055`. Seven tables (`pages`, `page_sections`,
`content_revisions`, `navigation_items`, `global_content`, `seo_entries`, `faqs`), five triggers,
five `cms_*` SECURITY DEFINER functions, and the generated policy and transition files. All applied
locally AND to `ccvarsmzickdkryoakdg`, and verified there afterwards rather than assumed: 7 CMS
tables, all with RLS on, 90 policies matching local exactly, 6 `cms_*` functions, 8 triggers on
`page_sections`, and `page_sections_media_needs_slot_key` present.

**The blocks.** All 28 catalogue types declared; six built, chosen to exercise every payload family
(amendment A8). Both registries are `satisfies Record<BlockType, …>`, so an omission is a build
error — verified by removing one and reading the failure.

**The renderers.** `components/sections/`, synchronous and pure: `lib/cms/resolve.ts` decided what
is live, `lib/cms/media.ts` resolved every asset for the page in one query, `siteStrings` supplied
the chrome copy. `npm run cms:check-copy` parses each file with the TypeScript compiler and fails
on any literal a visitor would read.

**Studio.** `/studio/content/pages` and `/studio/content/pages/[pageId]` — add, edit, reorder,
remove, and only the status transitions the caller's role can actually take. A `MediaPicker` that
says at the moment of choosing whether an asset would block a publish.

**Scheduling and preview.** `cms_run_content_schedule` under `for update skip locked`, BLOCKING a
section after three refusals rather than retrying forever; `/api/preview` using the staff session
as its credential, with `draftMode()` correctly awaited.

**The seed.** Two modules — 12 route shells and 5 global strings, the latter carrying SEED §27–§29
verbatim. Applied locally; **not yet applied to hosted** (see *Remaining Work*).

### Phase 08: what is NOT built

- **22 of the 28 blocks.** Declared `PLANNED`, unaddable in Studio, rendering nothing publicly.
- **A repeater UI.** A block with repeating items is edited as JSON, validated on save against its
  own schema and refused rather than coerced.
- **Any section copy.** The engine is built and nothing is written into it. That is Phase 09.
- **Any public page route.** `app/(site)/[...]` does not consume `resolvePage` yet.

### The defect Phase 08 found in itself

`sync_media_usages` only writes a `media_usages` row when `media_slot_key` is present, and
`cms_publish_section`'s RV003 and RV006 gates are **both joins through that table**. A section
binding an asset with a null slot key therefore published with no media check at all. Reproduced: a
DRAFT, `OWNER_VERIFICATION_REQUIRED` asset went live and stayed DRAFT, invisible to the gap tracker
too. Migration `0054` closes it; re-verified after.

### Phase 07: what is built, and what is not

**Built and verified**

- **`scripts/media/migrate-higgsfield.ts`** — `--dry-run`, `--family=`, `--limit=`, resumable from
  a committed ledger. The decisions live in `lib/media/migration.ts`, which
  `tests/unit/higgsfield-migration.test.ts` drives with all 250 real manifest rows and a fake
  uploader, no network. The upsert key is `higgsfield_generation_id`, which survives a manifest
  renumbering; a test shifts twelve `process-pour` ids and asserts 250 skips, 0 uploads.
- **`content/media-slots.ts` and `lib/media/gaps.ts`.** 26 declared slots; against the manifest
  with nothing bound the report is 13 coverable, 2 thin, 11 gaps — matching the phase document's
  own gap table, including all seven pages verification step 8 names. `gallery-scene` surfaces as
  the one family no declared surface can use.
- **`/studio/media/higgsfield`** — Inventory (all thirteen FEAT §34 columns, six filters),
  Families, Gaps, with the concept banner on every tab and a read-only drawer with no regenerate
  control. Each tab is its own URL.
- **`scripts/media/assert-no-regeneration.ts`** — four rules, in CI and in `npm run check`.
  Verified to FAIL on a planted brief for `WALL-ART-001`, naming the asset and where it already
  lives, not merely to pass.
- **`scripts/media/build-asset-status.ts`** — regenerates §3 and §4 of
  `HIGGSFIELD_ASSET_STATUS.md` between markers. Manifest-only and deterministic; a second run
  produces no diff, which is what verification step 10 requires.
- **`0040` + `0041`** applied to both databases. The hosted project records 19 migrations with
  `0041_rls_policies_phase07.sql` as the latest, and `higgsfield_migration_runs` exists on both.
- **733 unit tests, 63 files, no skips** with `DATABASE_URL` set. 6 new e2e routing cases pass.

**Not built, and why**

- **The migration has not run.** 0 rows in `higgsfield_migration_runs` on both databases; the
  hosted `media_assets` holds the 3 Phase 06 canaries and nothing else. Proxy-blocked, not a
  defect. Exit criteria 1–5 cannot be ticked until the owner runs it locally.
- **8 of the 14 tracker e2e cases are `test.fixme`** — they need an authenticated session, the
  same wall `studio-access.spec.ts` documents. Their subject matter is not unproven in the
  meantime: the three filter counts and the seven gap pages are asserted against the real manifest
  in the unit suite, and "no regenerate control" is a build gate rather than a browser assertion.
- **No "Coverage" or "Concept Placement" tab.** Both are Phase 43 in `HIGGSFIELD_GUIDE.md` §7.

### Phase 07: the 10 verification steps, as actually run

| # | Step | Result |
|---|---|---|
| 1 | `check-asset-ids.py` | **PASS** — 31 documents against 250 manifest IDs, 0 collisions |
| 2 | `migrate-higgsfield --dry-run` | **NOT RUN** — needs `DATABASE_URL` plus Cloudinary reachability |
| 3 | `migrate-higgsfield` | **NOT RUN** — proxy blocks `api.cloudinary.com` and the CDN origin |
| 4 | Re-run reports 250 skipped | **NOT RUN** — depends on 3. Proved offline instead: the idempotency test drives all 250 through the real planner with a fake uploader |
| 5 | 26 video / 224 image rows | **NOT RUN** — depends on 3. The manifest split is asserted in the unit suite |
| 6 | Three "zero rows" identity queries | **NOT RUN** against imported rows; the manifest itself is proved to have no duplicate in any of the three |
| 7 | Tracker filters: 39 / 79 / 26 | **PASS, at the predicate** — asserted against the real manifest in `tests/unit/media-inventory.test.ts`. The UI wiring is `test.fixme` |
| 8 | Gaps tab shows all seven pages | **PASS, at the engine** — `tests/unit/media-gaps.test.ts`. The UI wiring is `test.fixme` |
| 9 | `media:assert-no-regen`, then plant a `WALL-ART-001` brief | **PASS both ways** — clean run passes; the planted brief exits 1 naming the asset |
| 10 | `media:build-status && git diff --exit-code` | **PASS** — second run produces no diff |

Steps 2–6 are the migration itself and everything downstream of it. They are the owner-side
action, not open questions.

### Phase 06: what is built, and what is not

**Built and verified**

- **The provider seam.** `MediaProvider` in `lib/media/types.ts`; `getMediaProvider()` is the only
  export the rest of the product uses. `lib/media/providers/cloudinary.ts` is `server-only` and is
  the ONLY file importing the SDK — `npm run media:check-provider` enforces both halves and was
  verified to fail on a planted violation, not merely to pass.
- **`lib/media/url.ts` builds delivery URLs with no SDK**, so a Client Component can render media
  without the secret-holding module reaching a browser bundle. Parameters are emitted in a fixed
  order: two spellings of one transformation are two derived assets, two cache entries and two
  bills for one picture.
- **The transform policy matches PHASE-05-09.md §06 and CLOUDINARY.md §5 exactly** — six presets
  (`thumb·card·grid·hero·hero-xl·og`) and the nine-rung srcSet ladder. An earlier draft invented a
  different set and was corrected; see *Known Issues* for why that mattered.
- **`0030` + `0031`**, applied to BOTH databases and proved equal by a 515-object signature hash,
  not by counting. `media_assets` gains 22 columns; `media_usages` is the reverse index.
- **`app/api/media/sign`** — five gates before the signature: session, `media.write`, Zod, the
  folder allowlist, then §7.1's MIME allowlist and byte ceiling.
- **`MediaImage` (RC-232) and `MediaVideo` (RC-233)**, both marked BUILT in the registry. Three
  perf gates guard their contracts, each verified to fail on a planted violation.
- **The Studio Media Manager** — six sections from one `MediaLibrary`, the uploader, and the save
  action. `npm run build` compiles all seven media routes.
- **All three Phase 06 canaries are uploaded** to the live Cloudinary account (cloud `dhaqpl1kz`,
  Free plan at 1.08% of 25 credits).
- **656 unit tests, 60 files, no skips** with `DATABASE_URL` set. 11 e2e cases pass; 7 are
  `test.fixme` pending a reachable auth server.

**Not built, and deliberately so**

- **`/studio/media/higgsfield`** stays a stub. AI Assets is not a `kind` — it is
  `source = 'HIGGSFIELD'` across IMAGE and VIDEO — and Phase 07 owns both the page and the import
  of the remaining 247 assets.
- **The §8 rate limit on the sign endpoint (20/hour per staff `user_id`) is NOT enforced.** It is a
  fixed-window counter over `rate_limit_buckets`, and that table belongs to Phase 41
  (`0390_phase41_security.sql`). Creating it here would take a table out of the phase that owns it.
  The exposure is bounded but real and is recorded in the route: a session holding `media.write`,
  or one that has been stolen, can mint signatures as fast as it can ask.
- **Magic-byte type detection** (`lib/media/validate-upload.ts`) cannot exist at signing time — the
  bytes do not. The route checks the DECLARED type, which is a different control, not a weaker one.
- **A detail drawer per asset.** The table shows alt text inline, which is the cheapest review of
  the field most likely to be wrong; editing it is Phase 08's surface.

### Phase 06: the 8 verification steps, as actually run

| # | Step | Result |
|---|---|---|
| 1 | Presets, srcset, ratio-crop rejection, poster derivation | **PASS** — 37 cases in `media-transform.test.ts`, incl. `UnsupportedRatioError` on a non-D6 ratio and on an inherited `Object` property (`'toString'`, which a naive `in` check would accept) |
| 2 | Sign endpoint: no session → 401; bad folder with a session → 422 | **PASS (401) / CODE CORRECT (422)** — the 401 is asserted in `media-upload.spec.ts`. The route returned 400 for a disallowed folder and now returns the specified 422; the authenticated assertion is `test.fixme` |
| 3 | Upload a JPEG through `/studio/media/images`, assert the row and the folder | **BLOCKED** — needs a browser session, and the sandbox cannot reach `*.supabase.co`. Same blocker as Phase 04 step 6's authenticated half |
| 4 | Import the three canaries and assert their rows | **PASS** — `npm run media:import-canaries`. `LARGEFORMAT-DINING-004` stores `resource_type = 'video'`, `duration_s = 6.041667`, `aspect_ratio = '9:16'`; all three carry `is_ai_generated`, `is_concept` and `source = 'HIGGSFIELD'`. The `so_0` poster derivative exists on Cloudinary. "No candidate above 2560" is asserted for both 4800px and 6336px sources |
| 5 | `rivya_asset_id` still unique after `0030` | **PASS** — on the hosted project: `media_assets_rivya_asset_id_key UNIQUE (rivya_asset_id)` alongside `media_assets_provider_identity UNIQUE (provider, resource_type, public_id)` |
| 6 | `MODEL_3D` without `model_format` → refused | **PASS** — `media_assets_model_format_present` rejects it; the same insert WITH `'GLB'` is accepted, so the check is not vacuous |
| 7 | Delete an asset a `media_usages` row references → refused | **PASS** — `media_usages_media_id_fkey` refuses it; unbinding first then deleting succeeds |
| 8 | Playwright at 390px: chosen candidate ≤ 1024px, `content-type` avif/webp | **BLOCKED** — needs a public page rendering `MediaImage` (none exists until Phase 10) AND network access to `res.cloudinary.com`, which the sandbox proxy denies with a 403 on CONNECT |

**Two steps are blocked by the environment, not by the code, and neither is hidden.** Step 3 and
step 8 are the same two blockers that have run through Phases 04–06: no browser-reachable auth
server, and no egress to the CDN. What step 8 would have proved about URL correctness was instead
proved *better* — by asking Cloudinary's own API to generate every chain this codebase emits, which
is how the `g_auto` defect surfaced.

**The canary rows are on both databases**, identical, and RLS was re-confirmed against the hosted
project with a baseline: 3 rows exist, `anon` sees 0. All three are `DRAFT` and
`OWNER_VERIFICATION_REQUIRED`, so the D10 gate keeps them unpublishable until an owner decides.

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
3. ~~The top bar~~ — **done.** `StudioTopBar` carries the identity, the role badge, a visible ⌘K
   hint and the deployment-environment badge. That last one is absent in production deliberately: a
   badge rendered everywhere becomes furniture, and its absence meaning "this is the real site" only
   works if it is genuinely absent. 9 tests, including that it leaks no deployment configuration.
4. ~~`studio_preferences` reader/writer~~ — **done except one column.** `lib/auth/preferences.ts`
   reads the chrome and writes `sidebar_collapsed` and `pinned_routes`; the top bar collapses the
   navigation, and every page can pin itself. Both are plain `<form>`s posting to Server Actions in
   `app/(studio)/studio/(shell)/actions.ts`, so they work before hydration.
   **`dashboard_card_order` still has no writer** — the column exists and nothing reorders cards.
5. **Verification step 6** (press ⌘K on a Studio page, type `journ`, assert Content → Journal is
   first and Enter navigates) needs a browser with a session. The logic beneath it is covered:
   `searchRoutes('journ', …)` is asserted to return the journal route first.
   **Step 7 is done** — and the step as written was wrong; see `PHASE-05-09.md`, which now records
   why, and `tests/unit/rls/phase05.test.ts`, which replaces it.
6. ~~`DATA_MODEL.md` Phase 05 pass~~ — **done**, and it corrected a divergence: the document said
   `activity_events.actor_role` was `text`; it is the `user_role` enum, matching
   `audit_logs.actor_role`. Verified against the live schema.
7. **`dashboard_card_order` has no writer.** The column exists, the shell reads the chrome, and
   nothing reorders dashboard cards. Not an exit criterion; deferred deliberately rather than
   forgotten.

## Status *(Phase 04, kept for its verification record)*

> The current phase's status is at the top of this file. The sections from here down are the
> accumulated record of Phases 02–04, newest first within each; they are kept because they carry
> verification detail that is still true and still occasionally needed.

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

**Phase 07**

```
content/media-slots.ts · content/asset-purposes.ts
lib/media/{manifest,migration,gaps,inventory}.ts
lib/media/providers/cloudinary-admin.ts
scripts/media/{migrate-higgsfield,assert-no-regeneration,build-asset-status}.ts
components/studio/{HiggsfieldTracker,HiggsfieldAssetDrawer,CopyBriefButton}.tsx
app/(studio)/studio/(shell)/media/higgsfield/page.tsx        (was a stub)
supabase/migrations/{0040_phase07_higgsfield,0041_rls_policies_phase07}.sql
tests/unit/{higgsfield-migration,media-gaps,media-inventory}.test.ts
tests/e2e/higgsfield-tracker.spec.ts
docs/media/HIGGSFIELD_ASSET_STATUS.md                        (now generated between markers)
```

**Phase 02 (original list)**

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

**Migrations `0040` + `0041` (Phase 07).** `higgsfield_migration_runs` — the per-run audit record,
with `constraint higgsfield_migration_runs_counts_add_up check (migrated + skipped + failed <=
attempted)`, because a run that reports more outcomes than attempts is a bug in the script and the
database is the last place that can say so. `0041` is its generated select policy: readable with
`media.read`, insertable by the service role only. `db:check-schema` required a tier decision for
the new table; it is recorded as a §1.4 run-record exemption.

Both applied to the local cluster and to the hosted project, which now records **19 migrations**
with `0041_rls_policies_phase07.sql` as the latest. Verified 2026-09-08:
`higgsfield_migration_runs` exists on both, holds **0 rows** on both, and hosted `media_assets`
holds the 3 Phase 06 canaries — the migration has not been run.

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

**Phase 07 (current).** **733 unit tests across 63 files, no skips**, with a local PostgreSQL
16.13 cluster reachable. Sixteen static gates and six database gates green. Playwright:
`higgsfield-tracker.spec.ts` 6 passed, 8 `fixme`.

New this phase: 21 migration tests driving all 250 real manifest rows through the planner with a
fake uploader; 32 gap-engine tests; 21 inventory tests including the three counts verification
step 7 asserts through the UI.

Three tests earned their existence by failing first:
- The Zod schema rejected the real manifest on its first run — `source_min_url` is `null` on the
  26 videos, not absent. The schema said `.optional()`; it is `.nullable()`.
- Two transform tests caught a fix that ran preset widths through `snapWidth`, turning `hero`
  into 1920 and `thumb` into 320.
- The ID-collision test caught `large-format.coffee` minting `LARGE-FORMAT-COFFEE-001`, the same
  name as the family allocator's future `LARGEFORMAT-COFFEE-001`.

---

**Phase 03 (original record).**

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

### Phase 07 — four things worth knowing before touching this code

**1. The migration has never executed, and the first attempt to run it found two defects in
thirty seconds.** Neither was in the logic the 21 offline tests cover — both were in the wiring
around it, which is exactly where a fake uploader cannot look:

- **`.env.local` was never loaded.** Next.js loads it for the app; a `tsx` CLI is not Next.js and
  nothing was loading it here. Every asset failed with "Missing required environment variable
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" while that variable sat in the file the whole time. Fixed with
  `process.loadEnvFile` (built into Node 22, no dependency). It does not override an
  already-exported variable — verified, because `db:reset` depends on that property.
- **A missing credential was recorded as 250 asset failures.** `configure()` is lazy, so the first
  upload threw inside the per-asset `try/catch`, which dutifully wrote a ledger entry and moved on.
  The result was a committed file describing a problem that was never about the assets. Now checked
  once, before anything is written.

The planner, ledger rules, row mapping and idempotency claim remain exercised over all 250 real
manifest rows — but with a fake uploader, and a fake uploader cannot 400. Phase 06 is the precedent:
23 URL-builder tests passed while every video URL would have been rejected, and a 20 MB PNG failed
an upload cap no test knew about. Treat the first real run as a source of new information, and run
`--limit=5` before the full 250.

**2. `slot_key` now carries the registry key, and Phase 08 must honour that.**
`MEDIA_GUIDE.md` §6 previously documented short section-scoped keys (`media`, `card.3`). Nothing
enforces the new contract — the database check constraint only requires non-blank — so a Phase 08
trigger that writes the old form will make the Gaps tab report every slot as unbound, silently and
plausibly. The reasoning is recorded in three places (the guide, the header of `lib/media/gaps.ts`,
and this file's *Next Exact Action*) precisely because nothing in code can catch it.

**3. The `EMPTY_STATE` resolution is load-bearing, not a nicety.**
`/portfolio` is a gap that must never be filled by generation: a portfolio entry asserts Rivya
delivered a piece to a client. `briefableGaps()` excludes it by construction and the Gaps tab
shows no "Copy brief" button on it. If a future change filters `report.gaps` directly instead of
calling `briefableGaps()`, that protection disappears with no test failing — the only thing that
would notice is a human reading a brief for work nobody has done.

**4. The tracker's `?asset=` drawer trusts nothing and 500s on nothing.**
An unknown asset id resolves to `null` and closes the drawer; an unknown `?tab=` falls back to
Inventory. Both are deliberate: these are pasted-link parameters, and a stale link in somebody's
messages should not take the page down. The e2e suite asserts the tab case.

### Phase 06 — three things the tests could not have caught, and one they did

**`g_auto` inline on a video is HTTP 400, and every video URL in the product had it.** Found by
putting the chains `lib/media/url.ts` builds to the live Cloudinary API during the canary run, not
by reading documentation. Cloudinary answers `"g_auto must be in a transformation component by
itself"` — but only on the video namespace; inline `g_auto` is perfectly valid on an image. All six
presets carry `gravity: 'auto'`, so **every video and every derived poster would have 400ed in
production**. `posterUrl` was hit by the same rule for a reason easy to miss: a poster is an image
in its output and a video-namespace delivery in its addressing.

Twenty-three unit tests over the URL builder passed throughout. They compared strings; none of them
sent one anywhere. **A URL builder is only testable against the service that parses the URL.** The
unit tests remain worth having for the cache-stability properties — parameter ordering, `dpr_1`
omission — which are ours to decide and cheap to regress. Fixed and re-verified against the live
API; the chains are tabulated in `CLOUDINARY.md`.

**The transform policy was invented rather than read.** My first `transform.ts` had five presets on
a ten-rung ladder; the phase document and `CLOUDINARY.md` §5 both fix six presets and a nine-rung
ladder. The miss that mattered: `SECURITY.md` §7.2 tells the owner what to supply for a default
social card by referring to "the Phase 06 `og` preset's output size" — and there was no `og`
preset. A specification other documents already cite is not a starting point to improve on.

**Two gates were missing from `MediaVideo`.** `saveData`/`deviceMemory` and, separately, the 768px
viewport gate. RC-233's own record names all four; I had implemented one, then three. Both are now
in and tested, including the `< 4` boundary.

**What the tests DID catch:** `source` being `not null` with no default broke two RLS fixtures
immediately. One of them was the write-permission probe — where a constraint rejecting the insert
would have made all four "may not" assertions pass without RLS being involved at all.

### Earlier

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

### Owner-side, from Phase 11

0. **Run `npm run media:migrate:higgsfield`, then bind the homepage's families.** This is the one
   action that unblocks the most: `media_assets` is empty, so every image on every page is the
   SEED §47 fallback well, no visual baseline is worth taking, and no Lighthouse number would mean
   anything. The Phase 11 document's media table names every family and asset id the homepage
   needs, including the hero pair (`LARGEFORMAT-DINING-002` still 21:9, `-001` mobile 9:16,
   `-005` desktop motion 16:9, `-004` mobile motion 9:16). Binding is an edit to
   `content/seed/media-bindings.ts` and a re-seed — but an entry naming an asset that does not
   exist is a hard seed failure, so it cannot be done before the migration runs.

0a. **Decide about the Lighthouse workflow.** `.github/workflows/lighthouse.yml` is manual dispatch
   only, deliberately: three Chrome runs per route per push is the most expensive thing this
   repository could add, and the standing instruction is to stay inside the free Actions tier.
   Running it on pull requests needs an explicit decision — and the Actions spending limit below
   fixed first, since no workflow on this repository has ever executed a step.

0b. **The 21:9 hero motion gap.** The manifest holds no 21:9 video at all, so the desktop clip is
   16:9 played inside the 21:9 still with `object-fit: cover` — accepted, and recorded in
   `content/media-slots.ts` as `home.hero.video`, resolution `GENERATE`. Filling it is a new
   generation and needs the owner's approval under D6.

### Owner-side, from Phase 09

0. **Run `npm run seed:content` against the hosted database.** The schema is current at 27
   migrations; the content is local only. 231 records. It must be the RUNNER, not hand-written
   SQL: the runner stores a `seed_content_hash` per row, which is how it later tells its own
   writes from an edit a person made. Rows inserted without it would be treated as owner-edited
   and skipped by every future run.

0a. **Verify the 80 flagged rows in Studio.** Every FAQ answer, every process step, and every
   sentence asserting what Rivya can physically make. None of them can be published until the
   owner clears the flag — `cms_publish_section` refuses with RV002.
   `docs/content/INITIAL_CONTENT_INVENTORY.md` lists all of them.

0b. **Supply the Google Maps location for the contact page.** SEED §21 refers to an "existing
   supplied Google Maps destination" and supplies none, so the field is seeded null rather than
   guessed. Everything else on that section — phone, WhatsApp, email — is seeded from §21 and needs
   only confirming.

### Owner-side, from Phase 08

0. **Run `npm run seed:content` against the hosted database.** The schema is there; the content is
   not. This writes 12 `pages` route shells and 5 `global_content` strings. It must be the RUNNER,
   not hand-written SQL: the runner stores a `seed_content_hash` per row, which is how it later
   tells its own writes from an edit a person made. Rows inserted without it would be treated as
   owner-edited and skipped by every future run. One command, from any machine whose
   `DATABASE_URL` can reach the pooler.

0b. **Verify the 250 Higgsfield assets in the Media Manager.** Every one is `APPROVED` *and*
   `OWNER_VERIFICATION_REQUIRED`, which is exactly what `cms_publish_section` refuses with RV006.
   Until they are verified, **no section that binds one can be published** — so the site cannot go
   live on Higgsfield media at all. This is the design working: the assets are AI-generated and
   assert things about Rivya's work that only the owner can confirm.

0c. **Decide the Vercel cron cadence.** `vercel.json` schedules the content sweep once a day at
   03:00 UTC, because the Hobby plan permits daily crons only. A section scheduled for 09:00
   therefore publishes at 03:00 the next day. Hourly or finer needs a paid plan; nothing has been
   changed that would incur a charge.

### Owner-side, blocking Phase 07's exit criteria

1. **Add `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` to `.env.local`, then run
   `npm run media:migrate:higgsfield`.** Both names are already in `.env.example` and documented in
   `ENVIRONMENT.md` §5; the working `.env.local` carries `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` but
   not those two. Phase 06's canaries hid this — they were uploaded through the Cloudinary MCP
   server, which carries its own credentials, so nothing had ever exercised the script's own
   authentication path. The script now checks all three before it uploads anything and names what
   is missing.

   Commands and expected output are under *Next Exact Action*. Verification step 2 (`--dry-run`)
   **has now been run here and passes**: `attempted 250, migrated 0, skipped 0, failed 0`. Steps 3
   onward still need Cloudinary: the sandbox proxy answers 403 to CONNECT for both
   `api.cloudinary.com` and `d8j0ntlcm91z4.cloudfront.net`, which its own README says to report
   rather than route around. Exit criteria 1–5 stay unticked until the run happens.

2. **Rotate six secrets, all exposed in a chat transcript on 2026-09-08.** Names only below; no
   value, prefix or length is recorded anywhere in this repository.

   | Secret | What it grants if leaked |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Full read/write on every table, bypassing RLS entirely |
   | `SUPABASE_SECRET_KEY` | Same class of access |
   | `SUPABASE_JWT_SECRET` | Ability to MINT a valid session for any role, including `owner` |
   | `POSTGRES_PASSWORD` | Direct `psql` access to the hosted database |
   | `CLOUDINARY_API_KEY` | Paired with the secret below |
   | `CLOUDINARY_API_SECRET` | Upload, overwrite, transform and **delete** any asset in the account, and sign the browser upload endpoint |

   The four Supabase values were pasted earlier; the Cloudinary pair was pasted while working
   through the migration. Treat all six as compromised until confirmed rotated. The owner's
   instruction was to rotate once all phase work is finished, which is why this is a standing
   record rather than a blocker.

   **Rotating the Cloudinary pair does not disturb anything already delivered.** Delivery URLs are
   unsigned and keyed on the cloud name; only uploads and the sign endpoint use these credentials.
   Rotate in the Cloudinary console → Settings → API Keys, then update `.env.local` and the Vercel
   environment (`ENVIRONMENT.md` §5.2 lists which variables Vercel needs).

3. **GitHub Actions has still never executed a step.** Every run across every workflow reports
   `runner_id: 0`, an empty `runner_name`, a two-second created→completed span and 404 logs —
   including the 6 runs on `main`. Adding a payment method did not change it. Every gate CI would
   run has been run locally instead, and the results are in this file, but "CI is green" is not a
   claim anyone can currently make about this repository.

### Carried, and unblocked

- **The per-role RBAC e2e matrix** — 7 `test.fixme` in `media-upload.spec.ts`, 4 in
  `studio-access.spec.ts`, 8 in `higgsfield-tracker.spec.ts`. All need an authenticated Supabase
  session, which is now reachable; nobody has taken them.
- **The Studio shell's visual baselines**, and **`dashboard_card_order`**, which still has no
  writer.

**None outstanding for Phase 02.**

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

**Phase 44 is development-complete. The next phase is 42 — Comprehensive Testing**, which the owner
deferred to run after Phase 44 and which now carries every test deferred from Phases 41–44. Phases
45 and 46 follow it. Phase 42 is
runs after Phase 44 with every test deferred from Phases 41–44: the owner's instruction is "complete
all phase development work and do all test-related work after Phase 44".

*(The paragraph below is Phase 22's, kept for its record.)*

**Phase 22 is finished, and the owner asked that no new phase start until they say so.**
The next phase is **23 — Global Search + Product Relationships** (`docs/project/phases/PHASE-23-30.md`),
whose migrations are `0210`–`0213`, unspent. It assumes `entity_relations` and `product_relations`
populated only by human action (16), searchable projects and articles (17, 18), queryable forms
(19), enquiries as a Studio entity (20) and merchandising slots so search and curation cannot
disagree about what is published (22) — all of which exist. It must not expose `research_*` data
in public search (FEAT §19).

Owner-side, unchanged in kind:

1. **Curate.** Publish products, then arrange them under Studio → Merchandising → Homepage
   and Store; feature owner-confirmed collections under Featured. Until then every slot shows its
   fallback.
2. **Supply the first GLB** of an object that exists, through `/studio/media/models`, with a
   photograph as its poster; then switch `three_d_viewer` on in `/studio/system/flags`. Until then
   the viewer is built and silent.
3. **Publish a commission template** (all three are DRAFT) for `/custom-commissions` to show one.
4. **Decide the 20-of-30 hosted demo products** — finish, roll back or leave.
5. **Rotate the six exposed secrets** — still outstanding, and still recorded under *Known Issues*;
   the owner asked for this to wait until all phase work is finished.

### Superseded — the Phase 16 plan

**Start Phase 16 — Collections / Exhibitions**, or run the owner-side actions below.

Phase 16 assumes a public shell that composes CMS blocks (10), a finished block vocabulary (11–13),
a catalogue it can filter by collection (14) and a product page to link into (15). All four exist.
Nothing in the repository blocks it.

The owner-side list has SHRUNK since Phase 14 — two of its five items are done:

1. ~~Apply the migrations to hosted.~~ **Done.** Hosted is at `0132` and fingerprint-matches local.
2. ~~`npm run media:migrate:higgsfield`.~~ **Done.** All 250 assets are in Cloudinary (231 new, 19
   adopted, 0 failed) and `media_assets` holds 250 rows locally and on hosted, verified by two
   independent fingerprints.
3. **`npm run seed:content` against hosted**, then publish in Studio. The content itself is already
   replayed and fingerprint-matched across all seven tables; what remains is the owner deciding what
   to publish.
4. **Enter the first products.** Still the one thing on this list no command can do:
   `/studio/catalog/products/new`, as `owner`, `admin` or `merchandiser`. Nothing seeds a product
   and nothing imports one. The readiness checklist on each names exactly what is missing — and the
   Specifications item can be satisfied by saying a piece publishes none, so it never asks anyone to
   invent a measurement.
5. **Rotate the six exposed secrets** — still outstanding, and still recorded under *Known Issues*.
   The owner asked for this to wait until all phase work is finished.

### Superseded — the Phase 15 plan

**Start Phase 15 — Product Detail Experience**, or run the owner-side actions, which are now five
phases old and have grown by one.

Phase 15 is the phase that makes a product card a link: it builds `/product/[slug]`, the gallery with
its media roles, the specification table and the eleventh readiness item. Nothing in the repository
blocks it.

The owner-side list, in the order of what each unlocks:

1. **Apply `0120`–`0122` to hosted.** The repository is at `0122`; `ccvarsmzickdkryoakdg` is at
   `0080`. Until they are applied, the deployed preview's `products` table has no `price_minor`, no
   `availability_state`, no `edition_state` and no concept-media trigger — so the catalogue routes
   would fail there even with content. `npm run db:migrate -- --apply --allow-remote` from a machine
   that can reach the session pooler, or the Supabase MCP server as `0050`–`0080` were applied.
2. **`npm run media:migrate:higgsfield`**, which still closes the visual-baseline and Lighthouse
   gaps for every page built so far.
3. **`npm run seed:content` against hosted**, then publish in Studio.
4. **Enter the first products.** This is the one thing on this list no command can do:
   `/studio/catalog/products/new`, as `owner`, `admin` or `merchandiser`. Nothing seeds a product,
   nothing imports one, and the checklist on each product names exactly what is still missing before
   it can be published.
5. **Rotate the six exposed secrets** — still outstanding, and still recorded under *Known Issues*.

### Superseded — the Phase 14 plan

**Start Phase 14 — Product Catalog**, or run the owner-side actions, which are now four phases old.

`npm run media:migrate:higgsfield` still closes the visual-baseline and Lighthouse gaps for every
page built so far. Phase 14 is the first phase that needs something else from the owner as well:
`products` has no rows and no seed will ever add any.

### Superseded — the Phase 13 plan

**Start Phase 13 — Large Format Experience**, or run the owner-side actions below, which still
unblock more than any code change can.

The two measurement gaps Phase 11 opened are now two phases old, and both close the moment
`npm run media:migrate:higgsfield` runs: no media means no visual baseline worth taking and no
Lighthouse number worth recording. After that, `npm run seed:content` against hosted, then publish
in Studio.

### Superseded — the Phase 12 plan

**Start Phase 12 — the remaining page compositions**, or run the two owner-side actions below,
which unblock more than any code change can.

Nothing in the repository is waiting on a decision. Phase 11 left two things measured-not-yet
(`PERFORMANCE.md` §8's LCP/CLS/INP for `/`, and a visual baseline), and both need media before the
number would mean anything. In order of what they unlock:

1. **`npm run media:migrate:higgsfield`** from a machine whose network reaches Cloudinary. It has
   never run; `media_assets` is empty on both databases; every image on every page is a fallback
   well until it does. Then bind the homepage's families in `content/seed/media-bindings.ts` — the
   Phase 11 document's media table names every family and asset id — re-seed, and the first
   Lighthouse run is worth taking.
2. **`npm run seed:content` against hosted.** The schema is current at 28 migrations; the content
   has only ever been written to the local cluster, so the deployed preview renders a wordless
   shell and 404s every CMS route.

Then publish. In `/studio/content/pages`, take a page's sections DRAFT → REVIEW → APPROVED →
PUBLISHED; the route turns 200 the moment one section is live. Twenty-eight of the fifty-three need
nothing but the workflow; the other twenty-five are refused with RV002 until the owner verifies the
claim they make.

### Superseded — the Phase 11 plan

**Start Phase 11 — Homepage + Material Experience.** The shell is built and every route answers
404, so the next phase is the one that gives the homepage something to say: ten of its thirteen
seeded sections have block types with no renderer (amendment A8), which is what stands between the
copy in the database and a page a visitor can read.

The first increment is the four Tier-2 blocks the homepage needs most — `manifesto`,
`selected-works`, `material-story` and `final-cta` — added to `components/sections/registry.ts`
against the modules `lib/cms/registry.ts` already declares. Nothing about the shell, the routing or
the data layer changes: `renderCmsPage` maps a `block_type` to a renderer and returns null for the
ones that have none, so each renderer added is one more section that appears.

**One owner-side action would make the site visible today, and it is not a code change.** In
`/studio/content/pages`, take a page's sections DRAFT → REVIEW → APPROVED → PUBLISHED; the route
turns 200 the moment one section is live. The 25 flagged sections need verification first — the
database refuses them with RV002 until the claim they make is confirmed — but the other 28 do not.
The "On site" column added this phase links straight to the result, in draft mode when the page is
not published.

### Superseded — the Phase 10 plan

**Start Phase 10 — Public Website Foundation.** Everything it needs exists and nothing renders:
`lib/cms/resolve.ts` is the single read path, `lib/cms/media.ts` hydrates a page's assets in one
query, `components/sections/` renders six block types, and 231 records of real copy are in the
database. What is missing is `app/(site)/[[...path]]` — a route that calls `resolvePage`, hydrates,
and renders `SectionList`. The first increment is the homepage and `/about`, which between them
exercise the hero, statement, category-grid and process-steps renderers.

*Built, with one deviation:* thirteen route files rather than a catch-all segment. A
`[[...path]]` route would also swallow `/product/x` and every other future path — resolving there,
finding no `pages` row and answering 404, instead of failing when a later phase forgets to add the
route. One file per D3 path keeps the map in the file system, and a test asserts they agree.

### Superseded — the Phase 09 plan

**Start Phase 09 — Initial Content Seed.** The engine is built and empty; Phase 09 writes the copy
into it. Nothing in Phase 09 is blocked by the two owner-side items below, and both should happen
alongside it rather than before it:

- `npm run seed:content` against hosted, which puts the route shells and the five global strings
  there. Phase 09's own modules extend the same runner, so doing this first means each later run is
  an increment rather than a first import.
- Verifying the 250 Higgsfield assets. Phase 09 can write and review every section without it;
  what it cannot do is PUBLISH one that binds an asset, because RV006 refuses. So the copy can be
  written, reviewed and approved in parallel, and the site goes live when the verification does.

Phase 09's first increment is the section modules for `/` and `/about`: `content/seed/sections/`,
one module per page, each record carrying its own `fact_classification` and — where it asserts
business capability — `OWNER_VERIFICATION_REQUIRED`, which is what makes D10 a schema rule here
rather than a review convention.

### Still outstanding from Phase 07

**Run the Higgsfield migration.** In this order relative to Phase 09 it no longer blocks: the CMS
binds assets by id, and `computeGaps()` already reports which slots the manifest could fill, so
sections can be written against slots whose assets have not landed yet.

#### The migration command (owner-side, ~20 minutes)

This cannot run in the sandbox: the proxy refuses CONNECT to `api.cloudinary.com` and to
`d8j0ntlcm91z4.cloudfront.net`, which is where the source files live. On a local machine with
`.env.local` present:

First add the two missing credentials to `.env.local` — the script refuses to start without them
and names them:

```
CLOUDINARY_API_KEY=...        # Cloudinary console → Settings → API Keys
CLOUDINARY_API_SECRET=...
```

Then:

```bash
npm run media:migrate:higgsfield -- --dry-run     # expect: attempted 250, migrated 0, skipped 0, failed 0
npm run media:migrate:higgsfield -- --limit=5     # a small real run first; check Cloudinary
npm run media:migrate:higgsfield                  # expect: migrated 245, failed 0
npm run media:migrate:higgsfield                  # expect: skipped 250, migrated 0
```

The script loads `.env.local` itself, so no `export` is needed — but an exported variable still
wins over the file, so a `DATABASE_URL` pointing at a local cluster is respected.

Then verification steps 5 and 6 from `PHASE-05-09.md` §07, and commit
`data/higgsfield/migration-log.json` — it is the resume mechanism and it belongs in git.

If an upload fails, the run records the failure per asset with its message, continues, and exits
non-zero. Re-running resumes from the ledger; nothing already uploaded is paid for twice.

### 2. Then Phase 08 — CMS / Editable Content System

Read `docs/project/phases/PHASE-05-09.md` §PHASE 08. Four things it inherits, each established
rather than guessed:

1. **`media_usages.slot_key` carries the registry key from `content/media-slots.ts` verbatim** —
   `home.hero.video`, not `media`. Repeating slots take the index form `key[0]`…`[3]`, which
   `slotKeyOf()` strips. This is a contract Phase 08 must honour or the Gaps tab silently reports
   everything as unbound; the reasoning is in `MEDIA_GUIDE.md` §6 and the header of
   `lib/media/gaps.ts`.
2. **Publishing promotes media explicitly.** §07's *Asset status on migration* specifies it: when
   a `page_sections` row goes `PUBLISHED`, every `APPROVED` asset reached through its
   `media_usages` rows is promoted in the same transaction, with an `activity_events` row each.
   An asset in `DRAFT`, `REVIEW` or `ARCHIVED` refuses the publish and the error names its
   `rivya_asset_id`. Unpublishing does **not** demote — an asset may serve several sections.
3. **The 250 land as `APPROVED`, never `PUBLISHED`.** Anon `SELECT` on `media_assets` requires
   `PUBLISHED` (D5), so without rule 2 Phase 09 would seed sections whose media is unreadable by
   the public and Phase 10 would render a missing image with no error anywhere.
4. **Studio copy still lives in `components/studio/strings.ts`.** Every entry declares the
   `global_content` key it becomes; Phase 08 creates that table and Phase 09 seeds it, at which
   point `t()` reads a request-scoped map and no call site changes.

Carried from Phase 05 and still open — both unblocked by the reachable Supabase project, so
whichever phase gets there first should take them: the per-role RBAC e2e matrix (7 `test.fixme`
cases in `media-upload.spec.ts`, 4 in `studio-access.spec.ts`, 8 in `higgsfield-tracker.spec.ts`),
the shell's visual baselines, and `dashboard_card_order`, which still has no writer.

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

**APPLIED, 2026-09-08.** All fifteen migrations (`0001`–`0022`) are on the hosted project
`ccvarsmzickdkryoakdg`, PostgreSQL **17.6**. The Supabase MCP server reached it where ordinary
egress could not, so neither the `db-migrate.yml` workflow nor a GitHub runner was needed.

The hosted schema was compared to the local one field by field and every count matches: 14 tables,
14 with RLS, 55 policies, 63 indexes, 194 columns, 18 check constraints, 9 triggers, 7 functions.
That is PostgreSQL 17 matching a PostgreSQL 16.13 local cluster exactly.

**RLS was verified on the real project**, with a baseline that makes the zeros mean something —
two products (one PUBLISHED, one DRAFT) and one audit row seeded as the table owner, then read back
per role, then rolled back:

| | owner | anon | authenticated non-staff |
|---|---|---|---|
| `products` | 2 | 1 (PUBLISHED only) | 1 |
| `audit_logs` · `staff_profiles` · `activity_events` · `content_seed_runs` | seeded | 0 | 0 |

That closes **Phase 04 verification step 8** and the database half of **Phase 05's** gap.

`public.schema_migrations` is populated with the repository's own checksums, so
`npm run db:migrate` reports "0 pending" rather than trying to re-apply.

After a successful apply, still to run against the project: `npm run seed:content` and
`npm run auth:check-rls`.

Note `supabase/local/00-auth-shim.sql` is applied by `db:reset` and is LOCAL ONLY — it stands in for
roles, grants and `auth.uid()` that Supabase provisions itself. Applying it to a hosted project would
be wrong; it lives outside `supabase/migrations/` so `supabase db push` cannot pick it up.

Phase 14 must **drop and recreate** (not extend) `products_price_state_coherent`,
`products_listing_idx` and `products_facets_idx` — reasons in `0006_catalog.sql` and
`0008_indexes.sql`.
