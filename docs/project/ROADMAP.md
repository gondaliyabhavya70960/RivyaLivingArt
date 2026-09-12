---
doc: ROADMAP
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-12
owner_verification: NOT_REQUIRED
---

# ROADMAP — the phase-wise implementation approach

> The index. Each phase is specified in full under [`phases/`](phases/); this file says how the
> phases relate, what order they can run in, and what blocks them.
>
> Binding contract: [`../architecture/CANONICAL-DECISIONS.md`](../architecture/CANONICAL-DECISIONS.md).
> Verified build state: [`../../PROJECT_STATE.md`](../../PROJECT_STATE.md).
> Where to resume: [`../SESSION-STATE.md`](../SESSION-STATE.md).

## How a phase is written

Every phase document follows one shape, so a phase can be picked up without re-deriving intent:

**Goal** · **Depends on** · **Scope** · **Out of scope** · **Deliverables** (artefact → path) ·
**Database** · **Studio surface** · **Public surface** · **Media** · **Risks** ·
**Verification** · **Exit criteria**

A phase is COMPLETE only when its own exit criteria hold *and* the ten-point completion contract
in CANONICAL-DECISIONS D9 holds. "Documented as planned" is never evidence that a phase is done —
verify against the repository.

## How to execute a phase

```
Read CLAUDE.md → PROJECT_STATE.md → docs/SESSION-STATE.md → the phase document
        ↓
Verify the phases it depends on are genuinely complete, in the repository
        ↓
Implement scope · nothing outside it
        ↓
Run the phase's Verification steps
        ↓
Tick every exit criterion
        ↓
Update CHANGELOG · PROJECT_STATE · SESSION-STATE · the domain docs the change touched
```

## The 47 phases

| # | Phase | Status | Depends on | Document |
|---|---|---|---|---|
| **00** | Repository Audit & Baseline | **COMPLETE** | None. This is the root phase | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **01** | PRD, Architecture & Documentation | **COMPLETE** | Phase 00 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **02** | Reference UI Audit + Design System | **COMPLETE** | Phases 00, 01 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **03** | Supabase Database + Data Layer | **COMPLETE** | Phases 00, 01 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **04** | Supabase Auth + RBAC + RLS | **SUBSTANTIALLY COMPLETE** | Phases 00, 01, 03 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **05** | Studio Foundation | **SUBSTANTIALLY COMPLETE** | Phase 02, Phase 03, Phase 04 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **06** | Cloudinary Media Architecture | **COMPLETE** | Phase 03, Phase 04, Phase 05 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **07** | Higgsfield Asset Audit + Initial Asset Plan | **COMPLETE** | Phase 05, Phase 06 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **08** | CMS / Editable Content System | **COMPLETE** | Phase 03, 04, 05, 06 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **09** | Initial Website Content Seed | **COMPLETE** | Phase 06, Phase 07, Phase 08 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **10** | Public Website Foundation | **COMPLETE** | Phases 02, 04, 06, 08, 09 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **11** | Homepage + Material Experience | **CODE COMPLETE; NOT MEASURED** | Phase 10, 08, 09, 07 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **12** | About + Process | **CODE COMPLETE; NOT MEASURED** | Phases 10, 11 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **13** | Large Format Experience | **CODE COMPLETE; NOT MEASURED** | Phases 10, 11, 12 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **14** | Product Catalog | **CODE COMPLETE; CATALOGUE EMPTY BY DESIGN** | Phases 03, 04, 06, 10, 13 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **15** | Product Detail Experience | **CODE COMPLETE; NO PRODUCTS BY DESIGN** | Phases 03, 06, 10, 14 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **16** | Collections / Exhibitions | **CODE COMPLETE; NONE PUBLISHED BY DESIGN** | Phase 08, Phase 09, Phase 10, Phase 14, Phase 06/07 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **17** | Portfolio / Projects | **CODE COMPLETE; ARCHIVE EMPTY BY DESIGN** | Phase 16, Phase 08, Phase 09, Phase 10, Phase 06 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **18** | Journal | **CODE COMPLETE; NOTHING PUBLISHED BY DESIGN** | Phase 16, Phase 08, Phase 09, Phase 10, Phase 06/07 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **19** | Bespoke / Custom Configurator | **CODE COMPLETE; ON SINCE PHASE 20, TEMPLATES STILL DRAFT** | Phase 06, Phase 08, Phase 09, Phase 14/15, Phase 10 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **20** | Inquiry + WhatsApp Flow | **CODE COMPLETE; NO ENQUIRIES BY DESIGN** | Phase 19, Phase 15, Phase 09, Phase 08, Phase 05 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **21** | 3D Product Experience | **CODE COMPLETE; ZERO MODELS BY DESIGN; FLAG OFF** | Phase 06, Phase 15, Phase 19, Phase 02, Phase 16/17 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **22** | Homepage / Store Merchandising | **COMPLETE; EVERY SLOT EMPTY, WHICH IS THE SHIPPED STATE** | Phase 14, Phase 16, Phase 15, Phase 08/09, Phase 05… | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **23** | Global Search + Product Relationships | **COMPLETE; THE INDEX HOLDS ONLY WHAT IS PUBLISHED** | Phase 03, 04, 05, 10, 14, 15, 16, 17, 18, 20 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **24** | Bulk Management | **COMPLETE; NO ROWS TO OPERATE ON, WHICH IS D10 WORKING** | Phase 04, 05, 06, 14, 20, 23 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **25** | Product Scraper Foundation | **COMPLETE; NO SOURCE APPROVED, SO NOTHING IS FETCHED** | Phase 03, 04, 05, 23, 24 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **26** | Comparator Source Management | **COMPLETE; STILL NO SOURCE, WHICH IS STILL THE SHIPPED STATE** | Phase 25, 04, 05, 23, 24 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **27** | Scraper Extraction | **COMPLETE; NOTHING TO EXTRACT FROM, WHICH IS STILL THE SHIPPED STATE** | Phase 25, 26 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **28** | Normalization + Validation | **COMPLETE; NOTHING TO NORMALISE, WHICH IS STILL THE SHIPPED STATE** | Phase 26, 27, 14 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **29** | Change Detection + Review | **COMPLETE; NOTHING HAS CHANGED BECAUSE NOTHING HAS BEEN FETCHED** | Phase 27, 28, 24, 23 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **30** | Large-Format Research Workspace | **COMPLETE; NOTHING IS CLASSIFIED BECAUSE NOTHING HAS BEEN FETCHED** | Phase 28, 29, 26, 24 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **31** | Analytics + Comparison | **COMPLETE; NOTHING IS MEASURED BECAUSE NOTHING HAS BEEN FETCHED** | Phase 26, Phase 27, Phase 28, Phase 29, Phase 30… | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **32** | Opportunity Engine | **COMPLETE; NOTHING IS RANKED BECAUSE NOTHING HAS BEEN FETCHED AND NO MODEL IS ACTIVE** | Phase 31, Phase 28, Phase 29, Phase 26, Phase 14 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **33** | Visual Similarity | **COMPLETE, FIRST-PARTY HALF; COMPETITOR IMAGES ARE NEVER FETCHED (OWNER DECISION, A33)** | Phase 27, Phase 28, Phase 31, Phase 06/07, Phase 19 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **34** | Product Direction Tool | **COMPLETE; NO BRIEF EXISTS UNTIL A PERSON WRITES ONE** | Phase 31, Phase 32, Phase 33, Phase 30, Phase 08, Phase 05 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **35** | Shortlist + Confirmation | **COMPLETE-WITH-FLAG-OFF; THE BRIDGE IS INERT UNTIL THE OWNER ENABLES `research_product_bridge`** | Phase 28/29, Phase 32, Phase 34, Phase 24, Phase 14… | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **36** | Google Sheets | **COMPLETE; INERT UNTIL THE OWNER'S FIVE-STEP SETUP AND THE FLAG** | Phase 31, 32, 34, 35, Phase 20, Phase 19, Phase 04, D8 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **37** | Studio Analytics | **COMPLETE; EVERY TILE IS A TRUE ZERO OR A NAMED REASON UNTIL THE CATALOGUE AND THE CORPUS FILL** | Phase 31, Phase 32, Phase 26, Phase 14/16, Phase 17/18… | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **38** | Environment + Documentation + Logs | **COMPLETE** | Phase 04, Phase 05, Phase 06, Phase 25–30, Phase 36, D8 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **39** | SEO | **COMPLETE** | Phase 08, 09, 10, 14–15, 16–18, 23, 38 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **40** | Performance | **COMPLETE** | Phase 00, 02, 06, 10, 11, 14–18, 19, 21, 23, 37, 39 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **41** | Accessibility + Security | **DEVELOPMENT COMPLETE** — tests deferred to Phase 42 by the owner's instruction | Phase 02, 04, 05, 06, 10, 14–21, 20, 25–30, 38, 40 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **42** | Comprehensive Testing | **COMPLETE** — ran last, by the owner's instruction to finish development first | Phase 00, 03, 04, 06, 09… | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **43** | Media Coverage + Higgsfield Finalization | **DEVELOPMENT COMPLETE** — tests deferred to Phase 42 | Phase 06, 07`, `content/media-slots.ts`… | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **44** | Vercel Deployment | **DEVELOPMENT COMPLETE** — drills NOT RUN, tests deferred to Phase 42 | Phase 00, 01, 03, 04, 25, 38, 39–43, 41, 42 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **45** | Final Creative Polish | **PARTIAL** — the audit is run and recorded; three questions are the owner's and are outstanding | Phase 02, 11–22, 39, 40, 41, 42, 43, 44 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **46** | Documentation + Handoff | **PARTIAL** — the gates, the generated verification backlog and the documentation set are done; the capability-boundary dry run, the handover session, the runbook screenshots and the 41-row backlog are the owner’s | Phase 01, 38, 39–45, 44… | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |

## Execution order

The dependency graph is not a straight line. Four tracks run largely in parallel once the
foundation lands.

```
FOUNDATION (strictly sequential)
00 → 01 → 03 → 04
       └→ 02  (design system — parallel with 03/04, blocks all public UI)

PLATFORM
05 Studio shell ─┬→ 06 Cloudinary → 07 Higgsfield migration
                 └→ 08 CMS → 09 Content seed

PUBLIC SITE                      ← needs 02, 08, 09
10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23

RESEARCH (independent of the public site after 04/05)
25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36

CROSS-CUTTING (continuous, hardened in their own phase)
24 bulk · 37 analytics · 38 environment/docs/logs
39 SEO · 40 performance · 41 accessibility+security · 42 testing

LAUNCH
43 media finalization → 44 deployment → 45 creative polish → 46 handoff
```

**Critical path to a publishable site:** 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 →
11 → 13 → 14 → 15 → 20 → 39 → 40 → 41 → 42 → 44. Everything else improves that site rather than
gating it.

**The research track (25–36) is separable.** It shares only auth and the Studio shell with the
public site. If time is short it can be deferred wholesale without touching a single public route
— the one thing it must never do is leak into public surfaces (see BUSINESS_RULES).

## What is blocked right now

| Blocker | Blocks | Needed to unblock |
|---|---|---|
| No Supabase project or credentials | 03, 04, and everything downstream | Owner provisions the project; the D8 variables are set |
| No Cloudinary account or credentials | 06, 07 migration | Owner provisions the account |
| Fabrication capability unverified | Publishing 3D + resin and architectural claims | Owner confirms; until then those rows stay `OWNER_VERIFICATION_REQUIRED` and unpublished |
| No verified projects or products | Portfolio and catalog content | Owner supplies real work; empty states ship in the meantime |
| Per-source legal/ToS review not done | Enabling any scraper source | Owner decision per source |

None of these blocks phase 02, and none blocks writing the code that phases 03–09 will run against
once credentials exist.

## Phase 45 backlog — what the creative audit found and deliberately deferred

The audit is `docs/design/DESIGN_SYSTEM.md` §19; the walkthrough it depends on is `docs/ops/TESTING.md`
§14. Nine dimensions were examined and every one returned `FAIL`. The five-condition remit in
`docs/project/phases/PHASE-39-46.md` §45 admits a change only if it fixes one of those findings,
adds no CMS block type, adds no dependency, keeps the Phase 40 budgets green and keeps the a11y
sweep at zero critical and zero serious. Everything below failed one of those conditions, or is a
composition change large enough to deserve its own reviewable diff, and each carries the reason.

### Capability gaps the owner cannot close, and neither can polish

| Item | Why it is not a polish change | Consequence today |
|---|---|---|
| **No control publishes a category.** `saveCategoryAction` writes name, subtitle, description, order, hero image and the two SEO fields and never `status`; there is no `publishCategoryAction` anywhere in the repository | Adding a publish action is a Studio surface, which §45 puts out of scope | All seven `categories` rows stay `DRAFT`, so all seven `/collection/<slug>` routes 404 and the chrome now omits them (§8.1). The catalogue is reachable only through `/collection` itself |
| **`/faq`, `/privacy` and `/terms` cannot be filled by an editor.** `faq-list` and `rich-text` are PLANNED block types with no renderer, so a published page would render nothing | Building a renderer adds a block type, which the remit forbids outright | Three published `pages` rows with no published sections, so three 404s. Now omitted from the footer rather than linked |
| **`/studio/content/faqs` and `/studio/system/settings` are route stubs**, their own comments naming Phases 08 and 20 as the owners | Same reason | The WhatsApp number and the message templates are an engineer change today. `TESTING.md` §14.3 records this as part of audit question 8's verdict rather than as an omission from it |
| **`'contact-details': null` in the section registry** — the block has no renderer, so `chrome.contact` is always null | Same reason | The footer's WhatsApp affordance never renders on any page, and the studio's address and hours appear nowhere |

### Conversion — four of the six affordances do not exist

FEAT §49 question 6 names six. `ProductInquiryRail` returns the same
`/contact?product=<slug>&type=product` for two of them and the `type` parameter is read by nothing;
`QUOTE` and `CONSULTATION` are real enum values with real schemas, real WhatsApp templates and two
Studio inbox views that can never receive a row; `Customize` is gated on a flag that ships off,
behind a block type nothing seeds.

Giving each of the six a distinct affordance is wiring and composition, not new copy — the labels
and the enquiry types already exist in `global_content` and in the enum — but it changes the
conversion path, which is the one business rule this project has, and it belongs in a diff a
reviewer reads on its own rather than inside a polish PR. **Deferred, with the enum values and the
string keys named in the audit's evidence.**

The pass condition's own "within two clicks" is unsatisfiable for "Continue to WhatsApp", because
D1 requires the enquiry to be persisted first and `buildHandoffUrl` takes a non-optional inquiry id.
`DESIGN_SYSTEM.md` §19.1 records the condition as wrong rather than the code, and FEAT §49 should be
amended to "within two clicks of the surface that files it".

### Composition changes held for their own diff

| Item | Finding | Why deferred |
|---|---|---|
| **Hero dominance** | The hero is a 21:9 `AspectBox`, so its share of the viewport runs 91 · 69 · 61 · 49 · 37 · 91 · 82 · 76 % across the eight QA widths and the ≥ 70 % condition is met or missed by accident. At 768 the hero holds barely a third of the screen | The fix is a viewport-relative floor in a token, and it moves every tier-A visual baseline. One change, one diff, its own re-baseline |
| **Section rhythm is uniform** | Four steps are declared and 26 of the 28 renderers use `lg`; `sm` and `xl` are dead, so ten consecutive bands on `/` are spaced identically and §50's "deliberate negative space" is not expressed | Assigning a weight per block type is a judgement about each band, and it moves every baseline. Same reason |
| **No sticky conversion affordance** | On `/product/<slug>` at 390 the two calls to action sit at y = 997 and 1053 of a 1928 px document, outside the thumb zone on every phone | §7.10 specifies a sticky submit row that was never built. It is a new pattern, not a tuned one |
| **`media_crops` is written and never read** | The Studio writes focal points and no public renderer consults one, so the owner's crop work has no effect. `TESTING.md` §14.3 leaves operation O10 in the owner's ten deliberately, so question 8 discovers it | Threading crops through the delivery layer is a media-pipeline change |
| **`MobileNav` does not meet §8.3** | Disclosure children, 56 px rows and a pinned primary action are specified and absent | A pattern rebuild |
| **The journal card's `h2` truncates at 390 and 360** | The only truncated heading at any width | Small, but it belongs with the card's mobile composition rather than alone |

### Technical refinement

**A cold, throttled load paints unstyled.** At 1.6 Mbps with 4× CPU throttling, `/collection` paints
at ~250 ms with zero stylesheets, in Times New Roman, with the default 8 px body margin and a body
13877 px tall; the sheet lands at ~500 ms and it reflows to 4526 px. Measured CLS is **0.98 at 1440
and 1.00 at 390**, against a "good" threshold of 0.1. `/large-format` measures 0.66; `/`, `/about`
and `/product/<slug>` are all under 0.04.

This is recorded rather than fixed because the measurement is of `next start` behind a throttled
link, and whether Vercel's transport (HTTP/2, CDN, early hints) paints the same way is unverified.
**The next action is to measure the deployed preview, not to change the code.** If it reproduces, it
is the largest single technical-refinement defect in the product and it is a Phase 40 concern as
much as a Phase 45 one.

A second, much smaller shift follows at ~1.4 s on every route: the Inter fallback swapping to Inter
(`130×20 → 120×20` on a paragraph). `next/font`'s `adjustFontFallback` is the mechanism; it is worth
one line when somebody is already in that file.

### The same capability claim is held back in one table and published in another

`global:BRAND.brand.introduction` (`content/seed/global.ts:103`) is seeded `DRAFT` and
`OWNER_VERIFICATION_REQUIRED`, and its own seed note says why: "it enumerates fabrication
capabilities — resin work, digital design, 3D fabrication, hand-finishing — that only the owner can
confirm Rivya has."

Two rows make the same kind of claim and ship `PUBLISHED` with `NOT_REQUIRED`:

* `seo:global.description` (`content/seed/seo.ts:196`) — "Rivya Living Art **creates** resin
  furniture, collectible objects, statement art and bespoke pieces shaped through material craft and
  contemporary form."
* `seo:global.social_description` (`content/seed/seo.ts:198`) — "Explore resin furniture, sculptural
  objects, large-format art and bespoke commissions."

Both are visitor-facing: the first is the meta description on every page without an override, the
second is what a shared link shows. Whether they are true is a fact about the business, so they are
recorded here for the owner rather than edited by us — a sentence is either true, in which case the
owner clears it, or it is not, in which case the owner rewrites it. Neither is an engineer's call.

The mechanism that should have caught it does not exist yet: `scripts/content/classify-copy-diff.ts`
is a Phase 45 deliverable and the repository's only fabrication scan today is a five-token regex
duplicated in `tests/e2e/about.spec.ts` and `process.spec.ts`, both of which skip when the route has
no published sections — which has been the state of every route, so it has never executed. The
specification for the classifier is written and deferred with the rest of the script work.

## Post-launch backlog — there is no Phase 47

Phase 46 is the last phase. Its exit criteria say so, and say where later work goes instead: here.
Nothing below is a commitment or a date. Each row is something a person found, with enough detail to
act on and the reason it was not done at the time.

### The owner's, and nobody else can do them

| # | Item | Why it is the owner's | Where it is written down |
|---|---|---|---|
| O1 | The 41-row owner-verification backlog | Every row states something about a real business that only the owner can confirm (D10) | [`../content/INITIAL_CONTENT_INVENTORY.md`](../content/INITIAL_CONTENT_INVENTORY.md), and the card on `/studio` |
| O2 | The capability-boundary dry run — ten Studio operations, unaided | It is a measurement of whether the software is usable by its owner, which only the owner can take | [`../ops/TESTING.md`](../ops/TESTING.md) §14.3 |
| O3 | The handover walkthrough | A fact about the world: whether it happened, and when | [`../studio/STUDIO_GUIDE.md`](../studio/STUDIO_GUIDE.md) |
| O4 | Runbook screenshots | Cannot be captured in the build container at all — the local harness has no auth server, so the Studio is unreachable by a browser. They need a preview deployment against the Phase 42 fixture, and must contain no real enquirer's data and no environment value | [`../studio/STUDIO_GUIDE.md`](../studio/STUDIO_GUIDE.md) §16 |
| O5 | Phase 45 questions 1 and 5 — does it feel like a collectible-design studio, and the first-time walkthrough | Question 1 is a judgement the people who built it cannot make about it; question 5 needs three first-time participants | [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) §19 |
| O6 | The two deployment drills, rollback and forward-fix | Both need a production deployment a person is willing to break; with one Supabase project the forward-fix drill would migrate the production database | [`../ops/DEPLOYMENT.md`](../ops/DEPLOYMENT.md) §11.1 |
| O7 | The canonical-host setting | `rivyalivingart.com` and `www` each redirect to the other, so the live site is unreachable on both. Half the cause is a Vercel dashboard setting no repository can see; preflight gate 14 now detects it | [`../ops/DEPLOYMENT.md`](../ops/DEPLOYMENT.md) §7.0 |

### Engineering, found in passing and deliberately not fixed in the phase that found it

| # | Item | Evidence | Why it waited |
|---|---|---|---|
| E1 | `lib/cms/docs/index.ts` reads its index with a runtime `join(process.cwd(), …)`, so Turbopack traces **the whole project** into the server bundle | The Vercel build log warns in as many words: "leads to all source files (including the public folder) to be deployed as part of the server code… can slow down deployments or lead to failures when size limits are exceeded" | A warning, not an error, and Phase 38's code rather than Phase 46's. The fix is a statically-scoped path or a `turbopackIgnore` comment, and it wants measuring before and after |
| E2 | There is no `.nvmrc` | The recovery sequence in [`../../README.md`](../../README.md) tells a newcomer to run `nvm use`, which has nothing to read. Node 22 works | Adding one changes the version Vercel builds with, which is a deployment change and does not belong in a documentation phase |
| E3 | `npm run build` needs a reachable database and an environment before it will run at all | Both steps are now documented in [`../../README.md`](../../README.md), having been discovered by executing the sequence | Documented rather than automated: a setup script that minted its own throwaway credentials would be the third way to configure this project |
| E4 | Coverage is measured on the `unit` project alone | [`../ops/TESTING.md`](../ops/TESTING.md) §13 | Merging three runners' coverage is a harness change, and the thresholds would need re-deriving |
| E5 | Studio browser coverage stops at the login page — about 156 specs skip | [`../ops/TESTING.md`](../ops/TESTING.md) §13 | Needs an auth server the local PostgREST harness cannot provide. The specs are written and will run the moment one exists |
| E6 | Visual baselines are not compared in CI | [`../ops/TESTING.md`](../ops/TESTING.md) §3 | Font rasterisation differs between this container and a GitHub runner by more than a page of text absorbs. Fixing it means generating baselines on the runner |

Phase 45's own deferred creative work is in its section above rather than repeated here.

## Media position

250 Higgsfield assets already exist and are catalogued in
[`../../data/higgsfield/asset-manifest.json`](../../data/higgsfield/asset-manifest.json) —
224 images, 26 videos, across 24 subject families. The coverage map and the honest gap table live
in [`../media/HIGGSFIELD_MASTER_ASSET_PLAN.md`](../media/HIGGSFIELD_MASTER_ASSET_PLAN.md).

Phases 10–22 consume that manifest. Phase 43 generates only what the gap table proves is missing.
Regenerating an asset the manifest already holds is a defect.

## Related documents

| Concern | Document |
|---|---|
| The binding contract | [`../architecture/CANONICAL-DECISIONS.md`](../architecture/CANONICAL-DECISIONS.md) |
| System architecture | [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) |
| Database schema | [`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md) |
| Research subsystem | [`../architecture/SCRAPER.md`](../architecture/SCRAPER.md) |
| Product requirements | [`PRD.md`](PRD.md) |
| Enforceable business rules | [`BUSINESS_RULES.md`](BUSINESS_RULES.md) |
| Design system | [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) |
| Studio operator guide | [`../studio/STUDIO_GUIDE.md`](../studio/STUDIO_GUIDE.md) |
| Media and Higgsfield | [`../media/`](../media/) |
| Content standard and inventory | [`../content/`](../content/) |
| Deployment, environment, security, accessibility, performance, testing | [`../ops/`](../ops/) |
