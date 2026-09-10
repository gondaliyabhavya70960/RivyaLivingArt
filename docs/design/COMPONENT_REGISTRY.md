---
doc: COMPONENT_REGISTRY
status: CURRENT
owning_phase: 02
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
---

# COMPONENT REGISTRY — every component, where it came from, and what it costs

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Companion document: `DESIGN_SYSTEM.md` — the tokens and behavioural contracts every row below
> must satisfy. Module boundaries: `docs/architecture/ARCHITECTURE.md`.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (*FEAT §n*) and
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (*SEED §n*).
> Opened by **Phase 02**; every later phase adds its own rows before its first commit.

---

## 1. The rule

**Nothing ships unregistered.**

Every file under `components/primitives/**`, `components/patterns/**`, `components/studio/**` and
`components/three/**`, and every third-party file vendored into `public/**`, has a row in this
registry before the commit that introduces it. `scripts/design/check-registry.mjs` walks exactly
those four directories plus `public/**`, walks this document, and fails the build on any of:

- a component file with no registry entry;
- a registry entry **whose `State` is `BUILT`** pointing at a path that does not exist;
- a full record missing any of the fourteen required fields;
- an external entry whose `Licence` is not on the allowlist in §4 while its `Verdict` is anything
  other than `PENDING_AUDIT` or `REJECTED` — a rejected item ships no code, so its licence is moot;
- a `PENDING_AUDIT` entry whose path exists in the codebase — that is an unlicensed component that
  has already shipped, which is the exact failure this registry exists to prevent.

**A `PLANNED` row is expected to have no file on disk.** Nearly every row in §6 and §7 is `PLANNED`
today, because the phase that owns it has not run; a registry that only accepted rows with code
behind them could not reserve an ID before the code exists, which is what §9 steps 1–4 require it to
do. The path check is **armed by flipping `State` to `BUILT`** (§9 step 7) — the same step that
fills `Reviewed on`, `Reviewer` and the final `Verdict`. What it then catches is the real failure: a
`BUILT` row whose component has been deleted or renamed and whose record is now stale. Wiring the
script into `npm run check` in Phase 02 therefore passes against this document as it stands.

**`components/sections/**` is deliberately outside the walk**, and this is the only place that
exclusion is stated. Block renderers are 1:1 with CMS block types (D2), so the invariant that
matters for them is not "has a registry row" but "exists exactly once for every registered block
type" — which `tests/unit/cms-registry.test.ts` already asserts against the block registry, together
with that type's schema file and its Studio editor. They are catalogued for editors in
`docs/content/CONTENT_GUIDE.md`. Listing them here as well would give one directory two checkers
that can disagree. Every renderer is still bound by `DESIGN_SYSTEM.md`; none may introduce a value
of its own.

This is not administration. FEAT §7 makes the registry the gate on external code, and an unrecorded
licence is a legal exposure that a `git log` cannot answer later.

---

## 2. What needs a full record and what needs an index row

Two tiers, because a fourteen-field record for `VisuallyHidden` would bury the records that matter.

| Tier | Applies to | Where |
|---|---|---|
| **Full record** — all fourteen fields | Anything **externally sourced or vendored**; anything that is a **Client Component**; anything carrying a **keyboard or ARIA contract**; anything with a **measurable bundle cost** | §7 |
| **Index row** — six fields | First-party token-only primitives with no interaction model beyond `:hover`/`:focus-visible` | §6 |

Explicitly **not** registry rows:

- npm packages fixed by D1 (`next`, `react`, `tailwindcss`, `zod`, `three`, `@react-three/fiber`).
  Their versions live in `package-lock.json` and their role in `ARCHITECTURE.md`. A package becomes
  a registry row the moment one of *its* components renders in our UI — see RC-904.
- `components/sections/**` block renderers, for the reason given in full in §1: they are covered
  1:1 by `tests/unit/cms-registry.test.ts` and catalogued in `docs/content/CONTENT_GUIDE.md`.

---

## 3. The column contract

Fourteen fields: the ten required by FEAT §7, plus four governance fields. Field names are exact —
`check-registry.mjs` matches on them.

| # | Field | Content | Allowed values / format |
|---|---|---|---|
| 1 | `Registry ID` | Stable identifier, never reused | `RC-###` |
| 2 | `Source` | Where the component came from | A site name from the §5 approved list, `Rivya first-party`, or a named upstream project |
| 3 | `Link` | Direct URL to the component, or the repository path for first-party work | URL or repo path |
| 4 | `Licence` | SPDX identifier of the source | See §4. `VERIFY_BEFORE_USE` while unverified and `PENDING_AUDIT`; `NOT_VERIFIED — rejected before import` on a `REJECTED` row; `N/A — first-party` for in-house work |
| 5 | `Dependencies` | npm packages the adaptation **adds** | Package names with versions, or `none` (the preferred answer) |
| 6 | `Page` | Where it is used | D3/D4 route paths, or `system` |
| 7 | `Purpose` | Which FEAT §5 justification it serves | `product understanding` · `material understanding` · `brand perception` · `storytelling` · `navigation` · `conversion` · `usability` |
| 8 | `Adaptation` | What changed to fit Rivya tokens | Prose. **A verbatim copy is not accepted** |
| 9 | `Mobile behaviour` | What happens at 360px | Prose, specific |
| 10 | `Performance` | Bundle delta in kB gzipped, and whether it is client-only | `budget ≤ n kB gz, client (unmeasured — PLANNED)` before the build · `+n kB gz, client` after it · `0 kB, server` |
| 11 | `Accessibility` | Keyboard model, ARIA roles, reduced-motion behaviour | Prose, specific |
| 12 | `Reviewed on` | ISO date of the review | `YYYY-MM-DD` or `—` |
| 13 | `Reviewer` | The human who reviewed it | A name, or `UNASSIGNED` |
| 14 | `Verdict` | Outcome | See below |

**Field 10 is a budget until it is a measurement.** While a component's §6 `State` is `PLANNED`
nothing has been built, so no delta can have been measured, and writing one as though it had been
would make the registry's central premise — that these are verified records — false. A `PLANNED` row
therefore states a **ceiling the implementation must come in under**, in the form
`budget ≤ n kB gz, client (unmeasured — PLANNED)`. §9 step 6 replaces it with the measured delta at
the moment `State` flips to `BUILT`; a `BUILT` row still carrying a `budget ≤` figure is an
incomplete record and `check-registry.mjs` treats it as a missing field. `0 kB, server` is neither a
budget nor a measurement: it is the architectural claim that the component ships no client
JavaScript at all, asserted by `scripts/site/check-client-boundary.mjs` and
`scripts/perf/count-islands.mjs` rather than by a bundle diff.

`Verdict` values:

| Value | Meaning |
|---|---|
| `ADOPTED` | External component used essentially as published, licence verified |
| `ADAPTED` | External component rewritten against Rivya tokens, licence verified |
| `REJECTED` | Not used. The row stays so the same component is not re-proposed |
| `FIRST_PARTY` | Written in this repository. No third-party licence applies |
| `PENDING_AUDIT` | Proposed, not yet licence-checked. **May not exist in the codebase** |

`PENDING_AUDIT` and `FIRST_PARTY` extend the three verdicts named in
`docs/project/phases/PHASE-00-04.md` (Phase 02, registry column contract). The extension is
deliberate: without `FIRST_PARTY` the "nothing ships unregistered" rule cannot be expressed for
in-house components, and without `PENDING_AUDIT` a proposal has nowhere to live before its licence
is checked. Recorded here so the divergence is visible rather than silent.

`Reviewer` is seeded `UNASSIGNED` throughout. Naming a reviewer who has not reviewed anything would
be a fabricated record; the field is filled at review time by the person who did the work.

---

## 4. Licence policy

| Licence | Status |
|---|---|
| `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` | Accepted |
| `SIL-OFL-1.1` | Accepted for fonts and font files only |
| Written permission from the author | Accepted, with the permission archived and its location named in `Adaptation` |
| Anything else — including "free to use", "no licence stated", a licence found only in a marketing page, or a component behind a paid plan | **`REJECTED`**, with the reason recorded |

Operating rules:

1. **`VERIFY_BEFORE_USE` is the honest default.** A component whose licence has not been read out
   of the shipped `LICENSE` file (or the repository the code actually comes from) carries
   `VERIFY_BEFORE_USE`, not a guess. A licence badge on a gallery site is not a licence.
2. A `VERIFY_BEFORE_USE` row is only valid while `Verdict` is `PENDING_AUDIT`. The moment the code
   is imported, `Licence` must be a concrete SPDX identifier from the accepted list. A row rejected
   **before** its licence was read carries `NOT_VERIFIED — rejected before import` and states the
   real reason in §8; recording a guessed SPDX identifier for something that will never ship would
   put an unverified claim in the ledger for no benefit.
3. Verification means: open the source repository, read the licence file, record the SPDX
   identifier and the commit or version the code was taken from, and keep any required attribution
   in the adapted file's header.
4. Copying a snippet does not escape this. An adapted component still carries its origin's licence.
5. Anything client-only above **15 kB gzipped** needs a named justification in its `Performance`
   field, per Phase 02's risk register.

---

## 5. Approved research sources (FEAT §7)

The eleven sources the specification approves for research. Audit outcome is recorded for each,
**including rejections**, so a source is not re-litigated every phase.

| Source | URL | Licence | Audit status | Components taken | Reason |
|---|---|---|---|---|---|
| ThreeUI | `https://threeui.com/browse` | `MIT` — verified in `LICENSE` at `MengTo/threeui@main` ("Copyright (c) 2026 Meng To") and in npm `@designcodeio/threeui@1.2.0` `"license": "MIT"`. Covers the Community edition only; the README states Pro source is withheld | `NOT_ADOPTED` | none | Licence is acceptable, the surface is not ours to duplicate. Its subject is procedural WebGL hero canvases, and that surface is already first-party in RC-401 under RC-228's rule that zero viewer JavaScript enters a route bundle and the poster, never the canvas, is the LCP element. A persistently mounted Three.js background contradicts both. The Pro catalogue sits outside the MIT grant, so the collection is not uniformly licensed |
| SmoothUI | `https://smoothui.dev/` | `MIT` — verified in `LICENSE` at `educlopez/smoothui@main` ("Eduardo Calvo", 2024) | `NOT_ADOPTED` | none | A shadcn-style copy-paste registry whose README names Motion as a core technology, so each component arrives with a second animation runtime. RC-207 fixes this repository's motion contract at no animation library, and its `Reveal` already covers the entrance behaviour these components provide |
| Magic UI | `https://magicui.design/` | `MIT` — verified in `LICENSE.md` at `magicuidesign/magicui@main` ("Copyright (c) Magic UI") | `NOT_ADOPTED` | none | Copy-paste animated-effect components, each a Client Component driven by `motion`. The scroll and entrance effects are precisely the WOOD class of `DESIGN_SYSTEM.md` §4.2 that RC-207 implements first-party, with one shared `IntersectionObserver` and a static branch under reduced motion, inside a 1 kB gz budget. Taking them would add a client runtime to reproduce behaviour we already own |
| Unlumen UI | `https://ui.unlumen.com/` | `MIT` for the public registry — verified in `LICENSE` and in `"license": "MIT"` in `package.json` at `leovvx/unlumen-ui-docs@main`; the README limits the grant to "the code and public registry items in this repository" and holds Pro components in a separate private repository | `NOT_ADOPTED` | none | The stack matches on paper — the same `package.json` pins `tailwindcss@^4.1.13`, `react@^19.1.2`, `next@15.5.18` — but it also pins `motion@^12.23.24` **and** `framer-motion@^12.35.1`, two animation runtimes for a system that ships none. Pro slugs additionally require a licence key and fall outside the MIT grant, so the registry cannot be treated as uniformly licensed |
| 21st.dev | `https://21st.dev/` | Platform `MIT` — verified in `LICENSE` at `serafimcloud/21st@main`. Per component: `UNVERIFIED — components are third-party and separately licensed` | `REJECTED` | none | The MIT file covers the marketplace application, not the catalogue. The platform's own terms keep demos, previews and presentation with 21st Labs Inc. while the underlying component code remains separately owned or licensed by its author. There is therefore no source-level licence to record here: each component would need its own author-by-author verification under §4.3, which a single source row cannot stand in for |
| React Bits | `https://reactbits.dev/` | `MIT + Commons Clause License Condition v1.0` — read verbatim from `LICENSE.md` at `DavidHDev/react-bits@main`, "Copyright (c) 2026 David Haz", carrying a "Commons Clause Restriction" section and narrowing the grant to use "as part of an application, website, or product" | `REJECTED` | none | Commons Clause is an added condition, not boilerplate, and the result is not MIT. §4 accepts only MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause and ISC, so this fails the allowlist on its face. Rejected on licence alone, before any technical assessment was made |
| AnimMasterLib | `https://animmasterlib.dev/` | `UNVERIFIED — no repository or npm package found; sold as paid packs` | `REJECTED` | none | The site could not be fetched from this session. Every reachable secondary description agrees it is a commercial product sold as one-time PRO and Premium packs with no public source, and §4 rejects anything behind a paid plan outright. Independently disqualifying: it is vanilla JavaScript driven by GSAP and WebGL rather than React, so it could not compose with Server Components even had the licence cleared |
| Skiper UI | `https://skiper-ui.com/` | `UNVERIFIED — no LICENSE file located; site not fetched` | `REJECTED` | none | There is nothing verifiable to read. The site was unreachable, `registry.npmjs.org/skiper-ui` returns 404, a repository search for `skiper in:name shadcn` returns zero results, and the `skiper-ui` GitHub organisation exposes no searchable public repository. Only third-party summaries describe the terms — a free tier requiring attribution alongside 54+ paid Pro components — and §4 explicitly refuses a licence that exists only on a marketing page |
| Vengence UI | `https://www.vengenceui.com/` | `UNVERIFIED — an MIT file exists in a repository not tied to this domain` | `REJECTED` | none | `Ashutoshx7/VengeanceUI` does carry an MIT `LICENSE` and a README stating the project is released under the MIT License, but that README names no website and never links the audited domain, and search surfaces a differently spelled `vengeanceui` domain alongside it. With the site unreachable the repository-to-domain link is unproven, so the licence of the code this URL actually serves is not established. §4.1 forbids recording a licence on that basis |
| daisyUI | `https://daisyui.com/?lang=en` | `MIT` — verified twice: npm `daisyui@5.7.28` `"license": "MIT"`, and `LICENSE` at `saadeghi/daisyui@master` ("Copyright (c) 2020 Pouya Saadeghi") | `NOT_ADOPTED` | none | The licence is clean; the architecture collides. It is a CSS-only Tailwind plugin that installs a second semantic layer — component classes plus themed palettes carrying colour literals — against `DESIGN_SYSTEM.md` §1, which permits exactly one semantic vocabulary (`--rv-*`) and makes `app/styles/tokens.css` the only file allowed to hold a colour literal; `scripts/design/check-tokens.mjs` fails the build on the rest. Being CSS-only it also supplies none of the APG keyboard and ARIA contracts every §7 record specifies, so it would cost a token system and return no behaviour |
| OriginKit | `https://www.originkit.dev/` | `UNVERIFIED — the CLI is MIT; the component source it downloads is not covered` | `REJECTED` | none | The only verifiable artefacts are wrappers. npm `originkit@0.2.23` declares `"license": "MIT"`, but its own metadata shows it ships a `bin` and fetches component source on demand from a remote registry API. `vellum-ai/originkit` is MIT (Vellum, Inc.) yet is an MCP plugin whose README states it bundles metadata only, no source code, and that the components are created by Originkit. No public repository holds the components — searching the `landerdevelopers` account named in the npm metadata returns only unrelated repositories — and the site could not be fetched. An MIT tool that downloads code does not license the code it downloads |

**Current state of record: no external UI component has been adopted.** Every interactive component
in §6 and §7 is first-party. That is a deliberate starting position, not an oversight — the
behavioural patterns in `DESIGN_SYSTEM.md` §11 are the ones every other component composes from, and
owning their keyboard and focus model outright is cheaper than adapting six different ones.

**Audit performed 2026-09-07 by Claude, Phase 02.** Every one of the eleven URLs above was refused by
this session's egress proxy, so **no source site was fetched and none was observed either to resolve
or to fail** — the failure mode was uniform and on our side of the connection, not theirs, and no row
above claims otherwise. Each licence recorded was therefore read from a reachable primary source
instead: a `LICENSE` file served by `raw.githubusercontent.com` at a named repository and ref, or a
`license` field in `registry.npmjs.org` metadata at a named version. Where neither existed the cell
says exactly that and the outcome is `REJECTED`; no SPDX identifier in this table was inferred from a
sibling project, a badge, or a marketing claim. Five sources — ThreeUI, SmoothUI, Magic UI, Unlumen
UI and daisyUI — hold a verified `MIT` grant and were still not drawn on, for the architectural
reasons stated in their rows; the remaining six cannot clear §4 at all. Two of those verifications are
deliberately partial and must not be read as blanket grants: the ThreeUI and Unlumen UI licence files
cover their free tiers only, with Pro source withheld in both cases. Nothing in §6 or §7 changes as a
result — the first-party position stands, now on evidence rather than by default.

Each source's audit, when it runs, records for the whole source: the licence stated in its
repository, whether components are copy-paste or an npm dependency, whether it ships its own runtime
(a second animation library is a rejection reason on its own), and its accessibility posture. The
outcome replaces `NOT_YET_AUDITED` with one of `ADOPTED`, `ADAPTED`, `REJECTED` or `NOT_ADOPTED` — the four
values `scripts/design/check-registry.mjs` accepts — plus the licence evidence and the reason.

---

## 6. Registry index

`State`: `PLANNED` (owned by a future phase, not yet written — **no file on disk is expected, and
§1's path check is not armed until this flips**) · `BUILT` (exists and is tested) · `REJECTED`
(proposed and declined; the row stays so the same proposal does not return — §8).
All rows are `Source: Rivya first-party`, `Licence: N/A — first-party`, `Verdict: FIRST_PARTY`,
`Dependencies: none` unless a full record in §7 says otherwise.

### 6.1 Primitives — `components/primitives/`

| ID | Component | Purpose (FEAT §5) | Phase | State |
|---|---|---|---|---|
| RC-001 | `Button` | conversion, usability | 02 | BUILT |
| RC-002 | `IconButton` | usability | 02 | BUILT |
| RC-003 | `TextLink` | navigation | 02 | BUILT |
| RC-004 | `Field` | usability | 02 | BUILT |
| RC-005 | `Input` | conversion | 02 | BUILT |
| RC-006 | `Textarea` | conversion | 02 | BUILT |
| RC-007 | `Select` | conversion | 02 | BUILT |
| RC-008 | `Checkbox` | conversion | 02 | BUILT |
| RC-009 | `Radio` | conversion | 02 | BUILT |
| RC-010 | `Switch` | usability | 02 | BUILT |
| RC-011 | `Label` | usability | 02 | BUILT |
| RC-012 | `HelpText` | usability | 02 | BUILT |
| RC-013 | `ErrorText` | usability | 02 | BUILT |
| RC-014 | `Surface` | brand perception | 02 | BUILT |
| RC-015 | `Container` | usability | 02 | BUILT |
| RC-016 | `Section` | storytelling | 02 | BUILT |
| RC-017 | `Stack` | usability | 02 | BUILT |
| RC-018 | `Cluster` | usability | 02 | BUILT |
| RC-019 | `Grid` | usability | 02 | BUILT |
| RC-020 | `Heading` | storytelling | 02 | BUILT |
| RC-021 | `Text` | storytelling | 02 | BUILT |
| RC-022 | `Eyebrow` | brand perception | 02 | BUILT |
| RC-023 | `Divider` | usability | 02 | BUILT |
| RC-024 | `Badge` | usability | 02 | BUILT |
| RC-025 | `Tag` | navigation | 02 | BUILT |
| RC-026 | `Spinner` | usability | 02 | BUILT |
| RC-027 | `Skeleton` | usability | 02 | BUILT |
| RC-028 | `VisuallyHidden` | usability | 02 | BUILT |
| RC-029 | `AspectBox` | material understanding | 02 | BUILT |
| RC-030 | `MediaFrame` | material understanding | 02 | BUILT |
| RC-031 | `FocusTrap` | usability | 02 | BUILT |
| RC-032 | `SkipLink` | navigation | 05 | PLANNED |
| RC-033 | `FileUpload` | conversion | 19 | PLANNED |

Two of these carry more than an index row's worth of contract and have full records in §7 despite
sitting in the primitives table: **RC-033 `FileUpload` (§7.41)** is a Client Component with an
upload state machine, a live region and a per-file remove control, which §2 puts squarely in the
full-record tier. RC-032 `SkipLink` needs no record — it is an anchor that becomes visible on focus,
with its label from `global_content` group `UI_LABEL` (created by `0080`; earlier drafts of this document called it `UI_CHROME`). It is owned by Phase 05 rather than Phase 10
because the Studio shell renders one first (`docs/project/phases/PHASE-05-09.md`, Phase 05 shell)
and Phase 10's site shell then reuses it.

### 6.2 Public patterns — `components/patterns/`

| ID | Component | Purpose | Phase | State | Record |
|---|---|---|---|---|---|
| RC-201 | `Dialog` | usability | 02 | BUILT | §7.1 |
| RC-202 | `Drawer` | usability | 02 | BUILT | §7.2 |
| RC-203 | `Tabs` | usability | 02 | BUILT | §7.3 |
| RC-204 | `Accordion` | usability | 02 | BUILT | §7.4 |
| RC-205 | `Tooltip` | usability | 02 | BUILT | §7.5 |
| RC-206 | `Disclosure` | usability | 02 | BUILT | §7.6 |
| RC-207 | `Reveal` + `useReducedMotion` | brand perception | 02 | BUILT | §7.7 |
| RC-208 | `SiteHeader` | navigation | 10 | BUILT | index only — server, no interaction model |
| RC-209 | `AnnouncementBar` | conversion | 10 | BUILT | index only — server; dismissal is a Server Action, not an island |
| RC-210 | `MegaMenu` | navigation | 10 | BUILT | §7.8 |
| RC-211 | `MobileNav` | navigation | 10 | BUILT | §7.9 |
| RC-212 | `SiteFooter` | navigation | 10 | BUILT | index only — server |
| RC-213 | `MediaSlot` | material understanding | 10 | BUILT | §7.10 — moved from `components/sections/SectionMedia.tsx`, not written anew |
| RC-214 | `HeroMotion` | brand perception | 11 | BUILT | §7.11 |
| RC-215 | `MaterialSequence` | material understanding | 11 | BUILT | §7.12 |
| RC-216 | `ChapterMedia` | storytelling | 12 | BUILT | §7.41 — a Client Component after all, and loaded on demand |
| RC-217 | `ProductCard` | product understanding | 14 | BUILT | §7.13 |
| RC-218 | `CollectionCard` | navigation | 16 | PLANNED | §7.14 |
| RC-219 | `PortfolioCard` | storytelling | 17 | BUILT | §7.15 |
| RC-220 | `ArticleCard` | storytelling | 18 | BUILT | §7.16 |
| RC-221 | `ProductGallery` + `Lightbox` | product understanding | 15 | PLANNED | §7.17 |
| RC-222 | `ContentCarousel` | navigation | 16 | PLANNED | §7.18 |
| RC-223 | `FilterRail` | navigation | 14 | BUILT | §7.19 — renamed from `FilterBar` (public) when built, to stop it reading as a variant of the Studio's `FilterBar`; same ID, same row |
| RC-224 | `SearchCombobox` | navigation | 23 | PLANNED | §7.20 |
| RC-225 | `RelatedContent` | storytelling | 15 | PLANNED | index only — server, composes cards |
| RC-226 | `InquiryLauncher` | conversion | 20 | PLANNED | §7.21 |
| RC-227 | `InquirySuccess` | conversion | 20 | PLANNED | index only — server, SEED §48 copy |
| RC-228 | `ModelViewerMount` | product understanding | 21 | BUILT | §7.22 |
| RC-229 | `charts/*` (`BarSeries`, `BandStrip`, `Scatter`, `Sparkline`) | usability | 31 | PLANNED | §7.23 |
| RC-230 | `Breadcrumbs` | navigation | 02 | BUILT | §7.35 |
| RC-231 | `DropdownMenu` | navigation | 02 | BUILT | §7.36 |
| RC-232 | `MediaImage` | material understanding | 06 | BUILT | §7.37 |
| RC-233 | `MediaVideo` | material understanding | 06 | BUILT | §7.38 |
| RC-234 | `Pagination` | navigation | 14 | BUILT | §7.39 |
| RC-235 | `BlockVideo` | material understanding | 11 | BUILT | index only — server; split out of RC-213 so a route with no video does not carry the `MediaVideo` island |
| RC-236 | `EditorialFallback` | conversion | 11 | BUILT | index only — server; renders a seeded `EMPTY_STATE.*` string where a reference block has nothing real to show. **Phase 22** added `tiles` — heading, line and picture drawn from a section the slot names, a CTA only to `/large-format`, `/collection` or `/custom-commissions`, and no field for a price, a product link, a SKU or a dimension (`lib/cms/editorial-tile.ts`) |
| RC-237 | `SortSelect` | navigation | 14 | BUILT | §7.42 |
| RC-238 | `ProductGallery` (`index`, `Viewer`, `Thumbnails`, `Lightbox`) | product understanding | 15 | BUILT | §7.43 |
| RC-239 | `ProductSpecifications` | product understanding | 15 | BUILT | §7.44 |
| RC-240 | `ProductMaterialStory` | material understanding | 15 | BUILT | §7.45 |
| RC-241 | `ProductInquiryRail` | conversion | 15 | BUILT | §7.46 |
| RC-242 | `RelatedContent` | navigation | 15 | BUILT | §7.47 |
| RC-243 | `MerchandisedRow` | conversion | 22 | BUILT | §7.49 |

`Breadcrumbs` and `DropdownMenu` are Phase 02, not Phase 10. `docs/project/phases/PHASE-00-04.md`
pulls both forward on purpose and requires their rows to be opened in that phase: Phase 05's
`StudioPage` needs a breadcrumb trail and the Studio top bar needs a user menu, and Phase 05 runs
before Phase 10 builds the public chrome — so deferring either means the Studio inventing a second
one, which is the divergence FEAT §6 exists to prevent.

`MediaImage` and `MediaVideo` are the two renderers behind `MediaSlot` (RC-213) and are built in
Phase 06 with the `MediaProvider`. `docs/media/MEDIA_GUIDE.md` §11 routes all four —
`MediaSlot`, `MediaImage`, `MediaVideo`, `HeroMotion` — to this registry, and
`docs/ops/PERFORMANCE.md` §2 gates CI on properties they declare, so neither can be an unregistered
implementation detail of RC-213.

### 6.3 Studio — `components/studio/`

| ID | Component | Purpose | Phase | State | Record |
|---|---|---|---|---|---|
| RC-301 | `StudioPage` | usability | 05 | PLANNED | index only |
| RC-302 | `PageHeader` | usability | 05 | PLANNED | index only |
| RC-303 | `Toolbar` | usability | 05 | PLANNED | index only |
| RC-304 | `DataTable` | usability | 05 | PLANNED | §7.24 |
| RC-305 | `FilterBar` (Studio) | usability | 05 | PLANNED | index only — URL-synced, composes RC-007/RC-008 |
| RC-306 | `StatCard` | usability | 05 | PLANNED | §7.25 |
| RC-307 | `StatusPill` | usability | 05 | PLANNED | index only |
| RC-308 | `EmptyState` | usability | 05 | PLANNED | index only |
| RC-309 | `ConfirmDialog` | usability | 05 | PLANNED | §7.26 |
| RC-310 | `DrawerForm` + `FormField` | usability | 05 | PLANNED | index only — composes RC-202/RC-004 |
| RC-311 | `PermissionGate` | usability | 05 | PLANNED | index only |
| RC-312 | `RelativeTime` | usability | 05 | PLANNED | index only |
| RC-313 | `ActorChip` | usability | 05 | PLANNED | index only |
| RC-314 | `CommandPalette` | navigation | 05 | PLANNED | §7.27 |
| RC-315 | `ModelInspectorDrawer` | product understanding | 21 | PLANNED | index only — composes RC-202/RC-304 |
| RC-316 | `CoverageBadge` | usability | 31 | PLANNED | index only |
| RC-317 | `ToastRegion` + `Toast` | usability | 05 | PLANNED | §7.40 |

### 6.4 Three — `components/three/`

| ID | Component | Purpose | Phase | State | Record |
|---|---|---|---|---|---|
| RC-401 | `ModelViewer` | product understanding | 21 | BUILT | §7.28 |
| RC-402 | `ViewerControls` | product understanding | 21 | PLANNED | index only — composes RC-002 |

### 6.5 Third-party and vendored

| ID | Item | Source | Phase | State | Record |
|---|---|---|---|---|---|
| RC-901 | Newsreader (display font) | Google Fonts / Production Type | 02 | PLANNED | §7.29 |
| RC-902 | Inter (body font) | Google Fonts / rsms | 02 | PLANNED | §7.30 |
| RC-903 | IBM Plex Mono (technical font) | Google Fonts / IBM | 02 | **REJECTED** | §7.31, §8 |
| RC-904 | `@react-three/drei` controls | pmndrs | 21 | BUILT | §7.32 |
| RC-905 | Draco decoder, vendored to `public/draco/**` | google/draco via three.js | 21 | BUILT | §7.33 |
| RC-906 | KTX2 / Basis transcoder, vendored to `public/basis/**` | BinomialLLC via three.js | 21 | BUILT | §7.34 |
| RC-907 | meshopt decoder, bundled from `meshoptimizer` | zeux/meshoptimizer | 21 | BUILT | §7.48 |

### 6.6 Rows a later phase owes

Component files already named by path in another document, whose phase has not opened its row yet.
They are listed so the omission is visible rather than silent; each row is added by the phase named,
before its first commit, exactly as §9 requires. This list is not a reservation — the IDs are taken
at that point, from the next free number.

| Component file | Owning phase | Named in |
|---|---|---|
| `components/patterns/Configurator/{index,Step,Progress,ReferenceUpload,Review}.tsx` | 19 | `docs/project/phases/PHASE-16-22.md`, Phase 19 deliverables |

`ReferenceUpload.tsx` composes RC-033 `FileUpload`; it does not reimplement a file input.

---

## 7. Full records

Every entry carries all fourteen fields of §3. `Reviewed on` and `Reviewer` are filled at review
time; `—` and `UNASSIGNED` mean the review has not happened, not that it passed.

### 7.1 RC-201 — `Dialog`

| Field | Value |
|---|---|
| Registry ID | RC-201 |
| Source | Rivya first-party (behaviour follows the W3C ARIA APG modal dialog pattern) |
| Link | `components/patterns/Dialog/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | system |
| Purpose | usability |
| Adaptation | Built against `DESIGN_SYSTEM.md` §11 tokens; elevation level 3, scheme-inherited, `--rv-radius-lg` |
| Mobile behaviour | At 360px it becomes a bottom sheet occupying up to 90vh with the safe-area inset respected; content scrolls inside, the header stays fixed |
| Performance | budget ≤ 2 kB gz, client (unmeasured — PLANNED) |
| Accessibility | `role="dialog"` `aria-modal="true"`, labelled by its heading; focus moved in on open, trapped by RC-031, restored to the trigger on close; `Escape` closes; background `inert`; scroll locked with scrollbar-width compensation; FORM motion, static under reduced motion |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.2 RC-202 — `Drawer`

| Field | Value |
|---|---|
| Registry ID | RC-202 |
| Source | Rivya first-party (APG dialog pattern, edge-anchored) |
| Link | `components/patterns/Drawer/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | system |
| Purpose | usability |
| Adaptation | Shares RC-201's focus and scroll-lock implementation; differs only in placement and transform axis |
| Mobile behaviour | Full width below 430px, 420px above; bottom-anchored variant for filter sheets so the thumb reaches the apply button |
| Performance | budget ≤ 1 kB gz over RC-201, client (unmeasured — PLANNED) |
| Accessibility | Same contract as RC-201; `aria-label` from `global_content`; swipe-to-dismiss on touch is an addition to, never a replacement for, the close button |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.3 RC-203 — `Tabs`

| Field | Value |
|---|---|
| Registry ID | RC-203 |
| Source | Rivya first-party (APG tabs pattern) |
| Link | `components/patterns/Tabs/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/product/[slug]`, `/studio/**` |
| Purpose | usability |
| Adaptation | Underline indicator in `--rv-ink-accent` at `--rv-border-emphasis`; panel swap at `--rv-duration-instant`, indicator slides at 180ms |
| Mobile behaviour | The tab list scrolls horizontally with snap and edge fades; the selected tab scrolls itself into view on change |
| Performance | budget ≤ 1.5 kB gz, client (unmeasured — PLANNED) |
| Accessibility | `role="tablist"`/`tab`/`tabpanel`, roving tabindex, `aria-selected`, `aria-controls`; arrow keys move and activate, `Home`/`End` jump; panels are `tabindex="-1"`; indicator does not slide under reduced motion |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.4 RC-204 — `Accordion`

| Field | Value |
|---|---|
| Registry ID | RC-204 |
| Source | Rivya first-party (APG accordion pattern) |
| Link | `components/patterns/Accordion/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/faq`, `/custom-commissions`, `/studio/**` |
| Purpose | usability |
| Adaptation | Height animated via `grid-template-rows: 0fr → 1fr`; no JavaScript measurement, so no layout thrash and no CLS |
| Mobile behaviour | Headers are ≥ 56px tall; the whole header row is the hit box; single-open mode is the default below 768px to keep the list scannable |
| Performance | budget ≤ 1 kB gz, client (unmeasured — PLANNED) |
| Accessibility | Headers are `<button>` inside the heading level the block declares, `aria-expanded` + `aria-controls`; focus stays on the header after toggling; FAQ content renders in the DOM regardless of open state so it is findable by browser search |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.5 RC-205 — `Tooltip`

| Field | Value |
|---|---|
| Registry ID | RC-205 |
| Source | Rivya first-party (APG tooltip pattern) |
| Link | `components/patterns/Tooltip/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/studio/**` |
| Purpose | usability |
| Adaptation | Elevation 2; 400ms hover delay, 0ms on focus; 100ms grace so the pointer can travel onto it |
| Mobile behaviour | **Not used on touch.** Below 768px the same text renders as persistent `HelpText`. A tooltip that only opens on hover is unreachable on a phone |
| Performance | budget ≤ 1.5 kB gz, client (unmeasured — PLANNED) |
| Accessibility | `role="tooltip"` referenced by `aria-describedby`; `Escape` dismisses; never focusable; never the sole carrier of information; contains no interactive element |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.6 RC-206 — `Disclosure`

| Field | Value |
|---|---|
| Registry ID | RC-206 |
| Source | Rivya first-party (APG disclosure pattern) |
| Link | `components/patterns/Disclosure/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | system |
| Purpose | usability |
| Adaptation | The single-region form of RC-204; used by the footer, the filter rail and the mobile nav's category list |
| Mobile behaviour | Footer columns collapse to disclosures below 768px with the contact column open by default |
| Performance | budget ≤ 0.5 kB gz, client (unmeasured — PLANNED) |
| Accessibility | `<button aria-expanded aria-controls>` + region; focus stays on the trigger; FORM motion, instant under reduced motion |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.7 RC-207 — `Reveal` + `useReducedMotion`

| Field | Value |
|---|---|
| Registry ID | RC-207 |
| Source | Rivya first-party |
| Link | `components/primitives/motion/{Reveal.tsx,useReducedMotion.ts}` |
| Licence | N/A — first-party |
| Dependencies | none — no animation library is introduced |
| Page | system |
| Purpose | brand perception |
| Adaptation | Implements the WOOD class of `DESIGN_SYSTEM.md` §4.2: opacity + `--rv-motion-rise-md`, `--rv-duration-slow`, `--rv-ease-out`, 60ms stagger capped at six items |
| Mobile behaviour | Identical; travel does not scale with viewport. Under `saveData` the static branch is used |
| Performance | budget ≤ 1 kB gz, client (unmeasured — PLANNED). One shared `IntersectionObserver` per page, not one per element |
| Accessibility | Children are server-rendered, laid out and readable before any observer attaches — motion changes opacity, it never gates content. `useReducedMotion` is the single `matchMedia` source in the repository; when it returns true no observer is attached and children render final. Asserted by `tests/e2e/a11y/reduced-motion.spec.ts` |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.8 RC-210 — `MegaMenu`

| Field | Value |
|---|---|
| Registry ID | RC-210 |
| Source | Rivya first-party |
| Link | `components/patterns/MegaMenu/index.tsx` — **one file, not two.** The planned `MegaMenuPanel.tsx` was not built: the panel's contents are server-rendered by `SiteHeader` and passed as `children`, which is what lets the category cards use `MediaImage` (a Server Component) inside a panel whose open state is client state. A second client file would have had to receive that markup and pass it straight through |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | all D3 public paths (site header) |
| Purpose | navigation |
| Adaptation | Panel content comes from `navigation_items` and `categories.hero_media_id`; no label is hard-coded (SEED §1). Elevation 2, `--rv-radius-lg` |
| Mobile behaviour | The trigger and panel are `hidden lg:block`; below 1024px RC-211 carries the same items as a nested list, so there is no hover-only route to any category. The panel stays in the DOM at every width — `hidden`, not unmounted — so its server-rendered contents cost no request when it opens |
| Performance | budget ≤ 3 kB gz, client (unmeasured — PLANNED). The trigger and the header around it stay server-rendered |
| Accessibility | `aria-expanded` and `aria-controls` on the trigger; the panel is a `<nav>` with `aria-label` from `UI_LABEL.nav.categories` — **not `aria-labelledby` on a div**, which would name nothing, since `aria-label` applies to a landmark and a bare `div` is not one. `ArrowDown` enters, `Tab` traverses in DOM order and exits naturally, `Escape` closes and restores focus. **No focus trap** — a menu is not a dialog. 120 ms hover-intent delay on a fine pointer only; touch and keyboard open on activation. Proved by `tests/e2e/navigation-a11y.spec.ts` at all eight widths |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.9 RC-211 — `MobileNav`

| Field | Value |
|---|---|
| Registry ID | RC-211 |
| Source | Rivya first-party |
| Link | `components/patterns/MobileNav/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | all D3 public paths |
| Purpose | navigation |
| Adaptation | Composes RC-202. Takes its items as plain `MenuItem[]` data rather than as `children`, unlike RC-210 — nothing in the drawer is a Server Component, so the serialised tree crosses the boundary and the drawer can render the two-level structure itself. The rows are `menu = 'MOBILE'` rows, not the header's: Phase 09 seeded them separately so a shorter mobile menu is an edit rather than a deploy |
| Mobile behaviour | Full-width below 430px, 420px above; primary CTA pinned above the safe-area inset; nested categories are a disclosure, never a second drawer |
| Performance | budget ≤ 1 kB gz over RC-202, client (unmeasured — PLANNED) |
| Accessibility | Inherits RC-202's dialog contract — `role="dialog"`, focus trapped, `Escape` closes, focus restored to the trigger via `returnFocusTo`. The trigger carries `aria-expanded` and an `aria-label` from `ACTION_LABEL.open_menu`. Its heading is `titleHidden`: a visible "Menu" above a list of destinations is a caption on a caption, and dropping it entirely would leave an `aria-modal` dialog named nothing. Clicking a link closes the drawer |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.10 RC-213 — `MediaSlot`

| Field | Value |
|---|---|
| Registry ID | RC-213 |
| Source | Rivya first-party |
| Link | `components/patterns/MediaSlot/index.tsx` — exports `BlockImage` and `ResponsiveMedia`. `BlockVideo` moved OUT in Phase 11 to RC-235 and the reason was measured rather than tidy: this module is a Server Component that nearly every section renderer imports, and its import of `MediaVideo` (a Client Component) pulled that island into the client bundle of every route with any section at all, whether or not a video was ever rendered. It arrived in Phase 08 as `components/sections/SectionMedia.tsx` and MOVED here in Phase 10 rather than being written a second time: the header's category cards need exactly this behaviour, and two ratio-box implementations are how two components come to disagree about what happens when an asset is null |
| Licence | N/A — first-party |
| Dependencies | none — Cloudinary URLs are built by `lib/media`, no SDK reaches the client |
| Page | every route rendering media |
| Purpose | material understanding |
| Adaptation | Reserves the D6 aspect box before load and applies `--rv-media-veil` when text sits over media. **Two elements, not one `<picture>`:** the desktop and mobile assets are different crops of different subjects chosen by an editor (`media_desktop_id` and `media_mobile_id` are separate columns for that reason) and each carries its own `alt_text`, while `<picture>` has one `alt` for all its sources. Each frame is hidden at the other's breakpoint (`md`, matching `AspectBox`'s own split) so the reserved box and the asset change over at the same width |
| Mobile behaviour | Mobile is a separate CMS slot per D6, not a crop of the desktop asset. Portrait ratios (4:5, 9:16, 3:4) at 360px |
| Performance | 0 kB, server. Emits an AVIF/WebP `srcset` ladder; the hero instance is `priority`, everything else lazy |
| Accessibility | `alt` from `media_assets.alt_text`; `alt=""` only when `is_decorative` is true, never by omission. On failure it paints `--rv-surface-sunken` with the seeded SEED §47 label at the reserved ratio, so nothing collapses and CLS stays inside the 0.05 budget |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.11 RC-214 — `HeroMotion`

| Field | Value |
|---|---|
| Registry ID | RC-214 |
| Source | Rivya first-party |
| Link | `components/patterns/HeroMotion/index.tsx` — a directory, like every other pattern in this table; the flat path this row carried was written before Phase 10 settled the convention |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/`, `/large-format`, `/about` |
| Purpose | brand perception |
| Adaptation | Mounts **after** the still has painted (`useAfterPaint`, two animation frames), so the LCP element is always the image. It renders nothing or a clip that is already playing — never a poster and never a play control, because `MediaVideo`'s own refusal would put a third button on top of the hero's two calls to action. NO PARALLAX WAS BUILT: the planned row named `--rv-motion-parallax-max`, and a scroll-coupled transform on the largest element of the page is a repaint per frame for decoration — the phase's budget names LCP, CLS and INP, and parallax spends all three |
| Mobile behaviour | The motion layer does not mount below 768px. The still is the whole experience, and it is a complete one |
| Performance | One of the homepage's five islands (`scripts/site/check-island-budget.mjs`). It imports `MediaVideo`, which is therefore inside this island's bundle rather than a boundary of its own. Nothing is fetched until every gate passes; the video is `preload="none"` and its poster is the still already on screen |
| Accessibility | Muted, inline, loop, no controls, and the layer is `aria-hidden` — the still beneath it carries the section's alt text and announcing both would read the hero's picture twice. Under `prefers-reduced-motion: reduce`, `saveData`, `deviceMemory < 4`, below 768px, or for a clip whose duration is unknown, **no `<video>` element mounts at all** and the still stands alone. Asserted by `tests/unit/hero-motion.test.tsx`, one gate per case |
| Reviewed on | Phase 11 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.12 RC-215 — `MaterialSequence`

| Field | Value |
|---|---|
| Registry ID | RC-215 |
| Source | Rivya first-party |
| Link | `components/patterns/MaterialSequence/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/`, `/process` |
| Purpose | material understanding, storytelling |
| Adaptation | The stages are server-rendered and passed in as `children`; this component writes one attribute, `data-active`, on whichever stage is crossing a 10%-tall band across the middle of the viewport. It **observes** scroll; it never captures it. No pinning, no scroll-jacking, no `preventDefault` on wheel. On `/` the stages are the LIQUID → FORM → CRAFT → OBJECT sequence of SEED §10-05; FEAT §4's longer WOOD → … → ART progression belongs to `/process`, which Phase 12 builds |
| Mobile behaviour | The stages are a single column at every width; the observer runs at all of them, because marking the stage in view costs nothing and is as useful on a phone as on a desktop. What it never does is move the page |
| Performance | One `IntersectionObserver` for all four stages, not one each. One of the homepage's five islands. It renders no media of its own — the pictures are Server Components passed through as children |
| Accessibility | Every stage's content is in the DOM and reachable by `Tab` in both branches; under reduced motion no observer attaches and any `data-active` left behind is removed. The dimming is written as `data-[active=false]`, which matches nothing until the island runs — so an unenhanced page renders every stage at full strength. Asserted by `tests/unit/material-sequence.test.tsx` |
| Reviewed on | Phase 11 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.13 RC-217 — `ProductCard`

| Field | Value |
|---|---|
| Registry ID | RC-217 |
| Source | Rivya first-party |
| Link | `components/patterns/ProductCard/index.tsx` — a directory, like every other pattern in this table; the flat path this row carried was written before Phase 10 settled the convention |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/collection`, `/collection/[category]`, `/collections/[slug]`, `/search`, related-content rails |
| Purpose | product understanding, conversion |
| Adaptation | `DESIGN_SYSTEM.md` §9 anatomy at 4:5; hover is a 1.015 media scale only — no lift, no shadow, no rotation. **It is not a link in Phase 14**, and that is the phase boundary rather than an omission: `/product/[slug]` is Phase 15, so an anchor here would put a 404 behind every card in the grid — the dead door `resolveInternalTarget` exists to refuse. Phase 15 adds the heading anchor and the `::after` overlay described under Accessibility |
| Mobile behaviour | Single full-width column at 360px; the badge row wraps to a second line rather than truncating a label |
| Performance | 0 kB, server component. The grid ships no client JavaScript |
| Accessibility | Renders as an `<article>` while it has no destination; the heading is the card's name and no "read more" link exists. Badges are text, not colour-only (RC via `Badge`, whose word is required). The price label and the amount are separate nodes, so a quote-only card announces a label with no number after it. From Phase 15 the title becomes the accessible name via a heading anchor with a `::after` overlay, and the focus ring renders on the card outline rather than the image |
| Reviewed on | Phase 14 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Content constraint (D10, SEED §32).** The card renders a price **label** from `global_content`
(`From`, `Starting from`, `Price on Request`, `Request a Quote`) and a number only when the record
carries one. It never computes, estimates or formats a value the record does not have, never renders
`0` for a quote-only product, and carries no invented "New" or "Bestseller" badge.

### 7.14 RC-218 — `CollectionCard`

| Field | Value |
|---|---|
| Registry ID | RC-218 |
| Source | Rivya first-party |
| Link | `components/patterns/CollectionCard.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/collection`, `/`, mega-menu feature slot |
| Purpose | navigation, brand perception |
| Adaptation | 3:4 desktop / 4:5 mobile, taller than RC-217 so a collection reads as an exhibition rather than a product (FEAT §8) |
| Mobile behaviour | Full width, 4:5, statement line clamped to two lines with the full text still in the DOM |
| Performance | 0 kB, server |
| Accessibility | Item count is rendered as text, and omitted rather than shown as `0`; a collection with no bound media renders a text-only card, never a borrowed image |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Content constraint (FEAT §9).** Seeded collection concepts exist as `DRAFT_COLLECTION_CONCEPT`
until the owner confirms them. The public card renders only published collections; the concept badge
is a Studio-only affordance.

### 7.15 RC-219 — `PortfolioCard`

| Field | Value |
|---|---|
| Registry ID | RC-219 |
| Source | Rivya first-party |
| Link | `components/patterns/PortfolioCard/index.tsx` — a directory, following the convention Phase 10 settled; the flat path this row carried was written before it |
| Licence | N/A — first-party |
| Dependencies | RC-213 `MediaSlot` (`BlockImage`), RC-019 `Grid` |
| Page | `/portfolio`, `/`, `/collections/[slug]`, related content |
| Purpose | storytelling, brand perception |
| Adaptation | 3:2 at every width — landscape reads as a documented project rather than a catalogue item |
| Mobile behaviour | Full width, 3:2 retained |
| Performance | 0 kB, server |
| Accessibility | Project type is a text eyebrow, not a colour-coded chip |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Content constraint (D10).** The card renders a picture, a project type, a title and a summary —
and NOTHING ELSE. No date, no client, no location, no scope. An earlier version of this row said
those "render only from stored fields", which was a discipline; as built it is a shape: `EntityCard`
does not carry them, so this component could not render one if somebody wanted it to. Two of them
belong to other people — a client's name is publishable only where their consent is recorded as
granted (BR-D5), and a card has no way to know that. The portfolio grid ships **empty by default**
with the seeded SEED §28 empty state; no delivered project, named customer or testimonial is
invented to populate it. `OWNER_VERIFICATION_REQUIRED` applies to every project record until the
owner confirms it.

**Built in Phase 17, replacing `components/sections/ReferenceCards.tsx` for projects only.**
`ReferenceCards` was written in Phase 11 as an explicit placeholder — its own header says the three
entity phases replace it one at a time, as each gains the real data and learns what a card of that
entity should say. Phase 17 is the first of those three; `data-product-card` and `data-article-card`
still come from `ReferenceCards` until Phases 22 and 18 respectively.

**What changed in replacing it.** `ReferenceCards` crops to 4:5 on a phone. A project photograph is
a room, a wall or an installation, and a portrait crop cuts away the space that makes it a project
rather than a piece of furniture — so RC-219 holds 3:2 at every width, which is the one thing in
this row that is not negotiable per breakpoint.

**The eyebrow needed one column.** `project_type` is read by `listReferenceProjects` and carried on
`EntityCard.eyebrow`, which is optional and populated for projects alone. `ReferenceRow` therefore
grew a single optional eyebrow slot rather than an open select list: a project may have a type, and
a product still cannot acquire a price.

**The grid ships with the card.** `PortfolioCardGrid` is exported from the same module because the
column rhythm is part of what a project card is — three across at desktop, two at tablet, one on a
phone. A section free to lay these out itself is free to put four across, and four landscape cards
in a row are thumbnails.

### 7.16 RC-220 — `ArticleCard`

**BUILT AS `ArticleCard`, NOT `JournalCard`.** The row reserved the second name; the component is
named for what it renders — one article — rather than for the section it appears in, which is how
`ProductCard` and `PortfolioCard` are named. Same ID, same row, following the precedent RC-223
records for `FilterRail`.

| Field | Value |
|---|---|
| Registry ID | RC-220 |
| Source | Rivya first-party |
| Link | `components/patterns/ArticleCard/index.tsx` — a directory, following the convention Phase 10 settled |
| Licence | N/A — first-party |
| Dependencies | RC-213 `MediaSlot` (`BlockImage`), RC-019 `Grid` |
| Page | `/journal`, `/journal/category/[slug]`, `/`, related content |
| Purpose | storytelling |
| Adaptation | 16:9; the only card that switches to a horizontal 96px-media layout at 360px, because a list of articles is read, not browsed |
| Mobile behaviour | Horizontal at 360px: 96px media, title clamped to three lines, meta on one line |
| Performance | 0 kB, server |
| Accessibility | Date rendered in a `<time datetime>`; reading time is an estimate and is labelled as one |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**The horizontal switch is the reason this card is not `ProductCard` with a different ratio.** A
product or a project is BROWSED — the eye moves across a grid of images. A list of articles is READ:
the title is what is being scanned, and a stack of full-width 16:9 images pushes three titles below
the fold that a horizontal row keeps on it. Below 640px the card becomes 96px of media beside the
text, with the title clamped to three lines and the card line hidden.

**The date is formatted in a fixed UTC zone.** A date rendered in the visitor's zone differs between
the server and the browser, which React reports as a hydration mismatch and a reader sees as the
date changing after the page loads. When an article was published is a fact about the studio's day,
not about the reader's.

**Reading time is omitted when null, never shown as "1 min read".** `reading_minutes` is derived by
a trigger from the article's own blocks; an article with no body has NULL, and a card that filled
that with "1 min" would describe a body that does not exist. The string itself is a seeded sentence
with `{{minutes}}` in it, so it can be reworded or reordered without a code change.

**No author name on the card.** `byline` defaults to the organisation, and printing "Rivya Living
Art" under every title on a page that is entirely Rivya's is noise. The article page renders it.

**`ArticleCardGrid` ships in the same module**, for the reason RC-219's grid does: the column rhythm
is part of what the card is, and a section free to lay these out itself is free to put four across.

### 7.17 RC-221 — `ProductGallery` + `Lightbox`

| Field | Value |
|---|---|
| Registry ID | RC-221 |
| Source | Rivya first-party |
| Link | `components/patterns/ProductGallery/{index.tsx,Lightbox.tsx,Thumbnails.tsx}` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/product/[slug]`, `/portfolio/[slug]` |
| Purpose | product understanding, material understanding |
| Adaptation | Stills are server-rendered; only the lightbox is a client component. Lightbox forces the `INK` scheme regardless of the section's scheme. RESIN crossfade between images, ART on open |
| Mobile behaviour | Single-column scroll-snap strip with a counter; tap opens the lightbox full-screen; pinch and double-tap zoom |
| Performance | budget ≤ 5 kB gz, client (unmeasured — PLANNED), and only for the lightbox. Within the `/product/[slug]` 190 kB first-load budget |
| Accessibility | Thumbnails are a roving-tabindex list of buttons, `Enter` opens; the lightbox is `role="dialog"` `aria-modal` labelled by the current alt text, focus trapped and restored to the originating thumbnail; `Escape`/arrows/`Home`/`End`; `n of m` counter is `aria-live="polite"`; instant swaps under reduced motion; **never auto-advances** |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.18 RC-222 — `ContentCarousel`

| Field | Value |
|---|---|
| Registry ID | RC-222 |
| Source | Rivya first-party |
| Link | `components/patterns/ContentCarousel/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none — CSS scroll-snap, no carousel library |
| Page | `/`, `/collections/[slug]`, `/portfolio`, `/journal`, related-content rails |
| Purpose | navigation |
| Adaptation | A scrollable list, not a transform track: the DOM is complete, crawlable and printable. Controls are progressive enhancement |
| Mobile behaviour | Free scroll with snap and a one-and-a-peek offset so a second card edge shows the list continues; no arrows below 768px |
| Performance | budget ≤ 1.5 kB gz, client (unmeasured — PLANNED) — controls and the disabled-state observer only |
| Accessibility | `role="group"` `aria-roledescription="carousel"`, items labelled `n of m`; the scroller is focusable with arrow-key movement; each item's own link is separately tabbable; auto-advance is off by default and, where a block enables it, pauses on hover/focus/`document.hidden`, exposes a pause control first, and never runs under reduced motion (WCAG 2.2.2) |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.19 RC-223 — `FilterRail`

| Field | Value |
|---|---|
| Registry ID | RC-223 |
| Source | Rivya first-party |
| Link | `components/patterns/FilterRail/index.tsx` — planned as `FilterBar` (public). Renamed when built: the Studio already has `components/studio/FilterBar.tsx`, and two components one word apart, one of them a Client Component, is how the wrong one gets imported |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/collection`, `/collection/[category]`, `/search` |
| Purpose | navigation, product understanding |
| Adaptation | A `<form method="get">` and nothing else. The URL is the state; there is no client filter store, no fetch and no router push. Facets and their counts come from `lib/catalog/rail.ts`, computed from the same query as the rows, never from a hard-coded list. **Zero-count options are HIDDEN, not disabled** — this row planned the opposite, and the Phase 14 scope overrules it: a disabled option still tells a visitor the value exists and is worth wanting, and a rail that narrows to what actually matches is the honest shape. An ACTIVE value always renders, whatever its count, so a filter that matched nothing can still be cleared |
| Mobile behaviour | A single stacked column above the grid at 360px, with the submit button and Clear Filters at its foot. **The planned bottom-anchored drawer was not built**: a drawer opened by a button is a Client Component, and the phase requires the rail to filter with JavaScript disabled. A no-JS disclosure (`<details>`) would satisfy both and is the obvious Phase 41 revision; a control that exists but cannot be opened is not |
| Performance | 0 kB, server component — the budget this row carried (≤ 2.5 kB gz, client) is not spent, because nothing about a GET form needs to hydrate |
| Accessibility | The form is labelled by its own heading; each dimension is a `<fieldset>` with a `<legend>`, so a screen reader announces "Material, group" before its checkboxes. Each count sits INSIDE its checkbox's label, so it is announced with the option rather than orphaned beside it. Clear Filters is a link, not a button, because it navigates. **No `aria-live` result count exists**: the results are a full page navigation rather than an in-place update, so the new page's own heading and content are what a screen reader reads — a live region would announce a count for a page that has already been replaced. The "Skip to filters" link remains Phase 41's |
| Reviewed on | Phase 14 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.20 RC-224 — `SearchCombobox`

| Field | Value |
|---|---|
| Registry ID | RC-224 |
| Source | Rivya first-party (APG combobox pattern) |
| Link | `components/patterns/SearchCombobox/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/search`, site header |
| Purpose | navigation |
| Adaptation | Grouped suggestions by entity type (SEED §19); matched substring in `--rv-ink-accent` at weight 500 so the cue is not colour alone |
| Mobile behaviour | Opens as a full-screen sheet with the keyboard raised; results scroll under a fixed input; 44px result rows |
| Performance | budget ≤ 3 kB gz, client (unmeasured — PLANNED). 200ms debounce, in-flight requests aborted |
| Accessibility | `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant` over a `role="listbox"`; arrows move across groups, `Enter` opens, `Escape` clears then closes; "n results" announced once per settled query; the seeded SEED §26 empty state, never a bare "No results" |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Constraint (FEAT §19).** Public search never returns `research_*` data. No research identifier
appears anywhere in the public bundle; `scripts/site/check-client-boundary.mjs` enforces it.

### 7.21 RC-226 — `InquiryLauncher`

| Field | Value |
|---|---|
| Registry ID | RC-226 |
| Source | Rivya first-party |
| Link | `components/patterns/InquiryLauncher/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/product/[slug]`, `/collections/[slug]`, `/custom-commissions`, `/contact` |
| Purpose | conversion |
| Adaptation | Opens RC-202 containing the inquiry form; on success renders the SEED §48 surface with the WhatsApp continue action |
| Mobile behaviour | Bottom sheet; the submit row is sticky above the safe-area inset; the form is single-column throughout |
| Performance | budget ≤ 4 kB gz, client (unmeasured — PLANNED), loaded on interaction — not in the initial route bundle |
| Accessibility | Inherits RC-202's dialog contract; `aria-busy` while saving; the save error is `role="alert"`; the success heading receives focus |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Business-rule constraint (D1).** There is no state in which this component navigates to WhatsApp
without a persisted `inquiryId` — `buildHandoffUrl` cannot be called without one. No checkout, no
payment field, no account creation exists in it or anywhere near it.

### 7.22 RC-228 — `ModelViewerMount`

| Field | Value |
|---|---|
| Registry ID | RC-228 |
| Source | Rivya first-party |
| Link | `components/patterns/ModelViewerMount/lazy.tsx` (the `next/dynamic` boundary routes import, so the mount's client half is an on-demand chunk and not a homepage island) + `index.tsx` (server: the poster and the copy) + `Island.tsx` (client: the probe, the intent gate and the boundary in front of the engine) |
| Licence | N/A — first-party |
| Dependencies | none of its own; it is the `next/dynamic` boundary in front of RC-401 |
| Page | `/product/[slug]` (below the gallery), `/collections/[slug]` (the `three-d-resin` block's slot), `/portfolio/[slug]` (after the story), `/collection/3d-resin` (below the grid) |
| Purpose | product understanding |
| Adaptation | The server renders the poster as a `BlockImage` with a real srcset; the island runs the FEAT §14 probe (`lib/media/viewer-settings.ts`), shows the "Inspect in 3D" control only when the browser has answered and is not declined, and imports RC-401 with `ssr: false` on a press or on an intersection the probe allows |
| Mobile behaviour | Below 768px the viewer is opt-in only and opens fullscreen; the poster alone is the default experience |
| Performance | **0 bytes of viewer JavaScript in the route bundle**, asserted statically by `scripts/perf/check-bundle.mjs` on every route's client graph and on the wire by `tests/e2e/model-performance.spec.ts`. The poster, never the canvas, is the LCP element |
| Accessibility | The trigger is a real button with an accessible name from `global_content`; loading progress is `aria-live="polite"` at 0/50/100; on failure the poster stays with a stated reason; nothing 3D is requested when the `three_d_viewer` flag is off, and the mount renders nothing at all in that case |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 21 session — `tests/unit/model-mount.test.tsx`, `tests/unit/model-policy.test.ts` |
| Verdict | FIRST_PARTY |

### 7.23 RC-229 — `charts/*`

| Field | Value |
|---|---|
| Registry ID | RC-229 |
| Source | Rivya first-party |
| Link | `components/patterns/charts/{BarSeries,BandStrip,Scatter,Sparkline}.tsx` |
| Licence | N/A — first-party |
| Dependencies | none — inline SVG. **Any proposal to add a chart library needs its own row and a bundle-delta justification** |
| Page | `/studio/**` only |
| Purpose | usability |
| Adaptation | Token-driven SVG; categorical ramp `sapphire → champagne-deep → success → warning → steel`, each ≥ 3:1 on `--rv-surface-raised`; series are also distinguished by pattern or direct labelling |
| Mobile behaviour | The chart scrolls inside an `overflow-x: auto` region with `tabindex="0"` and an accessible name; below 430px the data table is shown first and the chart second |
| Performance | 0 kB, server-rendered SVG |
| Accessibility | `role="img"` with an `aria-label` stating what the chart shows, plus an adjacent keyboard-reachable data table with the same numbers; a coverage badge above every chart naming rows in scope, parsed and unknown; the `UNKNOWN` bucket is drawn, never dropped; no load animation, and no value transition under reduced motion |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.24 RC-304 — `DataTable`

| Field | Value |
|---|---|
| Registry ID | RC-304 |
| Source | Rivya first-party |
| Link | `components/studio/DataTable.tsx` |
| Licence | N/A — first-party |
| Dependencies | none — no table library |
| Page | `/studio/**` |
| Purpose | usability |
| Adaptation | A real `<table>` with column definitions; sort key and page are `searchParams`; BONE scheme, 52px rows, `tabular-nums` on numeric columns |
| Mobile behaviour | Below 768px rows become stacked `<dl>` cards using a caller-declared column subset — a declared responsive view, not an automatic squeeze |
| Performance | budget ≤ 4 kB gz, client (unmeasured — PLANNED) — selection and sort controls. Rows themselves are server-rendered |
| Accessibility | `<caption>`, `<th scope="col">`, `aria-sort` on the sorted column; headers are buttons; the scroll region is focusable with an accessible name so the page body never scrolls horizontally; selection count `aria-live="polite"`; the select-all label states its page scope; `EmptyState` instead of a blank grid, and the words "Coming Soon" are forbidden (SEED §55) |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.25 RC-306 — `StatCard`

| Field | Value |
|---|---|
| Registry ID | RC-306 |
| Source | Rivya first-party |
| Link | `components/studio/StatCard.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/studio`, `/studio/research/dashboard`, `/studio/system/environment` |
| Purpose | usability |
| Adaptation | Label → value (`display-md`, `tabular-nums`) → delta → hint → coverage badge, per `DESIGN_SYSTEM.md` §13.3 |
| Mobile behaviour | Single column below 768px; the value never truncates — the label wraps instead |
| Performance | 0 kB, server |
| Accessibility | `role="group"` `aria-labelledby` the label so label and value are read together; direction is an arrow glyph plus a sign, never colour alone; each metric declares whether an increase is favourable |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Honesty constraint (FEAT §17, §28).** The unavailable state is first-class: label, an em dash, and
the reason. It is never `0`, never blank, and never "Coming Soon". A delta renders only with a
stated comparison window; a delta without a denominator is not rendered.

### 7.26 RC-309 — `ConfirmDialog`

| Field | Value |
|---|---|
| Registry ID | RC-309 |
| Source | Rivya first-party |
| Link | `components/studio/ConfirmDialog.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/studio/**` |
| Purpose | usability |
| Adaptation | RC-201 with the scrim click-to-close removed and default focus on **Cancel**; bulk destructive actions require typed confirmation (FEAT §20) |
| Mobile behaviour | Bottom sheet; Cancel is placed under the thumb and the destructive action is not |
| Performance | budget ≤ 1 kB gz over RC-201, client (unmeasured — PLANNED) |
| Accessibility | The dialog body names the entity and the row count; the destructive button's accessible name includes the verb and the object; `Escape` cancels; the outcome is announced `role="status"` |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.27 RC-314 — `CommandPalette`

| Field | Value |
|---|---|
| Registry ID | RC-314 |
| Source | Rivya first-party (APG combobox inside a dialog) |
| Link | `components/studio/CommandPalette.tsx`, `components/studio/command/registry.ts` |
| Licence | N/A — first-party |
| Dependencies | none — no command-palette library |
| Page | `/studio/**` |
| Purpose | navigation |
| Adaptation | Provider-driven through `registerCommandProvider()`; results grouped by provider; recents per user in `studio_preferences` |
| Mobile behaviour | Full-screen sheet; the `⌘K` hint is hidden and the palette is reached from the top bar |
| Performance | budget ≤ 5 kB gz, client (unmeasured — PLANNED), imported on first invocation rather than with the shell |
| Accessibility | RC-201's dialog contract plus RC-224's combobox contract; `Escape` closes and restores focus; opens instantly under reduced motion |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Security constraint.** Results are permission-filtered **server-side**. A palette that lists a
route the signed-in user may not open is an information leak, not a convenience.

### 7.28 RC-401 — `ModelViewer`

| Field | Value |
|---|---|
| Registry ID | RC-401 |
| Source | Rivya first-party, built on `three` + `@react-three/fiber` (D1 stack) |
| Link | `components/three/ModelViewer.tsx` (the chrome and the keyboard map) · `ViewerCanvas.tsx` (the only `<Canvas>`) · `presets.ts` · `loader.ts` · `variants.ts` · `ViewerControls`, `VariantSwitcher`, `DimensionOverlay`, `LightingPresetSelect`, `EnvironmentPresetSelect`, `LoadingProgress`, `PosterFallback` |
| Licence | N/A — first-party. Its runtime dependencies are `three` 0.186.0 (MIT), `@react-three/fiber` 9.7.0 (MIT), RC-904, RC-905, RC-906 and RC-907 |
| Dependencies | `three`, `@react-three/fiber`, `@react-three/drei` — all fixed by D1, none added by this component. `react` and `react-dom` are pinned at 19.2.8 while fiber caps React below 19.3 (amendment A21) |
| Page | Wherever RC-228 mounts it |
| Purpose | product understanding |
| Adaptation | Renders in the `INK` scheme against the `--rv-3d-*` token surface; controls are 44px `IconButton`s in a bottom bar; four lighting and three environment presets are built from Phase 02 palette tokens resolved from the document at mount, with no HDR and no fetch; `KHR_materials_variants` is read by a first-party loader plugin and the switcher shows `model_variant_labels` words |
| Mobile behaviour | Opt-in only below 768px and fullscreen once opened; touch orbit, pinch zoom, two-finger pan through `OrbitControls` |
| Performance | **Measured 303.6 kB gz** (brotli 252 kB) against the ≤ 350 kB budget, `docs/ops/PERFORMANCE.md` §8.3. `frameloop="demand"` unless auto-rotate is on; auto-rotate is off under reduced motion. **Never** in a first load. Model ceilings are the Phase 21 upload gate, not this budget: reject > 15 MB, > 250k triangles, any texture > 2048px, compression required above 5 MB; ≤ 8 MB per GLB is the warn line |
| Accessibility | Canvas is `role="img"` with an accessible name and an `aria-describedby` summary that lists every key; every camera action has a keyboard route (arrows orbit 5° per press, `Shift`+arrows pan, `+`/`−` zoom, `R` resets, `F` fullscreen, `M` inspects the finish, `D` shows dimensions, `Escape` leaves fullscreen); fullscreen is a fixed surface with `FocusTrap`; under reduced motion there is no auto-rotate, no damping, no intro and no idle motion; the variant switcher is a tab list with roving focus; letter keys are ignored while a select has focus |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 21 session — `tests/unit/model-policy.test.ts`, `tests/e2e/model-viewer.spec.ts` |
| Verdict | FIRST_PARTY |

**Content constraint (D10).** Dimension indicators render stored, owner-verified product dimensions
only. The viewer never derives a measurement from the mesh bounding box and presents it as a
specification.

### 7.29 RC-901 — Newsreader (display font)

| Field | Value |
|---|---|
| Registry ID | RC-901 |
| Source | Google Fonts, upstream `productiontype/newsreader` |
| Link | `https://fonts.google.com/specimen/Newsreader` |
| Licence | **VERIFY_BEFORE_USE** — expected SIL OFL 1.1; confirm from the upstream `OFL.txt` and record the version |
| Dependencies | `next/font/google` (already present via `next`) |
| Page | system |
| Purpose | brand perception |
| Adaptation | Variable axes `opsz` 6–72 and weight 200–800; only weights 400 and 500 are used (`DESIGN_SYSTEM.md` §3.4); latin subset only; no italic loaded |
| Mobile behaviour | Identical; the display scale clamps to 48px at 360px so no headline overflows |
| Performance | Self-hosted at build time — no runtime font-CDN request. Counts against the ≤ 120 kB total woff2 budget owned by `DESIGN_SYSTEM.md` §3.1 (`docs/ops/PERFORMANCE.md` carries no font line item today — §18 open item 1). **The only preloaded face in the product**, which is what `PERFORMANCE.md` §2.2 permits; `adjustFontFallback` on |
| Accessibility | `display: 'swap'` with metric-matched fallback so swap costs no layout shift inside the 0.05 CLS budget |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | PENDING_AUDIT |

### 7.30 RC-902 — Inter (body font)

| Field | Value |
|---|---|
| Registry ID | RC-902 |
| Source | Google Fonts, upstream `rsms/inter` |
| Link | `https://fonts.google.com/specimen/Inter` |
| Licence | **VERIFY_BEFORE_USE** — expected SIL OFL 1.1; confirm from the upstream licence file |
| Dependencies | `next/font/google` |
| Page | system |
| Purpose | usability |
| Adaptation | Variable weight 100–900; only 400, 500 and 600 are used; latin subset; no italic; `tabular-nums` enabled per `DESIGN_SYSTEM.md` §3.6. It also carries the `eyebrow` and `technical` type roles, which reach their register through uppercase and tracking rather than through a third family |
| Mobile behaviour | Identical. Form inputs never render below 16px, which is what stops iOS Safari zooming on focus |
| Performance | Self-hosted, **not preloaded** — `docs/ops/PERFORMANCE.md` §2.2 permits one preloaded face and it belongs to the display family (RC-901). Metric-matched fallback plus `display: 'swap'` carries first paint. Inside the ≤ 120 kB budget owned by `DESIGN_SYSTEM.md` §3.1 |
| Accessibility | Metric-matched fallback; `font-variant-numeric: tabular-nums` on every numeric column |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | PENDING_AUDIT |

### 7.31 RC-903 — IBM Plex Mono (technical font) — **REJECTED**

| Field | Value |
|---|---|
| Registry ID | RC-903 |
| Source | Google Fonts, upstream `IBM/plex` |
| Link | `https://fonts.google.com/specimen/IBM+Plex+Mono` |
| Licence | `NOT_VERIFIED — rejected before import`. The licence was never read because the family was declined on budget; no SPDX identifier is claimed for it |
| Dependencies | none — nothing is installed or loaded |
| Page | none |
| Purpose | usability (proposed: the `technical` type role) |
| Adaptation | None. The proposal was a third loaded family at weight 400 for eyebrows, SKUs, asset IDs, hex values and cron expressions |
| Mobile behaviour | n/a — not shipped |
| Performance | The reason for the rejection. A third self-hosted family exceeds `docs/ops/PERFORMANCE.md` §2.2 — at most two families, one display and one text — and the earlier draft also preloaded two faces where §2.2 permits one |
| Accessibility | n/a — not shipped. The roles it would have served lose nothing: `DESIGN_SYSTEM.md` §3.5 gives `eyebrow` and `technical` to the body family with uppercase and tracking, and gives machine identifiers the `identifier` role on `--rv-font-mono` (the platform monospace stack, 0 kB), which preserves column alignment and glyph disambiguation |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | REJECTED |

**How to re-propose it.** Not with a design argument. `docs/ops/PERFORMANCE.md` §2.2 would have to
be amended first to permit a third family, with the payload cost stated and a font line item added
to its budget tables (`DESIGN_SYSTEM.md` §18 open item 1). Only then does this row reopen.

### 7.32 RC-904 — `@react-three/drei` controls

| Field | Value |
|---|---|
| Registry ID | RC-904 |
| Source | pmndrs / drei |
| Link | `https://github.com/pmndrs/drei` |
| Licence | **MIT** — `node_modules/@react-three/drei/LICENSE` at 10.7.8, read 2026-09-10 |
| Dependencies | `@react-three/drei` 10.7.8, pinned exactly; brings `three-stdlib`'s `OrbitControls` (MIT) |
| Page | Wherever RC-228 mounts RC-401 |
| Purpose | product understanding |
| Adaptation | Two imports only: `OrbitControls` (pointer and touch orbit, dolly and pan, damping off under reduced motion) and `useProgress` (the loading store the progress bar reads). No drei UI, environment or loader helper is rendered; the GLTF, Draco and KTX2 loaders are three's own, configured in `components/three/loader.ts` |
| Mobile behaviour | One-finger orbit, two-finger dolly-pan via the wrapped controls |
| Performance | Inside the RC-401 dynamic chunk, ~15 kB of it |
| Accessibility | drei's controls are pointer-only by design, so RC-401 adds the keyboard camera model on top through the public `OrbitControls` API (target, update, reset, saveState) |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 21 session |
| Verdict | APPROVED |

### 7.33 RC-905 — Draco decoder (vendored)

| Field | Value |
|---|---|
| Registry ID | RC-905 |
| Source | google/draco, distributed with three.js as `examples/jsm/libs/draco/gltf` |
| Link | `https://github.com/google/draco` |
| Licence | **Apache-2.0** — `https://github.com/google/draco/blob/master/LICENSE`, per the README three ships beside the files; recorded in `public/draco/README.md` |
| Dependencies | none at runtime; `draco_wasm_wrapper.js`, `draco_decoder.wasm` and the asm.js fallback `draco_decoder.js` under `public/draco/`, copied from `three@0.186.0` |
| Page | Wherever RC-401 loads a Draco-compressed model |
| Purpose | product understanding |
| Adaptation | Vendored rather than CDN-loaded so the viewer has no third-party runtime origin; `DRACOLoader.setDecoderPath('/draco/')` from `lib/media/viewer-settings.ts`. Updated only by bumping `three` and copying the same files |
| Mobile behaviour | Fetched only when a Draco model is opened, which below 768px requires an explicit tap |
| Performance | Fetched on demand — 64 kB gz of WebAssembly plus an 11 kB wrapper — not part of the 303.6 kB chunk. Compression is required for models above 5 MB, which is what makes the decoder worth its bytes. The same decoder's Node build (`draco3d` 1.5.7, Apache-2.0) decodes on the server for the inspector |
| Accessibility | No UI surface. Decode failure surfaces as RC-228's stated-reason fallback, never an empty box |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 21 session — `tests/unit/model-inspect.test.ts` encodes and decodes a Draco file end to end |
| Verdict | APPROVED |

### 7.34 RC-906 — KTX2 / Basis transcoder (vendored)

| Field | Value |
|---|---|
| Registry ID | RC-906 |
| Source | BinomialLLC/basis_universal, distributed with three.js as `examples/jsm/libs/basis` |
| Link | `https://github.com/BinomialLLC/basis_universal` |
| Licence | **Apache-2.0** — `https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE`, per the README three ships beside the files; recorded in `public/basis/README.md` |
| Dependencies | none at runtime; `basis_transcoder.js` and `basis_transcoder.wasm` under `public/basis/`, copied from `three@0.186.0` |
| Page | Wherever RC-401 loads a model with `KHR_texture_basisu` textures |
| Purpose | product understanding |
| Adaptation | Vendored and version-pinned for the same reason as RC-905; `KTX2Loader.setTranscoderPath('/basis/')`. Fetched only when a model declares KTX2 textures — a model without one never requests it. Amendment A21 records that `public/basis/` holds this transcoder and NOT meshopt, which the phase document placed there |
| Mobile behaviour | Fetched only on explicit viewer open, and only for a KTX2 model |
| Performance | On demand — 245 kB gz of WebAssembly — never part of the chunk; justified by the 2048px texture ceiling it makes affordable |
| Accessibility | No UI surface |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 21 session |
| Verdict | APPROVED |

### 7.35 RC-230 — `Breadcrumbs`

| Field | Value |
|---|---|
| Registry ID | RC-230 |
| Source | Rivya first-party |
| Link | `components/patterns/Breadcrumbs.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/collection/[category]`, `/product/[slug]`, `/collections/[slug]`, `/portfolio/[slug]`, `/journal/[slug]`, every `/studio/**` leaf |
| Purpose | navigation |
| Adaptation | `DESIGN_SYSTEM.md` §8.4: `--rv-text-sm`, `--rv-ink-tertiary`, separators `aria-hidden`. Built in Phase 02 rather than Phase 10 because Phase 05's `StudioPage` needs the trail before the public chrome exists — one implementation serves both surfaces |
| Mobile behaviour | Below 430px only the parent and the current page render. The trail never wraps to a second line and never truncates the current page's own label; it drops ancestors instead |
| Performance | 0 kB, server |
| Accessibility | `<nav>` with an `aria-label` from `global_content` group `UI_LABEL`, containing an ordered list; the current page is `aria-current="page"` and is **not** a link; separators are decorative `aria-hidden` text and never the only structure — the list markup carries it |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Content constraint (SEED §1, D2).** The root label is a `global_content` string, not the literal
`Home` typed into the component. `docs/content/INITIAL_CONTENT_INVENTORY.md` §1.3 row 2 records it
as one of the thirteen strings needing a group of its own before the seed can hold it; `0080` created it as `UI_LABEL`.

### 7.36 RC-231 — `DropdownMenu`

| Field | Value |
|---|---|
| Registry ID | RC-231 |
| Source | Rivya first-party (APG menu button pattern) |
| Link | `components/patterns/DropdownMenu/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/studio/**` — top-bar user menu, table row actions, bulk action menus |
| Purpose | navigation |
| Adaptation | Elevation 2 (`DESIGN_SYSTEM.md` §6.2), `--rv-radius-md`, FORM motion. The trigger is always a real `Button` or `IconButton`. It is **not** a `Select` substitute: a menu chooses an action, a select chooses a value |
| Mobile behaviour | Below 768px it opens as a bottom-anchored RC-202 drawer so the items sit in thumb reach; item rows are ≥ 44px either way |
| Performance | budget ≤ 1.5 kB gz, client (unmeasured — PLANNED) |
| Accessibility | Trigger carries `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; the panel is `role="menu"` over `role="menuitem"` children with a roving tabindex. `ArrowDown`/`ArrowUp` move, `Home`/`End` jump, `Enter`/`Space` activate, `Escape` closes and restores focus to the trigger; outside click and route change close. **No focus trap** — a menu is not a dialog. A destructive item is never first in the list and never acts without an RC-309 confirmation |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.37 RC-232 — `MediaImage`

| Field | Value |
|---|---|
| Registry ID | RC-232 |
| Source | Rivya first-party |
| Link | `components/patterns/MediaImage/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none — delivery URLs are built by `lib/media`; no Cloudinary SDK reaches the client |
| Page | every route rendering an image |
| Purpose | material understanding |
| Adaptation | The single image renderer behind RC-213. Presets and the width ladder come from `docs/media/CLOUDINARY.md`; `f_auto` is the only format directive permitted, so AVIF/WebP negotiation happens at the CDN and never as a hard-coded extension. It is one of only two components allowed to emit an `<img>` element |
| Mobile behaviour | Renders the **mobile CMS slot's own asset** — a separate slot per D6, never a crop of the desktop source. The width ladder caps at 2560, so a phone is never sent a full-resolution original |
| Performance | 0 kB, server. `loading="lazy"` by default; `loading="eager"` is opt-in for the one above-the-fold image per route. **Built with a raw `<img>`, not `next/image`** — Next's optimiser in front of Cloudinary is a second resize of an already-resized image and bypasses the preset table and width ladder entirely, so the `@next/next/no-img-element` lint is suppressed locally with that reason. There is therefore no `priority` prop: `check-priority-images.mjs` is a Phase 08 gate, when routes first bind media and "one eager image per route" becomes checkable. `scripts/perf/check-image-props.mjs` enforces `sizes` today |
| Accessibility | `alt` from `media_assets.alt_text`, or `alt=""` only when `is_decorative` is true — never empty by omission. **`sizes` is required**: the component throws without it in development and `scripts/perf/check-image-props.mjs` fails CI on a usage that omits it. The aspect box is reserved before load, so a failure costs no CLS and the seeded SEED §47 label renders in place |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

### 7.38 RC-233 — `MediaVideo`

| Field | Value |
|---|---|
| Registry ID | RC-233 |
| Source | Rivya first-party |
| Link | `components/patterns/MediaVideo/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none — no video player library. The element is a native `<video>` |
| Page | `/`, `/large-format`, `/about`, `/process`, and any route whose block binds a video slot |
| Purpose | brand perception, material understanding |
| Adaptation | The single video renderer behind RC-213 and RC-214. Poster first, muted inline loop. **Autoplay is a runtime decision behind the `DESIGN_SYSTEM.md` §4.3 gates and is never an `autoplay` attribute in markup** — `scripts/perf/check-video-props.mjs` fails CI on one |
| Mobile behaviour | Below 768px the poster is the whole experience unless the visitor presses play; no video element is mounted speculatively |
| Performance | budget ≤ 2 kB gz, client (unmeasured — PLANNED). `preload="none"`; the poster is what the route actually paints, and the poster is never the LCP element by accident — RC-213 owns that decision |
| Accessibility | Never autoplays with sound; a poster is always present; controls are native or fully keyboard-operable. Under `prefers-reduced-motion: reduce`, `saveData`, or `deviceMemory < 4`, **no `<video>` element mounts at all** and the poster renders with a visible play control — pressing it still plays, with controls, under every one of the three. The three gates are read through `useReducedMotion` and `useDeliveryConstraints`. Captions or a transcript are required for any video carrying spoken or textual information. Asserted by `components/patterns/MediaVideo/MediaVideo.test.tsx` (14 cases, including each gate and the `< 4` boundary) and `scripts/perf/check-video-props.mjs`; `tests/e2e/a11y/reduced-motion.spec.ts` covers the same contract end-to-end from Phase 08, when a route first renders one |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Media constraint (D6).** The 26 videos in `data/higgsfield/asset-manifest.json` are the existing
video inventory and are reused, never regenerated. This component renders what the CMS slot binds;
it never selects or substitutes an asset of its own.

### 7.39 RC-234 — `Pagination`

| Field | Value |
|---|---|
| Registry ID | RC-234 |
| Source | Rivya first-party |
| Link | `components/patterns/Pagination/index.tsx` — a directory, per the convention Phase 10 settled |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/collection`, `/collection/[category]`, `/journal`, `/journal/category/[slug]`, `/search`, `/studio/**` |
| Purpose | navigation |
| Adaptation | Page-number based on `?page=n`, with `rel="prev"`/`rel="next"` and a canonical URL for each page. 24 items per public page, 50 in Studio (`docs/ops/PERFORMANCE.md` §4.4). **Never infinite scroll** — changing that needs a documented decision, not a preference |
| Mobile behaviour | Below 430px only previous, next and a "page n of m" indicator render; the number strip is dropped rather than horizontally scrolled |
| Performance | 0 kB, server. The controls are real links, so the list paginates with JavaScript disabled |
| Accessibility | `<nav>` with an `aria-label`; the current page carries `aria-current="page"` and is not a link; previous and next are `aria-disabled` spans at the ends rather than removed, so the control set does not change shape under focus. The elision between number groups is `aria-hidden`, because "…" read aloud is noise. **Focus after navigation is the browser's**: each control is a real `<a href>` and the response is a new document, so there is nothing to move focus to — the "focus lands on the first new result" behaviour this row planned belongs to an in-place update, which this deliberately is not |
| Reviewed on | Phase 14 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Content constraint (SEED §1).** Previous, next and the position string are `global_content`
strings in group `UI_LABEL`, not literals — `content/seed/catalog-ui.ts`. (Earlier drafts of this
document called that group `UI_CHROME`; migration `0080` created it as `UI_LABEL`, and the name in
the database is the one that is true.) The position string is the ONE string on the listing that
contains a number, so it is the one row carrying `{{page}}` and `{{pages}}` tokens — the sentence
lives whole in the row because "Page 2 of 7" cannot be rebuilt from fragments in another language.


**Phase 18 removed its two couplings to the catalogue.** It took `basePath` plus a `CatalogQuery`
and built its own URLs, and it read `UI_LABEL.catalog.pagination` itself — so a change to how the
catalogue encodes `sort` would have changed the journal's page addresses, and a screen-reader user
paging through the journal would have heard the region announced as the catalogue's. It now takes
`hrefFor(page)` and a `labels` object of four already-resolved strings. A caller knows how its own
URLs are shaped and which rows name its own controls; this component knows only that page 4 has an
address and that its region has a name.

### 7.40 RC-317 — `ToastRegion` + `Toast`

| Field | Value |
|---|---|
| Registry ID | RC-317 |
| Source | Rivya first-party |
| Link | `components/studio/{ToastRegion.tsx,Toast.tsx}` |
| Licence | N/A — first-party |
| Dependencies | none — no toast library |
| Page | `/studio/**` only |
| Purpose | usability |
| Adaptation | `DESIGN_SYSTEM.md` §11.1. Soft state surface from §2.9 with a 1px border in the state colour, elevation 3, BONE scheme, at `--rv-z-toast` (700). Severities are `success`, `info`, `warning`; **`danger` is not a toast severity** |
| Mobile behaviour | Bottom-right above 768px, bottom-centre and full width minus the gutter below, always above the safe-area inset. It never covers the sticky submit row of an open form |
| Performance | budget ≤ 1.5 kB gz, client (unmeasured — PLANNED). One region per Studio shell, mounted in `app/(studio)/studio/layout.tsx`, not one per page |
| Accessibility | `role="status"` `aria-live="polite"` `aria-atomic="true"`, **present and empty in the DOM from first paint** so the region exists before the first message — a live region created at the same moment as its content is not announced. Focus is never moved to a toast; the toast and its action are reachable by `Tab` in DOM order while present, and `Escape` dismisses the focused toast. Auto-dismiss at 6 s (`success`, `info`) / 10 s (`warning`), paused on hover, on focus-within and while `document.hidden`; a close button is always present so the timer is never the only route out. Under reduced motion the slide and fade are removed and **the timer is unchanged** (`docs/ops/ACCESSIBILITY.md` §2.5). Severity is carried by the message text, never by colour alone |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Honesty constraint (`docs/ops/ACCESSIBILITY.md` §2.5).** A toast is transient, dismissible and
easy to miss, so it may never be the only notification of a destructive or failed result. That
outcome is reported where the action was taken — in the RC-309 dialog, on the form, in the row — and
a toast may accompany it, never replace it. The public site has no toast at all: a visitor's outcome
is the SEED §48 success surface or the SEED §49 error message, rendered in place and re-readable.

### 7.42 RC-237 — `SortSelect`

| Field | Value |
|---|---|
| Registry ID | RC-237 |
| Source | Rivya first-party |
| Link | `components/patterns/SortSelect/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/collection`, `/collection/[category]`, `/search` |
| Purpose | navigation |
| Adaptation | A second `<form method="get">`, separate from the filter rail on purpose: a GET form submits everything it contains, so one form could not change the order without also re-submitting a half-ticked rail and resetting the page. It carries the active filters as hidden fields built from `catalogSearchParams`, so what it sends and what the canonical URL says can never disagree; `page` is deliberately not carried, because re-sorting changes what is on page 3. Three options — curated, newest, title. **There is no price option and there will not be one**: three of the four price states carry no number, so an ordering across them would have to invent a position for "Request a Quote" (`docs/project/BUSINESS_RULES.md`) |
| Mobile behaviour | The label, the select and the submit button wrap onto two lines at 360px rather than shrinking the select below a comfortable tap target; the select is the platform control, so the picker is the phone's own |
| Performance | 0 kB, server component |
| Accessibility | A real `<label for>` on a real `<select>`, and a real submit button. It does NOT submit on change: `onChange`-submitting a select needs JavaScript, strands keyboard users mid-list on some browsers, and the phase requires the listing to sort with JavaScript disabled. The control renders only when at least two options have labels — one option is not a choice |
| Reviewed on | Phase 14 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |


### 7.43 RC-238 — `ProductGallery`

| Field | Value |
|---|---|
| Registry ID | RC-238 |
| Source | Rivya first-party |
| Link | `components/patterns/ProductGallery/{index.tsx,Viewer.tsx,Thumbnails.tsx,Lightbox.tsx}` |
| Licence | N/A — first-party |
| Dependencies | RC-232 `MediaImage`, RC-201 `Dialog` |
| Page | `/product/[slug]` |
| Purpose | product understanding |
| Adaptation | Server-rendered stills with a client lightbox over them. Sources are `product_media` ordered by `role` then `sort_order` — `hero · gallery · detail · lifestyle · process · video · model`, the Phase 03 vocabulary. Zoom is a scale transform, and under reduced motion it swaps instantly rather than animating. **The 3D slot renders nothing until Phase 21** — not a teaser, not a placeholder, because a control that promises a viewer nobody built is worse than its absence |
| Mobile behaviour | The still list is the page; the thumbnail strip wraps rather than scrolling sideways, so no thumbnail sits off-screen behind a gesture nobody discovers |
| Performance | 0 kB for the stills, which are server-rendered and are what the route paints. The lightbox is the only client code and it is not in the initial bundle path — a visitor who never opens it never runs it |
| Accessibility | The thumbnails are a roving-tabindex list: exactly one is in the tab order and the arrows move between them, so a twelve-image strip costs one Tab press rather than twelve. `Home`/`End` jump to the ends. `Enter` opens the lightbox, `Escape` closes it **and returns focus to the thumbnail it came from** — RC-201 `Dialog` owns that restoration. The zoom control's accessible name is the image's own `alt_text`, because the button IS the image and a second invented label would be read instead of the picture's description. `tests/e2e/product-gallery-a11y.spec.ts` drives every one of these from the keyboard and runs axe with the lightbox open |
| Reviewed on | Phase 15 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Client-boundary constraint.** `Thumbnails` and `Lightbox` are Client Components and take their
`MediaRef` from `lib/media/ref.ts`, never from `lib/cms/media.ts` — that module opens with
`import 'server-only'` and importing anything from it fails `next build` outright. Rule 3 of
`site:check-client-boundary` walks the import graph out of every client component and fails
`npm run check` on a violation, with the chain printed.

### 7.44 RC-239 — `ProductSpecifications`

| Field | Value |
|---|---|
| Registry ID | RC-239 |
| Source | Rivya first-party |
| Link | `components/patterns/ProductSpecifications/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/product/[slug]` |
| Purpose | product understanding |
| Adaptation | The strictest surface on the site. Rows come only from `product_specs` and the non-null keys of `products.dimensions`; **there is no placeholder branch in the file at all** — no em dash, no "N/A", no "Contact us for details", because each of those tells a visitor a value exists and is being withheld. Zero rows means the block is ABSENT from the DOM, not rendered empty. Nothing is computed, converted, inferred, rounded or defaulted: a millimetre renders in millimetres |
| Mobile behaviour | A definition list, so it reflows to two lines per fact rather than becoming a table with a horizontal scroller |
| Performance | 0 kB, server |
| Accessibility | `<dl>` with a `<dt>`/`<dd>` per fact, so the label–value relationship is structural rather than visual. Group headings step down from the block heading, never skipping a level |
| Reviewed on | Phase 15 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Honesty constraint (D10).** You cannot add a placeholder here by changing a prop, because there is
no prop to change and no fallback expression to edit. `tests/unit/spec-rendering.test.tsx` asserts
the absence directly, and a dimension key the CMS has no `UI_LABEL` row for is DROPPED rather than
labelled with its raw column name — `length_mm` is an internal identifier, and showing one to a
visitor is worse than showing them one fewer fact.

### 7.45 RC-240 — `ProductMaterialStory`

| Field | Value |
|---|---|
| Registry ID | RC-240 |
| Source | Rivya first-party |
| Link | `components/patterns/ProductMaterialStory/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | RC-232 `MediaImage` |
| Page | `/product/[slug]` |
| Purpose | material understanding |
| Adaptation | One study per row in `product_materials`, rendering the material's own name, `family` and description with the material's own imagery. A product with no attached materials renders **no band at all** |
| Mobile behaviour | Studies stack; each keeps its caption directly beneath its image so the pairing survives the reflow |
| Performance | 0 kB, server |
| Accessibility | A labelled `<section>` with an `<article>` per study, so the band is skippable as one landmark rather than as N images |
| Reviewed on | Phase 15 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Media constraint (D6, D10).** This is the ONE place on a product page where a concept render may
legitimately appear — it illustrates the MATERIAL, is captioned as a material study, and sits in a
labelled band below the specification block, visually separated from the product gallery. Its
captions come from the `materials` row and never from the product, which is what keeps the caption
honest. Everywhere else on the route, `product_media_reject_concept` and
`products_reject_concept_hero` refuse a concept asset at the database.

### 7.46 RC-241 — `ProductInquiryRail`

| Field | Value |
|---|---|
| Registry ID | RC-241 |
| Source | Rivya first-party |
| Link | `components/patterns/ProductInquiryRail/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none |
| Page | `/product/[slug]` |
| Purpose | conversion |
| Adaptation | Exactly three actions and no others — `Ask About This Piece`, `Request a Quote`, and `Customize This Piece` only where `is_customizable`. Targets are `/contact?product=<slug>&type=product` and `/custom-commissions?product=<slug>`; Phase 19 reads that parameter and Phase 15 guarantees the contract and nothing more. Order is intent: the least committing action first |
| Mobile behaviour | The actions wrap into a column at the narrow widths rather than shrinking below the 44px target |
| Performance | 0 kB, server — three real links |
| Accessibility | Real `<a href>` elements, so each is reachable, focusable and openable in a new tab by the ordinary means |
| Reviewed on | Phase 15 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Allowlist constraint (D1).** The rail names the three `ACTION_LABEL` keys it will render and
CANNOT render a fourth. The obvious implementation reads the group and renders what it finds, and
that one would put `Place Order` on the page the day somebody enables the row — the CMS would be
able to add a checkout button to a business that has no checkout. `Place Order` is not rendered in
any form: not as a button, not as a disabled control, not as a greyed affordance, because a disabled
checkout reads as a checkout that is temporarily unavailable. **No WhatsApp link appears on this
route in this phase**: persistence does not exist until Phase 20 and D1 requires the inquiry to be
saved first. `tests/e2e/product-detail.spec.ts` asserts all three absences.

### 7.47 RC-242 — `RelatedContent`

| Field | Value |
|---|---|
| Registry ID | RC-242 |
| Source | Rivya first-party |
| Link | `components/patterns/RelatedContent/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | RC-217 `ProductCard`, RC-019 `Grid` |
| Page | `/product/[slug]` |
| Purpose | navigation |
| Adaptation | Editor-created `product_relations` edges render as "Related". When a product has zero manual edges, up to six other published products in the same category render instead — under the heading "More in {Category}", never "Related" and never "You may also like" |
| Mobile behaviour | One card per row below 640px, two to 1024px, three above |
| Performance | 0 kB, server |
| Accessibility | A `<section>` whose heading names which of the two sets it is showing, so the distinction is available to a screen-reader user and not only to someone reading the styling |
| Reviewed on | Phase 15 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Affinity constraint (FEAT §11).** No relation is invented. The one permitted automatic behaviour
is the same-category set, and it is labelled honestly: "Related" is a claim an editor made, and the
fallback is an observation about a category. The two must never share a heading. The relation
vocabulary is closed and lives in `lib/supabase/repositories/product-edges.ts`; the route imports
`RELATION_TARGET.product` rather than holding its own literal, so the writer and the reader cannot
drift apart.

### 7.41 RC-033 — `FileUpload`

| Field | Value |
|---|---|
| Registry ID | RC-033 |
| Source | Rivya first-party |
| Link | `components/primitives/FileUpload.tsx` |
| Licence | N/A — first-party |
| Dependencies | none — thumbnails are object URLs made by the browser; no image library is added |
| Page | `/custom-commissions` (Phase 19 configurator), `/contact` and the RC-226 inquiry drawer (Phase 20) |
| Purpose | conversion |
| Adaptation | `DESIGN_SYSTEM.md` §7.9. A real `<input type="file">` with a real label; the drop zone is an enhancement layered over it and never the only route in. Accepted types and the byte ceiling render as `HelpText` **above** the control, read from the form schema rather than typed into the component. Uploads are signed by `app/api/inquiries/upload-sign/route.ts` — unauthenticated but rate-limited, folder-forced and MIME-limited |
| Mobile behaviour | Full width; the selected-file list stacks; each row's remove control is a 44px `IconButton`; the picker offered is whatever the platform maps the `accept` list to, never a custom sheet |
| Performance | budget ≤ 2 kB gz, client (unmeasured — PLANNED). Object URLs are revoked on unmount, so a long configurator session does not leak them |
| Accessibility | The `<input>` is the labelled, keyboard-reachable control; the drop zone is `aria-hidden` decoration over it. Each selected file is a row whose remove button's accessible name includes the file name. Progress is a determinate `<progress>` announced `aria-live="polite"` at 0/50/100 only. A rejected file states why in an `ErrorText` linked by `aria-describedby`, never by border colour alone |
| Reviewed on | — |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |

**Business-rule constraint (D1, D10).** An upload failure never blocks the inquiry: the seeded
SEED §49 copy renders and the flow continues without the file. No payment field, account creation or
checkout step exists in any form containing this control, and the component never derives a
dimension, quantity or price from an uploaded file.

---

### 7.48 RC-907 — meshopt decoder (bundled)

| Field | Value |
|---|---|
| Registry ID | RC-907 |
| Source | zeux/meshoptimizer |
| Link | `https://github.com/zeux/meshoptimizer` |
| Licence | **MIT** — `node_modules/meshoptimizer/LICENSE.md` at 1.2.0, read 2026-09-10 |
| Dependencies | `meshoptimizer` 1.2.0, pinned exactly; imported as `meshoptimizer/decoder`, the decoder alone |
| Page | Wherever RC-401 loads an `EXT_meshopt_compression` model; the server inspector uses the same module |
| Purpose | product understanding |
| Adaptation | Not a vendored file: the decoder ships as a JavaScript module with its WebAssembly embedded, so it is bundled into the viewer chunk and served from the origin as part of it (amendment A21). `GLTFLoader.setMeshoptDecoder()` in `components/three/loader.ts`; `NodeIO.registerDependencies({ 'meshopt.decoder' })` in `lib/media/inspect-server.ts` |
| Mobile behaviour | Arrives with the viewer chunk, on intent only |
| Performance | 26 kB of the chunk (base64 WebAssembly compresses poorly); counted inside the measured 303.6 kB |
| Accessibility | No UI surface |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 21 session |
| Verdict | APPROVED |

### 7.49 RC-243 — `MerchandisedRow`

| Field | Value |
|---|---|
| Registry ID | RC-243 |
| Source | Rivya first-party |
| Link | `components/patterns/MerchandisedRow/index.tsx` — server |
| Licence | N/A — first-party |
| Dependencies | none of its own; draws `ReferenceCards` (a name, a line, a picture) |
| Page | `/collection` (the `STORE_FEATURED_ROW` region above the catalogue), `/collection/[category]` (the `CATEGORY_PINNED_*` region above the grid, on the default view only) |
| Purpose | conversion |
| Adaptation | A merchandising slot rendered by a ROUTE rather than by a block, beneath the page's CMS sections. Renders NOTHING when the slot resolved to nothing — the store row's fallback is HIDE_SECTION, and a pinned slot's SHOW_EMPTY_STATE is already what the listing beneath it says — so there is never a heading over nothing. The heading is a `global_content` string the route resolves (`UI_LABEL.merchandising.store_featured`, `UI_LABEL.merchandising.pinned`); provenance and slot key travel as data attributes |
| Mobile behaviour | The cards stack to one column below 640 px, as `ReferenceCards` does everywhere |
| Performance | 0 kB client JavaScript; server-rendered |
| Accessibility | A level-2 heading names the region when a string exists; each card is one link with the entity's name |
| Reviewed on | 2026-09-10 |
| Reviewer | Phase 22 session — `tests/unit/merchandising-resolve.test.ts`, `tests/e2e/merchandising.spec.ts` |
| Verdict | FIRST_PARTY |

## 8. Rejections ledger

A rejected component keeps its row so the same proposal does not return. One entry: a font
declined on **budget**, not on licence. No external UI component has been proposed and rejected.

| ID | Component | Source | Reason for rejection | Reviewed on | Reviewer |
|---|---|---|---|---|---|
| RC-903 | IBM Plex Mono (technical font) | Google Fonts / IBM | **Budget, not licence.** A third loaded family exceeds `docs/ops/PERFORMANCE.md` §2.2, which permits at most two (one display, one text) and one preloaded face. `DESIGN_SYSTEM.md` §3.1 resolves the conflict in PERFORMANCE.md's favour: the `technical` and `eyebrow` type roles move to the body family with uppercase and tracking, and machine identifiers move to `--rv-font-mono`, the platform monospace stack, which loads no file. Re-proposing it needs a PERFORMANCE.md §2.2 amendment first, not a design argument | — | UNASSIGNED |

Standing rejection reasons, recorded so a reviewer does not have to re-argue them:

| Reason | Detail |
|---|---|
| Licence not on the §4 allowlist | Including "no licence stated" and components behind a paid plan |
| Introduces a second animation runtime | The motion system is CSS plus one shared observer. A component that ships GSAP, Framer Motion or Lottie is rejected unless it replaces the whole layer |
| Client-only above 15 kB gz without a named justification | Phase 02 risk register |
| Keyboard or ARIA model weaker than the equivalent APG pattern | Adapting a broken keyboard model costs more than writing one |
| Hard-codes copy or colour | Copy must come from the CMS (SEED §1) and colour from tokens (`DESIGN_SYSTEM.md` §1) |
| Depends on a runtime CDN | Every asset is self-hosted; a third-party origin is a privacy and availability liability |

---

## 9. Intake process — adding a component

Seven steps. Steps 1–4 happen **before** any code is written.

1. **Justify.** Name which of the seven FEAT §5 justifications it serves — product understanding,
   material understanding, brand perception, storytelling, navigation, conversion, usability. A
   component that serves none is removed, not registered. Check §6 first: composing two existing
   components beats adopting a third.
2. **Reserve.** Take the next free `RC-###`, add an index row in §6 with `State: PLANNED` and the
   owning phase. IDs are never reused, even for a rejected entry.
3. **Source and licence.** For anything external: open the upstream repository, read the licence
   file, record the SPDX identifier plus the version or commit. Until that is done the row is
   `Licence: VERIFY_BEFORE_USE`, `Verdict: PENDING_AUDIT`, and **no code may be imported** —
   `check-registry.mjs` fails the build if the path exists while the verdict is `PENDING_AUDIT`.
   If the licence is not on the §4 allowlist, set `Verdict: REJECTED`, write the reason, and stop.
4. **Full record or index row.** Apply the §2 test. If a full record is needed, write all fourteen
   fields in §7 — including `Mobile behaviour` at 360px and a `Performance` figure. "TBD" is not a
   value. Before the code exists the figure is a stated **budget**
   (`budget ≤ n kB gz, client (unmeasured — PLANNED)`, §3): a ceiling you are prepared to hold. If
   you cannot name one, the component is not ready to be written.
5. **Build against tokens.** No hex literal, no raw `px` spacing, no copy in JSX. An external
   component is rewritten against `DESIGN_SYSTEM.md` tokens and the `Adaptation` field says what
   changed — a verbatim copy is not accepted.
6. **Prove it.** Add it to the dev-only gallery at `app/(site)/design-system/**` (served at
   `/design-system`, `notFound()` in production — the path is fixed by the A2 amendment to
   `CANONICAL-DECISIONS.md`), add its visual snapshot to `tests/e2e/design-system.spec.ts` at the
   eight FEAT §45 widths, and add a keyboard test for its ARIA contract. **Measure the real bundle
   delta and replace the step-4 budget with it** — a `BUILT` row still carrying a `budget ≤` figure
   is an incomplete record (§3).
7. **Close the record.** Fill `Reviewed on`, `Reviewer` and the final `Verdict`; flip `State` to
   `BUILT`; run `npm run check`. Then follow the FEAT §43 documentation update contract —
   `CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### 9.1 Auditing one of the eleven approved sources

An audit is of the **source**, not of a single component, and is recorded in §5:

1. Find the source's actual code repository. A gallery site is not a repository, and a licence
   badge on a marketing page is not a licence.
2. Record the licence stated in that repository, and whether components are copy-paste or an npm
   dependency.
3. Record whether it ships its own runtime — a second animation library is a standing rejection
   reason (§8).
4. Sample three components and record their keyboard and ARIA posture.
5. Replace `NOT_YET_AUDITED` with `AUDITED — <date>` plus a one-line verdict, and list any
   components taken.

---

## 10. Verification

| Check | Command | Asserts |
|---|---|---|
| Registry schema | `node scripts/design/check-registry.mjs` | Every file under `components/{primitives,patterns,studio,three}/**` and `public/**` has a row (`components/sections/**` is out of scope by design, §1); every `BUILT` row's `Link` path exists, while a `PLANNED` row is expected to have none; every full record has all fourteen fields, with no `BUILT` row left on a `budget ≤` figure; no `PENDING_AUDIT` row has code on disk; every `Licence` is allowlisted, or `VERIFY_BEFORE_USE` under `PENDING_AUDIT`, or `NOT_VERIFIED` under `REJECTED` |
| Token discipline | `node scripts/design/check-tokens.mjs` | No hex literal or raw `px` spacing outside `app/styles/**` |
| Visual matrix | `npx playwright test tests/e2e/design-system.spec.ts` | Every registered component renders at 1920, 1440, 1280, 1024, 768, 430, 390, 360 |
| Keyboard contracts | `npx playwright test tests/e2e/a11y/` | Dialog focus trap and restore, tabs roving tabindex, accordion header buttons, `Escape` behaviour, 44 × 44 hit boxes at 390px |
| Reduced motion | `npx playwright test tests/e2e/a11y/reduced-motion.spec.ts` | No transform or opacity transition applies and no `<video>` mounts under `prefers-reduced-motion: reduce` |

Three negative tests are part of Phase 02's exit criteria, because a checker nobody has seen fail is
a checker nobody can trust:

1. Delete a `Licence` cell from any full record — `check-registry.mjs` exits non-zero on the missing
   field.
2. Add an empty `components/patterns/Unregistered.tsx` — it exits non-zero on the unregistered file.
3. Flip one row's `State` to `BUILT` without writing its component — it exits non-zero on the
   missing path, proving the path check is armed by `BUILT` and not by the row's existence. Restore
   it to `PLANNED` and the run is green again with no file added.

Adding a `components/sections/<Type>.tsx` renderer must **not** fail this checker; it is
`tests/unit/cms-registry.test.ts` that has an opinion about it (§1).

### 7.41 RC-216 — `ChapterMedia`

| Field | Value |
|---|---|
| Registry ID | RC-216 |
| Source | Rivya first-party |
| Link | `components/patterns/ChapterMedia/index.tsx` |
| Licence | N/A — first-party |
| Dependencies | none (composes RC-233 `MediaVideo` and the four motion hooks) |
| Page | `/process` |
| Purpose | storytelling, material understanding |
| Adaptation | A process chapter's optional motion layer, over a still the section already rendered. **It was planned as "index only — composes RC-213/RC-207" and is a Client Component instead**, because the thing it coordinates cannot be known on the server: `/process` is seven chapters and the library holds thirteen process videos, so the clip mounts only while its own chapter crosses the middle of the viewport, and a module-level claim keeps a second chapter from taking the slot while the first holds it |
| Mobile behaviour | Below 768px no clip mounts at all; the still is the whole chapter |
| Performance | **Not in any route's initial bundle.** `ProcessStepsSection` reaches it through `next/dynamic`, because that renderer is imported by every page with a process band — the homepage included — and a static import would have charged the homepage for an island it never renders. `scripts/site/check-island-budget.mjs` measured exactly that and failed the build; it now counts static and lazy islands separately, and reports this one as lazy |
| Accessibility | The layer is `aria-hidden`: the still beneath carries the section's alt text and the clip is the same subject in motion, so announcing both reads the picture twice. Under `prefers-reduced-motion`, Data Saver, `deviceMemory < 4`, below 768px, or for a clip whose duration is unknown, no `<video>` element mounts and nothing is drawn — never a poster with a play control, which over a chapter's own still would be a second picture and a competing control |
| Reviewed on | Phase 12 |
| Reviewer | UNASSIGNED |
| Verdict | FIRST_PARTY |
