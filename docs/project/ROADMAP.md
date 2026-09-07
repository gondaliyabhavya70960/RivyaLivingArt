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

| # | Phase | Depends on | Document |
|---|---|---|---|
| **00** | Repository Audit & Baseline | None. This is the root phase | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **01** | PRD, Architecture & Documentation | Phase 00 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **02** | Reference UI Audit + Design System | Phases 00, 01 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **03** | Supabase Database + Data Layer | Phases 00, 01 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **04** | Supabase Auth + RBAC + RLS | Phases 00, 01, 03 | [`PHASE-00-04.md`](phases/PHASE-00-04.md) |
| **05** | Studio Foundation | Phase 02, Phase 03, Phase 04 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **06** | Cloudinary Media Architecture | Phase 03, Phase 04, Phase 05 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **07** | Higgsfield Asset Audit + Initial Asset Plan | Phase 05, Phase 06 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **08** | CMS / Editable Content System | Phase 03, 04, 05, 06 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **09** | Initial Website Content Seed | Phase 06, Phase 07, Phase 08 | [`PHASE-05-09.md`](phases/PHASE-05-09.md) |
| **10** | Public Website Foundation | Phases 02, 04, 06, 08, 09 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **11** | Homepage + Material Experience | Phase 10, 08, 09, 07 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **12** | About + Process | Phases 10, 11 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **13** | Large Format Experience | Phases 10, 11, 12 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **14** | Product Catalog | Phases 03, 04, 06, 10, 13 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **15** | Product Detail Experience | Phases 03, 06, 10, 14 | [`PHASE-10-15.md`](phases/PHASE-10-15.md) |
| **16** | Collections / Exhibitions | Phase 08, Phase 09, Phase 10, Phase 14, Phase 06/07 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **17** | Portfolio / Projects | Phase 16, Phase 08, Phase 09, Phase 10, Phase 06 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **18** | Journal | Phase 16, Phase 08, Phase 09, Phase 10, Phase 06/07 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **19** | Bespoke / Custom Configurator | Phase 06, Phase 08, Phase 09, Phase 14/15, Phase 10 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **20** | Inquiry + WhatsApp Flow | Phase 19, Phase 15, Phase 09, Phase 08, Phase 05 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **21** | 3D Product Experience | Phase 06, Phase 15, Phase 19, Phase 02, Phase 16/17 | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **22** | Homepage / Store Merchandising | Phase 14, Phase 16, Phase 15, Phase 08/09, Phase 05… | [`PHASE-16-22.md`](phases/PHASE-16-22.md) |
| **23** | Global Search + Product Relationships | Phase 03, 04, 05, 10, 14, 15, 16, 17, 18, 20 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **24** | Bulk Management | Phase 04, 05, 06, 14, 20, 23 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **25** | Product Scraper Foundation | Phase 03, 04, 05, 23, 24 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **26** | Comparator Source Management | Phase 25, 04, 05, 23, 24 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **27** | Scraper Extraction | Phase 25, 26 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **28** | Normalization + Validation | Phase 26, 27, 14 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **29** | Change Detection + Review | Phase 27, 28, 24, 23 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **30** | Large-Format Research Workspace | Phase 28, 29, 26, 24 | [`PHASE-23-30.md`](phases/PHASE-23-30.md) |
| **31** | Analytics + Comparison | Phase 26, Phase 27, Phase 28, Phase 29, Phase 30… | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **32** | Opportunity Engine | Phase 31, Phase 28, Phase 29, Phase 26, Phase 14 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **33** | Visual Similarity | Phase 27, Phase 28, Phase 31, Phase 06/07, Phase 19 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **34** | Product Direction Tool | Phase 31, Phase 32, Phase 33, Phase 30, Phase 08, Phase 05 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **35** | Shortlist + Confirmation | Phase 28/29, Phase 32, Phase 34, Phase 24, Phase 14… | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **36** | Google Sheets | Phase 31, 32, 34, 35, Phase 20, Phase 19, Phase 04, D8 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **37** | Studio Analytics | Phase 31, Phase 32, Phase 26, Phase 14/16, Phase 17/18… | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **38** | Environment + Documentation + Logs | Phase 04, Phase 05, Phase 06, Phase 25–30, Phase 36, D8 | [`PHASE-31-38.md`](phases/PHASE-31-38.md) |
| **39** | SEO | Phase 08, 09, 10, 14–15, 16–18, 23, 38 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **40** | Performance | Phase 00, 02, 06, 10, 11, 14–18, 19, 21, 23, 37, 39 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **41** | Accessibility + Security | Phase 02, 04, 05, 06, 10, 14–21, 20, 25–30, 38, 40 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **42** | Comprehensive Testing | Phase 00, 03, 04, 06, 09… | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **43** | Media Coverage + Higgsfield Finalization | Phase 06, 07`, `content/media-slots.ts`… | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **44** | Vercel Deployment | Phase 00, 01, 03, 04, 25, 38, 39–43, 41, 42 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **45** | Final Creative Polish | Phase 02, 11–22, 39, 40, 41, 42, 43, 44 | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |
| **46** | Documentation + Handoff | Phase 01, 38, 39–45, 44… | [`PHASE-39-46.md`](phases/PHASE-39-46.md) |

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
