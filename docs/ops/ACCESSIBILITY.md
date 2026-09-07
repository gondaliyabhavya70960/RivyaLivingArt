---
doc: ACCESSIBILITY
status: CURRENT
owning_phase: 41
last_reviewed: 2026-09-07
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# ACCESSIBILITY — the testable standard

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/design/DESIGN_SYSTEM.md` (tokens, focus ring, reduced-motion contract),
> `docs/design/COMPONENT_REGISTRY.md` (per-component accessibility notes),
> `docs/ops/TESTING.md` (how these suites are run), `docs/ops/PERFORMANCE.md` (the motion and media
> rules that overlap with 2.3.3).
> Source specification: FEAT §48. Owned by Phase 41; every phase that ships a component owes its
> row here.

**The stated target: WCAG 2.2 Level AA**, plus two Rivya rules that deliberately exceed it:

1. **44 × 44 CSS px minimum touch target** (2.5.8 AA requires 24 × 24), measured as the hit box, not
   the glyph.
2. **`prefers-reduced-motion` honoured by every animation, without exception** — a static branch, not
   a shortened one.

**What this document is not.** It is not an accessibility statement. A published statement is a
factual claim about an organisation and only the owner can make it — recorded
**OWNER_VERIFICATION_REQUIRED**, with a drafted skeleton kept at `DRAFT` in `global_content`. This
document records **what was tested and what passed**, never that "the site is accessible".

**Implementation status.** No components exist yet. Every "Proof" cell names the artefact the owning
phase must deliver; a component shipped without its proof is incomplete, not merely untested.

---

## 1. FEAT §48 → criterion → mechanism → proof

| §48 item | WCAG | Mechanism | Proof |
|---|---|---|---|
| Semantic HTML | 1.3.1 | One `<header>`, `<nav>`, `<main>`, `<footer>` per page; lists are lists; tables have `<caption>` and `<th scope>`; no `<div>` with a click handler | `tests/e2e/a11y/landmarks.spec.ts` + axe |
| Heading hierarchy | 1.3.1, 2.4.6 | Exactly one `<h1>` per route; no skipped levels; a CMS section renders at the level its block declares, not the level that looks right | `tests/e2e/a11y/headings.spec.ts` walks the tree per route |
| Keyboard navigation | 2.1.1, 2.1.2 | Every interactive element reachable and operable; no keyboard trap outside an intentional modal | Route-by-route keyboard scripts in Playwright |
| Focus visibility | 2.4.7, 2.4.11 | One `:focus-visible` token pair (ring + offset), ≥ 3:1 against both adjacent surfaces; over media it gains a second inner 1 px ring so it survives on any photograph | `scripts/a11y/check-focus-styles.mjs` (no unreplaced `outline: none`) |
| Form labels | 1.3.1, 3.3.2 | Every control has a programmatic label; a placeholder is never the label; `autocomplete` on name, tel, email | `tests/e2e/a11y/forms.spec.ts` + axe |
| Screen-reader labels | 4.1.2 | Icon-only controls take `aria-label` **from `global_content`**, never a literal (BR-D4); live regions for search results, filter counts and save confirmations | Manual pass + axe |
| Alt text | 1.1.1 | `media_assets.alt_text` non-empty for every bound asset; a decorative asset sets `is_decorative = true`, which renders `alt=""` deliberately — an empty string is never produced by accident | `tests/unit/alt-text-coverage.test.ts` + the database check constraint |
| Contrast | 1.4.3, 1.4.11 | ≥ 4.5:1 body text, ≥ 3:1 large text and UI boundaries, on every token pair the design system permits; a pairing not in a permitted-pairs table is not permitted | `scripts/a11y/check-contrast.mjs` over the token matrix |
| Reduced motion | 2.3.3 | One `useReducedMotion()` source, a CSS floor as a safety net, and a **static branch** per subject | `tests/e2e/a11y/reduced-motion.spec.ts` |
| Accessible dialogs | 2.4.3, 4.1.2 | `role="dialog"` + `aria-modal`, labelled, focus moved in and restored out, `Escape` closes, background inert | Per-component e2e: lightbox, drawer, confirm, command palette |
| Accessible tabs | 4.1.2 | APG tab pattern: roving `tabindex`, `aria-selected`, arrow keys | Studio tab component specs |
| Accessible navigation | 2.4.1, 2.4.5 | Skip link first in the DOM; mega menu and mobile drawer per the Phase 10 keyboard model; breadcrumbs with `aria-current="page"` | `tests/e2e/navigation-a11y.spec.ts` |
| Touch target size | 2.5.8 (exceeded) | 44 × 44 minimum hit box | `tests/e2e/a11y/touch-targets.spec.ts` at 390 px |

### 1.1 WCAG 2.2 criteria that are easy to miss, and how they are met

| Criterion | Rule here |
|---|---|
| **2.2.1 Timing Adjustable (Level A)** | **No timed navigation anywhere in the product, and specifically not on the conversion path.** Nothing on a public route starts a timer that moves, closes, submits or navigates on the visitor's behalf. The one place this was nearly breached is the inquiry success state — see §1.2. The only timers permitted are ones the user can outlast without loss: a toast whose auto-dismiss is never the sole notification of a result (§2.5), and the session timeouts in `SECURITY.md` §6.1, which 2.2.1 exempts as essential (an exception the criterion grants explicitly, not one this document is inventing) |
| **2.2.2 Pause, Stop, Hide** | Nothing auto-advances by default: no carousel auto-play, no auto-rotating 3D viewer, no motion loop that runs longer than five seconds without a control. Where auto-advance exists at all it ships off and has a pause control (§2.4) |
| **3.2.5 Change on Request** | A change of context — a navigation, a new window, a route change — happens only when the user asks for it. `Continue to WhatsApp` is a real link the user activates; the WhatsApp handoff leaves the site, and a change of context that large is never automatic |
| 2.4.11 Focus Not Obscured (Minimum) | A sticky header, the announcement bar and the mobile filter drawer must never cover a focused element. `scroll-margin-top` on every focusable is set to the sticky-chrome height token |
| 2.5.7 Dragging Movements | Every drag interaction has a non-drag equivalent: the Studio section reorder offers move-up / move-down buttons; the gallery swipe has previous / next controls |
| 2.5.8 Target Size | 44 × 44 (above AA) |
| 3.2.6 Consistent Help | The WhatsApp and contact affordances appear in the same relative position on every route |
| 3.3.7 Redundant Entry | The inquiry flow never asks twice for something already provided in the same session; configurator answers pre-fill the contact step where they overlap |
| 3.3.8 Accessible Authentication (Minimum) | Studio sign-in permits paste and password managers; there is no cognitive-function test, no puzzle, no third-party captcha |
| 1.4.10 Reflow | 320 px with no horizontal scroll and no lost content |
| 1.4.12 Text Spacing | The token scale survives the 1.4.12 override block without clipping |
| 1.4.13 Content on Hover or Focus | Tooltips are dismissible with `Escape`, hoverable, and persist until dismissed |

### 1.2 The WhatsApp handoff is activated, never timed

This is the single accessibility decision in the product that changes a documented behaviour, so it is
recorded here in full rather than folded into a table cell.

Earlier drafts of `PRD.md` §5.1 step 7a, `ARCHITECTURE.md` §4.1 and `PHASE-16-22.md` specified that the
inquiry success state would *"auto-forward after 1 s, cancellable"*. **That fails 2.2.1 at Level A**,
and it fails it in the least recoverable way:

| Why it fails | Detail |
|---|---|
| 2.2.1 Timing Adjustable | An unrequested navigation on a time limit under 20 hours must be turnable off, adjustable to 10× the default, or extendable after a warning with at least 20 seconds to respond. A one-second cancel button is none of the three |
| 3.2.5 Change on Request | Leaving the site for WhatsApp is the largest change of context the product performs. It must be initiated by the user |
| It contradicts §2.2 of this document | The success state must be *announced in a live region* **and** *receive focus*. A screen reader has not finished the announcement in one second; a switch or voice user has not reached the cancel control; a keyboard user reading the reference code is navigated away mid-read |
| It loses the reference code | `RIV-<yyyy>-<6 digits>` is the visitor's only handle on their enquiry, and one second is not long enough to read it, let alone write it down |

**The rule.** The success state renders, is announced politely, and moves focus to its heading.
`Continue to WhatsApp` is a real `<a href>` that the visitor activates. **No timer runs on this
surface** — not one second, not five, not an adjustable one. SEED §48 specifies a heading, a body line
and a CTA; it never asked for a countdown, so nothing in the content specification is given up.

| | |
|---|---|
| Mechanism | `components/patterns/InquirySuccess.tsx` renders the SEED §48 copy inside `role="status"` (polite), gives its `<h2>` `tabindex="-1"` and focuses it once on mount, and renders the CTA as a real `<a href>`. It mounts **no** `setTimeout`, `setInterval`, `router.push` or `location.assign`. The reference code sits inside the live region so it is announced with the confirmation, not after it |
| Proof | `tests/e2e/inquiry-conversion.spec.ts`, extended: after a successful submit, assert (a) focus is on the success heading, (b) the reference code is inside the live region's accessible name, (c) **no navigation occurs within 10 seconds of idle**, and (d) activating the CTA — by click **and** by `Enter` on the focused link — navigates to a `wa.me` URL carrying the persisted reference |
| Guard | `scripts/a11y/check-no-timed-navigation.mjs` (§3): no module under `app/(site)/**` or `components/patterns/**` may call `router.push`, `router.replace`, `location.assign` or `window.open` from inside a `setTimeout`/`setInterval` callback. Re-adding the one-second forward must fail the build, not a review |
| Reconciled with | `PRD.md` §5.1 7a, which now states activation. `ARCHITECTURE.md` §4.1 and `PHASE-16-22.md` still carry the old step and must be corrected to match; neither is owned by this document, and the divergence is named rather than left to an implementer |

---

## 2. Per-component standard

Every component type ships with the requirements in its row. "Proof" is the spec that must exist and
pass before the component is considered delivered.

### 2.1 Actions

| Component | Requirements | Proof |
|---|---|---|
| **Button** | Native `<button>` with a real `type`; label is text, not an icon alone; disabled state uses `aria-disabled` when the control must stay focusable to explain itself; loading state announces through a live region; 44 × 44 hit box; visible `:focus-visible` ring | `tests/e2e/a11y/forms.spec.ts`, touch-target spec |
| **IconButton** | `aria-label` sourced from `global_content`; never `title` alone; 44 × 44 even when the glyph is 20 px | axe + touch-target spec |
| **TextLink** | Native `<a href>`; purpose clear from the link text alone or from its `aria-label`; "Read more" is never the whole accessible name; external links state that they open a new tab; underline or a non-colour affordance carries the meaning (1.4.1) | axe + manual pass |
| **CTA pairs** (primary + secondary) | Rendered in DOM order matching visual order; both reachable by `Tab`; neither is a `<div>` | landmark/keyboard specs |

### 2.2 Forms and the conversion path

| Component | Requirements | Proof |
|---|---|---|
| **Field / Label / HelpText / ErrorText** | `<label for>` bound to a real control; help text via `aria-describedby`; error text via `aria-describedby` **and** `aria-invalid`; errors announced in a polite live region; error copy comes from seeded content (SEED §49), never a raw exception | `tests/e2e/a11y/forms.spec.ts` |
| **Input / Textarea** | `autocomplete` tokens on name (`name`), phone (`tel`), email (`email`), city (`address-level2`); `inputmode` where it helps; no placeholder-as-label; character counters announced politely | forms spec |
| **Select** | Native `<select>` unless a listbox is genuinely required; a custom listbox follows the APG pattern with `aria-expanded`, `aria-activedescendant`, type-ahead and `Escape` | component spec |
| **Checkbox / Radio** | Native inputs; radio groups in a `<fieldset>` with a `<legend>`; group label is not visually hidden without cause | forms spec |
| **Switch** | `role="switch"` with `aria-checked`; the label states what it controls, not "on" | component spec |
| **File / reference upload** | Keyboard-operable trigger (a drop zone alone is not enough); accepted types and size limits stated in text before the user acts; per-file progress and removal announced; a rejection states the reason from seeded copy | forms spec + `upload-validation` unit test |
| **Configurator (multi-step)** | Each step is a landmark-labelled region; progress announced on step change; focus moves to the new step's heading; validation errors summarised at the top with in-page links to each field; back preserves entered values (3.3.7) | `tests/e2e/commission-configurator.spec.ts` |
| **Inquiry success / error states** | Success is announced in a polite live region **and** receives focus, and the reference code is inside that region; `Continue to WhatsApp` is a real link requiring activation — **no timed forward, at any delay** (2.2.1, 3.2.5; §1.2); the error state never navigates and never loses typed values (BR-B1) | `tests/e2e/inquiry-conversion.spec.ts`, including the ten-second no-navigation assertion |

### 2.3 Navigation

| Component | Requirements | Proof |
|---|---|---|
| **Skip links** | First focusable elements in the DOM, visible on focus. Site-wide: skip to content, skip to navigation. Route-specific: skip to filters (`/collection/[category]`), skip to results (`/search`), skip to the section list (Studio page editor) | `tests/e2e/navigation-a11y.spec.ts` |
| **Site header** | One `<nav>` with an accessible name; the current route marked `aria-current="page"`; sticky behaviour never obscures a focused element (2.4.11) | landmark + focus specs |
| **Mega menu** | Opens on click **and** on keyboard activation, never on hover alone; `aria-expanded` on the trigger; `Escape` closes and restores focus to the trigger; `Tab` moves through items in visual order; it does not trap focus | `navigation-a11y.spec.ts` |
| **Mobile drawer** | `role="dialog"` + `aria-modal`; focus trapped while open; `Escape` closes; background inert and not scrollable; the close control is 44 × 44 and first or last in the trap, consistently | `navigation-a11y.spec.ts` at 390 px |
| **Breadcrumbs** | `<nav aria-label="Breadcrumb">` with an ordered list; the current page is `aria-current="page"` and is not a link | axe |
| **Pagination / load more** | Real links or buttons; the new result count is announced; focus lands on the first new item, never back at the top | catalogue spec |
| **Footer** | Landmark `<footer>`; link groups have headings that are real headings, not styled text | landmarks spec |

### 2.4 Content and media

| Component | Requirements | Proof |
|---|---|---|
| **MediaImage** | `alt` from `media_assets.alt_text`, or `alt=""` only when `is_decorative = true`; `sizes` always declared; a reserved aspect box so no layout shift on load; a failed load renders the seeded fallback label rather than collapsing (SEED §47) | `alt-text-coverage`, `check-image-props.mjs` |
| **MediaVideo** | Never autoplays with sound; a poster is always present; native controls or fully keyboard-operable custom controls; **under reduced motion no `<video>` element mounts** — the poster renders with a visible play control; captions or a transcript are required for any video carrying spoken or textual information | `reduced-motion.spec.ts`, `check-video-props.mjs` |
| **Product gallery** | Arrow keys move between items; the active item is announced; thumbnails are a real list with `aria-current`; swipe has button equivalents (2.5.7); the zoom/lightbox trigger states what it opens | `product-gallery-a11y.spec.ts`, `touch.spec.ts` |
| **Lightbox** | Full dialog semantics; `Escape` closes; focus restored to the trigger; next/previous keyboard-operable; the image's alt text is the dialog's accessible name or is exposed within it | lightbox spec |
| **Carousel / slider** | Auto-advance is off by default and never starts under reduced motion; if it exists at all it has a pause control; slide changes are announced politely; hidden slides are `inert` and not tabbable | component spec |
| **Cards (product, collection, portfolio, journal)** | One link per card wrapping the heading, not a nest of overlapping links; the whole-card click area is a decorative overlay, never a second focusable; the accessible name is the title, not "View" | axe + keyboard spec |
| **3D viewer** | Loads only behind an explicit intent gate — never automatically; a poster with a labelled control precedes it; keyboard controls for orbit, zoom and reset, documented on the control itself; a text alternative describes what the model shows; no auto-rotate, no intro animation and no idle motion under reduced motion; the canvas is `aria-hidden` with controls exposed as real buttons | `model-viewer.spec.ts` (flag on and off) |
| **Empty and error states** | Real headings and text from seeded content; the recovery action is a real link or button; never a bare icon | `cms-workflow.spec.ts` |

### 2.5 Disclosure and overlay

| Component | Requirements | Proof |
|---|---|---|
| **Modal / ConfirmDialog** | `role="dialog"`, `aria-modal="true"`, labelled by its heading; focus moves in on open and returns to the trigger on close; `Escape` closes; background inert; a destructive confirmation states the exact count in text, not only in a colour | `bulk.spec.ts`, dialog spec |
| **Drawer** | Same as modal when it is modal; when non-modal, it does not trap focus and closes on outside activation | drawer spec |
| **Tabs** | APG pattern: `role="tablist"`, roving `tabindex`, `aria-selected`, arrow keys, `Home`/`End`; panels are labelled by their tab | Studio tab spec |
| **Accordion** | Header is a `<button>` inside a heading of the correct level; `aria-expanded`; the panel is not hidden from the accessibility tree while visible; FAQ accordions keep their content in the DOM for search and for print | `faq` spec |
| **Tooltip** | Dismissible with `Escape`, hoverable, persistent until dismissed (1.4.13); never the only carrier of essential information; not used on touch-only affordances | component spec |
| **Toast** | Polite live region; never the only notification of a destructive result; the auto-dismiss timer is long enough to read and is unaffected by reduced motion (only the slide is removed) | component spec |

### 2.6 Data surfaces (Studio)

| Component | Requirements | Proof |
|---|---|---|
| **Data grid / table** | Real `<table>` with `<caption>`, `<th scope>`, and a programmatic row count; sortable headers use `aria-sort` and are buttons; row selection is a labelled checkbox per row plus a labelled select-all; bulk action bars announce the selected count | `studio-analytics.spec.ts`, axe on seven Studio routes |
| **Filters** | Each filter is a labelled control; the applied-filter count is announced; "clear all" is a real button; the mobile filter drawer is a modal dialog with a focus trap | `catalogue-filters.spec.ts` |
| **Search combobox** | APG combobox: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; results count announced politely; `Escape` closes the list and keeps the query; a result is reachable by keyboard and by touch | `search-combobox-a11y.spec.ts` |
| **Command palette** | Dialog semantics plus combobox semantics; opens by keyboard shortcut **and** by a visible control; the shortcut is discoverable in the interface, not only in documentation | palette spec |
| **Charts / KPI cards** | Every chart has a text alternative — an accessible summary and, where the data is small, a linked or adjacent table; colour is never the only encoding; an unavailable metric renders an explicit unavailable state, never a fabricated zero (FEAT §28) | `studio-analytics.spec.ts` |
| **Section list / reorder** | Drag has button equivalents (2.5.7); each move announces the new position; the list is a real list | Studio editor spec |

The Studio is a desktop tool and is not snapshotted below 1024 px, but it is still **fully keyboard
operable** and passes the axe sweep at 1440 px and 390 px.

---

## 3. Automated sweep

| Property | Value |
|---|---|
| Tool | `@axe-core/playwright` |
| Coverage | Every public route (D3) and seven representative Studio routes |
| Widths | 1440 px and 390 px |
| Threshold | **Zero critical and zero serious** violations |
| Moderate / minor | Logged to an artefact and triaged; never silently ignored |
| Exceptions | `tests/e2e/a11y/exceptions.json` — ships with **zero rows**. A row requires a reason, an owner and a dated review; the whole file prints on every run, and its row count is an exit criterion |

Seven specs, each testing something axe cannot: `landmarks`, `headings`, `forms`, `touch-targets`,
`reduced-motion`, `zoom-reflow`, `axe-sweep`.

Three guards run inside `npm run check`, before any browser starts:

| Guard | Fails when |
|---|---|
| `scripts/a11y/check-contrast.mjs` | Any permitted token pairing falls below its required ratio. Darkening one body-text token by 10 % must fail, naming the pair |
| `scripts/a11y/check-focus-styles.mjs` | Any `outline: none` appears without a replacement ring |
| `scripts/a11y/check-no-timed-navigation.mjs` | Any module under `app/(site)/**` or `components/patterns/**` calls `router.push`, `router.replace`, `location.assign` or `window.open` from inside a `setTimeout` or `setInterval` callback (§1.2). Re-adding the one-second handoff forward must fail the build, naming the file |

---

## 4. Manual passes automation cannot replace

Recorded here with tester, date, tool version and outcome. These are statements of work done, not
capability claims.

| # | Pass | Procedure | Last run | Tester | Outcome |
|---|---|---|---|---|---|
| M1 | Keyboard-only conversion | `/` → category → product → enquire → submit → WhatsApp handoff, completing without a mouse | NOT YET RUN | — | — |
| M2 | Screen-reader conversion | The same path with a screen reader; the piece, its media and the form are all comprehensible | NOT YET RUN | — | — |
| M3 | Zoom and reflow | 200 % zoom and a 320 px viewport: no horizontal scroll, no lost content, no overlapped controls | NOT YET RUN | — | — |
| M4 | Studio publish workflow | Keyboard-only: edit a section, reorder, change media, preview, publish | NOT YET RUN | — | — |
| M5 | Text spacing | Apply the 1.4.12 override block; nothing clips or overlaps | NOT YET RUN | — | — |
| M6 | Reduced motion, by hand | With the OS preference set: no video mounts, no parallax, no auto-advance, and every stage of the material sequence is reachable by `Tab` | NOT YET RUN | — | — |

Record the screen reader and browser pairing used for M2 (for example NVDA + Firefox, VoiceOver +
Safari). One pairing is a pass; claiming "works with screen readers" from one pairing is not.

---

## 5. Definition of done

### 5.1 Per component

A component is not delivered until: it has a row in §2 or in `COMPONENT_REGISTRY.md` with its
keyboard model; its `:focus-visible` ring is visible on every surface it can sit on; its hit box is
≥ 44 × 44; it behaves correctly under reduced motion; its labels come from content, not literals; and
it has at least one spec asserting its keyboard behaviour.

### 5.2 Per route

A route is not done until: it has exactly one `<h1>` and no skipped heading levels; landmarks are
present and unique; the axe sweep is clean at 1440 px and 390 px; every image has alt text or an
explicit decorative flag; and the route is fully operable by keyboard from the skip link to the last
interactive element.

### 5.3 Per release

Every box in §3 green · §4 passes M1–M3 re-run since the last release that touched the conversion
path or navigation · `exceptions.json` still empty · this document's manual-pass table updated with
dates.

---

## 6. Out of scope

WCAG AAA · a published accessibility statement (**OWNER_VERIFICATION_REQUIRED**) · a third-party
accessibility overlay or widget — overlays are prohibited: they add a third-party origin (forbidden
by the CSP and by the performance rules) and they mask defects rather than fixing them · certified
conformance audits (an engagement the owner commissions) · assistive-technology support claims beyond
the pairings actually tested in §4.

---

## 7. Open questions for the canonical decisions

1. **The 44 × 44 target exceeds AA and is a Rivya rule, not a WCAG one.** It is recorded here and in
   `DESIGN_SYSTEM.md`, but not canonically. Suggested amendment: one line in D-section form so a
   later phase cannot trade it away for density.
2. **Screen-reader pairing is unspecified.** M2 requires a pairing but no canonical decision names
   one. Suggested amendment: record the supported pairing(s) so "tested" has a fixed meaning.
3. **Captions and transcripts have no content home.** §2.4 requires them for any video carrying
   spoken or textual information, but no `media_assets` column or `global_content` group holds a
   transcript today. Suggested amendment: if narrated video is ever in scope, add the column in
   `DATA_MODEL.md` before the first such asset exists. The 26 manifest videos are silent, atmospheric
   concept media, so nothing is currently blocked.
