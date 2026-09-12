---
doc: DESIGN_SYSTEM
status: CURRENT
owning_phase: 02
last_reviewed: 2026-09-12
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# DESIGN SYSTEM — the one visual language

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `COMPONENT_REGISTRY.md` (what may be used and where it came from),
> `docs/architecture/ARCHITECTURE.md` (module boundaries), `docs/ops/ACCESSIBILITY.md`
> (the audit), `docs/ops/PERFORMANCE.md` (the budgets).
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (*FEAT §n*) and
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (*SEED §n*).
> Implemented by **Phase 02** (`docs/project/phases/PHASE-00-04.md`); extended by the owning
> phase of each deferred component, never by a page phase inventing its own values.

FEAT §6 requires one centralised design system built **before** the final pages. This document is
that system. It fixes, in exactly one place, every colour, type size, spacing step, radius, border,
shadow, breakpoint, container width, easing curve, duration and z-index the product is permitted to
use, and the behavioural contract of every control that consumes them.

Three rules govern everything below.

1. **One place.** A value that appears in this document appears in `app/styles/tokens.css` and
   nowhere else. `scripts/design/check-tokens.mjs` fails the build on a hex literal or a raw `px`
   spacing value found anywhere under `components/**` or `app/**` outside `app/styles/**`.
2. **No copy.** A primitive or pattern takes content as props. No component in this system contains
   a headline, a label or a sentence a visitor reads — that comes from `page_sections`,
   `global_content`, `faqs`, `seo_entries` or an entity column (SEED §1, D2).
3. **Accessibility is a token property, not a review step.** Every colour pairing this document
   permits has a measured contrast ratio recorded here. A pairing that is not in a permitted-pairs
   table is not permitted.

---

## 1. Token architecture

Three layers. A component may only read the third.

| Layer | Prefix | Example | Who may read it |
|---|---|---|---|
| **Primitive** — a raw measured value | `--rv-color-*`, `--rv-neutral-*`, `--rv-space-*`, `--rv-duration-*` | `--rv-color-ocean: #08283A` | Only the semantic layer |
| **Semantic** — a role in a scheme | `--rv-surface-*`, `--rv-ink-*`, `--rv-line-*`, `--rv-accent-*`, `--rv-state-*` | `--rv-ink-secondary` | Components, freely |
| **Component** — a local alias where a component needs its own knob | `--rv-button-*`, `--rv-3d-*`, `--rv-table-*` | `--rv-button-height-md` | Only its own component |

The semantic layer is **redefined per colour scheme**; the primitive layer never is. That is the
whole mechanism by which a section can switch from a deep ground to a light ground without a single
component knowing which scheme it is in.

### 1.1 File map

| File | Contains | Rule |
|---|---|---|
| `app/styles/tokens.css` | Every `--rv-*` custom property; the primitive, semantic and scheme blocks | The **only** file in the repository permitted to contain a colour literal |
| `app/styles/base.css` | Reset, `:focus-visible` ring, `prefers-reduced-motion` block, root typography, selection colour | No component selectors |
| `app/styles/scheme.css` | The three scheme classes (`.rv-scheme-deep`, `.rv-scheme-ink`, `.rv-scheme-bone`) | Semantic re-declarations only |
| `app/globals.css` | `@import` of the three above, plus the Tailwind bridge | No values of its own |
| `app/layout.tsx` | Loads `globals.css` and the two `next/font` families (§3.1) | Renders no chrome |

### 1.2 Tailwind bridge

Target is Tailwind **4.x** with a CSS-first `@theme` block in `app/globals.css`. If the build must
remain on 3.4.x, the same variables are referenced from `tailwind.config.ts` `theme.extend`; the
token file is byte-identical either way and no value is ever duplicated into the config.

```css
/* app/globals.css — Tailwind 4.x */
@import "./styles/tokens.css";
@import "./styles/scheme.css";
@import "./styles/base.css";
@import "tailwindcss";

@theme inline {
  --color-surface:            var(--rv-surface-ground);
  --color-surface-raised:     var(--rv-surface-raised);
  --color-surface-sunken:     var(--rv-surface-sunken);
  --color-surface-accent:     var(--rv-surface-accent);
  --color-ink:                var(--rv-ink-primary);
  --color-ink-secondary:      var(--rv-ink-secondary);
  --color-ink-tertiary:       var(--rv-ink-tertiary);
  --color-ink-disabled:       var(--rv-ink-disabled);
  --color-ink-accent:         var(--rv-ink-accent);
  --color-ink-on-accent:      var(--rv-ink-on-accent);
  --color-line:               var(--rv-line-subtle);
  --color-line-strong:        var(--rv-line-strong);

  --font-display:             var(--rv-font-display);
  --font-sans:                var(--rv-font-body);
  --font-mono:                var(--rv-font-mono);

  --spacing:                  var(--rv-space-1);   /* 4px base unit */

  --radius-sm:                var(--rv-radius-sm);
  --radius-md:                var(--rv-radius-md);
  --radius-lg:                var(--rv-radius-lg);
  --radius-xl:                var(--rv-radius-xl);

  --breakpoint-sm:            26.875rem;  /* 430 */
  --breakpoint-md:            48rem;      /* 768 */
  --breakpoint-lg:            64rem;      /* 1024 */
  --breakpoint-xl:            80rem;      /* 1280 */
  --breakpoint-2xl:           90rem;      /* 1440 */
  --breakpoint-3xl:           120rem;     /* 1920 */

  --ease-standard:            var(--rv-ease-standard);
  --ease-out-expo:            var(--rv-ease-out);
  --ease-flow:                var(--rv-ease-flow);
}
```

Utilities are then written as `bg-surface-raised`, `text-ink-secondary`, `font-display`,
`rounded-md`, `p-6`. A component never writes `bg-[#08283A]`; `check-tokens.mjs` rejects it.

---

## 2. Colour

### 2.1 Where the palette comes from

The palette is not invented. Every base colour below is read out of the prompt corpus in
`data/higgsfield/asset-manifest.json` — the recipe the 250 existing assets (224 images, 26 videos)
were generated against. Building the interface on any other palette would put the interface at odds
with every photograph in it.

| Token | Hex | Evidence in the manifest |
|---|---|---|
| `--rv-color-obsidian` | `#080A0E` | Named in 114 prompts |
| `--rv-color-ocean` | `#08283A` | Named in 114 prompts |
| `--rv-color-sapphire` | `#164E6B` | Named in 114 prompts |
| `--rv-color-champagne` | `#B89B63` | Named in 114 prompts ("muted champagne gold") |
| `--rv-color-sapphire-bright` | `#0F52BA` | Named in 61 prompts |
| `--rv-color-slate-deep` | `#0E3A53` | Named in 61 prompts |
| `--rv-color-gold-bright` | `#D4AF37` | Named in 70 prompts |
| `--rv-color-bone` | `#FAF9F5` | Named in 2 prompts; adopted as the light ground |

Adding a **new** base colour requires an entry in this section with its justification and a
reviewer sign-off recorded in `COMPONENT_REGISTRY.md`. Three greys that mean the same thing is the
failure mode this rule exists to prevent.

### 2.2 The neutral ramp — generated, not chosen

Neutrals are generated, so that no one ever hand-picks a fourth grey. The rule, which
`scripts/design/check-tokens.mjs` re-derives and compares against the file:

> Convert `--rv-color-obsidian` and `--rv-color-bone` to OKLab. Produce ten steps by linear
> interpolation of `L`, `a` and `b` at `t = i / 9` for `i` in `0…9`. Convert back to sRGB and round
> to the nearest 8-bit hex. Step `900` is obsidian; step `50` is bone.

| Token | Hex | OKLab L | Relative luminance |
|---|---|---|---|
| `--rv-neutral-900` | `#080A0E` | 0.1443 | 0.0030 |
| `--rv-neutral-800` | `#1D1F22` | 0.2374 | 0.0136 |
| `--rv-neutral-700` | `#343639` | 0.3304 | 0.0366 |
| `--rv-neutral-600` | `#4C4E50` | 0.4235 | 0.0756 |
| `--rv-neutral-500` | `#67686A` | 0.5165 | 0.1382 |
| `--rv-neutral-400` | `#828384` | 0.6096 | 0.2264 |
| `--rv-neutral-300` | `#9F9F9F` | 0.7026 | 0.3467 |
| `--rv-neutral-200` | `#BCBCBB` | 0.7957 | 0.5025 |
| `--rv-neutral-100` | `#DBDAD7` | 0.8887 | 0.7011 |
| `--rv-neutral-50` | `#FAF9F5` | 0.9818 | 0.9467 |

The last column is the WCAG 2.x sRGB relative luminance of the rounded hex, to four decimal
places. It is recorded so every ratio in §2.6–§2.9 can be re-derived from this document alone;
`check-tokens.mjs` recomputes it from the hex and fails on a mismatch. Do not hand-edit it.

### 2.3 Derived surfaces and inks — also generated

Elevation on a near-black ground cannot be expressed with a shadow; it is expressed by lifting the
surface. Each derived value below is the named base colour with its OKLab `L` raised or lowered by
the stated amount, chroma and hue unchanged.

| Token | Hex | Derivation |
|---|---|---|
| `--rv-color-ocean-raised` | `#153346` | ocean, `L + 0.045` |
| `--rv-color-ocean-raised-2` | `#1F3E51` | ocean, `L + 0.085` |
| `--rv-color-ocean-line` | `#32444F` | ocean, `L + 0.130` |
| `--rv-color-obsidian-raised` | `#14161A` | obsidian, `L + 0.055` |
| `--rv-color-obsidian-raised-2` | `#1D1F22` | Aliases `--rv-neutral-800`, ramp step 800 (OKLab `L` 0.2374, i.e. obsidian `L + 0.093`). Named rather than borrowed so INK's second raised surface has a token of its own and appears in the §2.6 pairings table |
| `--rv-color-obsidian-line` | `#2E3035` | obsidian, `L + 0.130` |
| `--rv-color-steel` | `#79868E` | ocean hue, chroma 0.020, `L` solved for ≥ 3:1 on **every** DEEP and INK surface — the binding case is ocean-raised-2 at 3.01 (§2.6) |
| `--rv-color-bone-raised` | `#F3F2EE` | bone, `L − 0.020` |
| `--rv-color-bone-sunken` | `#EEEDE9` | bone, `L − 0.035` |
| `--rv-color-bone-well` | `#E9E8E4` | bone, `L − 0.050` |
| `--rv-color-champagne-deep` | `#83672F` | champagne hue and chroma, `L` solved for ≥ 5:1 on bone |

`--rv-color-champagne-deep` exists for one reason, stated plainly because it is the single most
important accessibility fact in this palette: **champagne `#B89B63` on bone `#FAF9F5` is 2.52:1 and
fails WCAG AA for any text size.** On light grounds the accent ink is `--rv-color-champagne-deep`
(5.05:1). See §2.8.

### 2.4 Colour schemes

Three schemes. They are the permitted values of `page_sections.theme` and of the Studio shell's
root class. A component never asks which scheme it is in; it reads semantic tokens.

| Scheme | Class | Ground | Where it is used |
|---|---|---|---|
| `DEEP` | `.rv-scheme-deep` | `--rv-color-ocean` `#08283A` | Public site default. Every page shell, most sections |
| `INK` | `.rv-scheme-ink` | `--rv-color-obsidian` `#080A0E` | Cinematic sections: hero, material sequence, lightbox, 3D viewer, video bands |
| `BONE` | `.rv-scheme-bone` | `--rv-color-bone` `#FAF9F5` | Long-form reading (journal body, FAQ, legal), all forms with more than four fields, and the whole of Studio |

Rules:

- `page_sections.theme` is a Zod enum of exactly `DEEP · INK · BONE`. A row with any other value
  fails validation in `content/blocks/<type>.ts` and renders `DEEP`.
- `app/(site)/layout.tsx` sets `.rv-scheme-deep` on `<body>`. `app/(studio)/studio/layout.tsx` sets
  `.rv-scheme-bone`. A section sets its own class on its outermost element.
- Adjacent sections may not both be `INK` unless they are one continuous cinematic passage; two
  black bands with a seam between them read as a rendering fault.
- Scheme switching is a class change only. It never re-mounts a component and never animates.
- There is **no user-facing light/dark toggle.** The scheme is an editorial decision made per
  section in Studio. `prefers-color-scheme` is not consulted; the site's ground is part of the
  brand, and honouring the OS preference would invert half the photography.

### 2.5 Semantic tokens

Every scheme defines the same names. This is the complete list; there are no others.

| Semantic token | Role | DEEP | INK | BONE |
|---|---|---|---|---|
| `--rv-surface-ground` | Page/section ground | `#08283A` | `#080A0E` | `#FAF9F5` |
| `--rv-surface-raised` | Cards, panels, menus, inputs | `#153346` | `#14161A` | `#F3F2EE` |
| `--rv-surface-raised-2` | Nested surface inside a raised one | `#1F3E51` | `#1D1F22` | `#EEEDE9` |
| `--rv-surface-sunken` | Wells, code, table header, empty media | `#080A0E` | `#000000` | `#E9E8E4` |
| `--rv-surface-accent` | Accent fill (primary button, active pill) | `#B89B63` | `#B89B63` | `#164E6B` |
| `--rv-surface-inverse` | The opposite ground, for inverted cards | `#FAF9F5` | `#FAF9F5` | `#08283A` |
| `--rv-ink-primary` | Headings, body, table cells | `#FAF9F5` | `#FAF9F5` | `#080A0E` |
| `--rv-ink-secondary` | Supporting copy, descriptions | `#BCBCBB` | `#BCBCBB` | `#343639` |
| `--rv-ink-tertiary` | Metadata, captions, helper text | `#9F9F9F` | `#9F9F9F` | `#4C4E50` |
| `--rv-ink-disabled` | Inactive control text | `#828384` | `#828384` | `#67686A` |
| `--rv-ink-accent` | `heading_highlight`, links, accent labels | `#B89B63` | `#D4AF37` | `#83672F` |
| `--rv-ink-on-accent` | Text on `--rv-surface-accent` | `#080A0E` | `#080A0E` | `#FAF9F5` |
| `--rv-ink-inverse` | Text on `--rv-surface-inverse` | `#080A0E` | `#080A0E` | `#FAF9F5` |
| `--rv-line-subtle` | Decorative rules, card edges | `#32444F` | `#2E3035` | `#DBDAD7` |
| `--rv-line-strong` | Control borders, focus-adjacent edges | `#79868E` | `#79868E` | `#828384` |
| `--rv-focus-ring` | `:focus-visible` ring | `#B89B63` | `#D4AF37` | `#164E6B` |
| `--rv-scrim` | Overlay behind dialogs and lightboxes | `rgb(8 10 14 / 0.78)` | `rgb(8 10 14 / 0.86)` | `rgb(8 10 14 / 0.62)` |
| `--rv-media-veil` | Gradient over media carrying text | `linear-gradient(to top, rgb(8 10 14 / 0.86) 0%, rgb(8 10 14 / 0.55) 38%, rgb(8 10 14 / 0) 78%)` | same | same |

`--rv-surface-sunken` in `INK` is the one place pure `#000000` is permitted, and only as a media
well behind a letterboxed asset. It is never a text ground.

Two of these cells resolve through a token added for the purpose rather than through a ramp step:
INK's `--rv-surface-raised-2` `#1D1F22` is `var(--rv-color-obsidian-raised-2)` (§2.3), not a bare
`var(--rv-neutral-800)`, so that it appears in §2.6 under its own name; and DEEP's `--rv-ink-accent`
is stepped up to gold-bright on that same second raised surface (§2.6).

### 2.6 Permitted pairings — DEEP and INK

Measured with the WCAG 2.x relative-luminance formula. `AA` = ≥ 4.5:1, valid for any text.
`UI` = ≥ 3:1, valid for large text (≥ 24px regular or ≥ 18.66px semibold) and for non-text UI
boundaries only. `✗` = not permitted.

| Ink ↓ / Surface → | ocean `#08283A` | ocean-raised `#153346` | ocean-raised-2 `#1F3E51` | obsidian `#080A0E` | obsidian-raised `#14161A` | obsidian-raised-2 `#1D1F22` | sapphire `#164E6B` |
|---|---|---|---|---|---|---|---|
| bone `#FAF9F5` | 14.50 AA | 12.51 AA | 10.68 AA | 18.80 AA | 17.19 AA | 15.68 AA | 8.53 AA |
| neutral-200 `#BCBCBB` | 8.04 AA | 6.93 AA | 5.92 AA | 10.42 AA | 9.53 AA | 8.69 AA | 4.73 AA |
| neutral-300 `#9F9F9F` | 5.77 AA | 4.98 AA | 4.25 UI | 7.48 AA | 6.84 AA | 6.24 AA | 3.40 UI |
| neutral-400 `#828384` | 4.02 UI | 3.47 UI | 2.96 ✗ | 5.22 AA | 4.77 AA | 4.35 UI | 2.37 ✗ |
| champagne `#B89B63` | 5.75 AA | 4.96 AA | 4.24 UI | 7.46 AA | 6.82 AA | 6.22 AA | 3.38 UI |
| gold-bright `#D4AF37` | 7.26 AA | 6.27 AA | 5.35 AA | 9.42 AA | 8.61 AA | 7.86 AA | 4.27 UI |
| steel `#79868E` — *boundary only* | 4.08 UI | 3.52 UI | 3.01 UI | 5.30 AA | 4.84 AA | 4.42 UI | 2.40 ✗ |

Consequences that are easy to get wrong and are therefore stated as rules:

- On `--rv-surface-raised-2`, `--rv-ink-tertiary` steps up from neutral-300 to **neutral-200**.
  The scheme blocks do this automatically for `.rv-surface-raised-2` descendants; do not override it.
- **On `--rv-surface-raised-2` in DEEP, `--rv-ink-accent` steps up from champagne to
  `--rv-color-gold-bright` `#D4AF37`** (5.35 AA on `#1F3E51`, against champagne's 4.24 UI). Without
  the step-up an inline `TextLink` (§7.3) or a `heading_highlight` run (§3.5) inside a nested raised
  surface on a DEEP section would render accent ink below AA at body size. The scheme block in §2.11
  applies it automatically, exactly as the tertiary step-up above; do not override it. This mirrors
  §2.7's rule for BONE's well and chip surfaces — the two are the same problem on opposite grounds.
  INK needs no equivalent: its accent is already gold-bright, which is 7.86 AA on `#1D1F22`.
- `--rv-focus-ring` is **not** stepped up. It is a non-text boundary governed by WCAG 1.4.11, and
  champagne clears 3:1 on every deep surface including `ocean-raised-2` (4.24). One ring colour per
  scheme is the rule in §2.10 and it survives here.
- The **steel row is a boundary row, not an ink row.** `--rv-color-steel` is `--rv-line-strong` in
  DEEP and INK; it clears 1.4.11's 3:1 on every deep surface (lowest: 3.01 on `ocean-raised-2`) and
  is never used as a text colour. It is recorded here because §2 rule 3 admits no unmeasured
  pairing, and `check-contrast.mjs` asserts control borders as well as text.
- **Never put body text on `--rv-color-sapphire`** in any weight smaller than large. Sapphire is a
  fill for the BONE scheme's accent, and a decorative band on deep grounds, not a text ground.
  `bone` on sapphire (8.53) is the only AA-safe ink on it.
- `--rv-ink-disabled` at 4.02:1 on ocean and 3.47:1 on ocean-raised is below AA. This is deliberate
  and permitted: WCAG 1.4.3 exempts text in an inactive control. It still clears 3:1 everywhere it
  is used, which is more than the exemption requires.

### 2.7 Permitted pairings — BONE

| Ink ↓ / Surface → | bone `#FAF9F5` | bone-raised `#F3F2EE` | bone-sunken `#EEEDE9` | bone-well `#E9E8E4` | neutral-100 `#DBDAD7` |
|---|---|---|---|---|---|
| obsidian `#080A0E` | 18.80 AA | 17.68 AA | 16.91 AA | 16.16 AA | 14.17 AA |
| neutral-700 `#343639` | 11.50 AA | 10.82 AA | 10.35 AA | 9.88 AA | 8.67 AA |
| neutral-600 `#4C4E50` | 7.93 AA | 7.46 AA | 7.13 AA | 6.82 AA | 5.98 AA |
| neutral-500 `#67686A` | 5.29 AA | 4.98 AA | 4.76 AA | 4.55 AA | 3.99 UI |
| champagne-deep `#83672F` | 5.05 AA | 4.75 AA | 4.54 AA | 4.34 UI | 3.81 UI |
| sapphire `#164E6B` | 8.53 AA | 8.02 AA | 7.67 AA | 7.33 AA | 6.43 AA |
| ocean `#08283A` | 14.50 AA | 13.63 AA | 13.04 AA | 12.46 AA | 10.93 AA |
| neutral-400 `#828384` — *boundary only* | 3.61 UI | 3.39 UI | 3.24 UI | 3.10 UI | 2.72 ✗ |

`--rv-ink-accent` in BONE is `champagne-deep`. It clears AA on bone, bone-raised and bone-sunken, but
only `UI` on bone-well (4.34) and neutral-100 (3.81). **Those two are well and chip surfaces — table
headers, code blocks, disabled chips — and are not accent-text grounds.** Accent text on either uses
`--rv-color-sapphire` (7.33 / 6.43) instead.

`--rv-line-strong` in BONE is neutral-400. It clears 1.4.11's 3:1 on bone, bone-raised,
bone-sunken and bone-well, and **fails on neutral-100** (2.72) — which is why a control border is
never drawn on a neutral-100 chip ground. Like the steel row in §2.6 this is a boundary row: it
records a non-text pairing `check-contrast.mjs` asserts, not a permitted text colour.

### 2.8 Pairings that fail, and what to use instead

These are the traps. Each has been measured; each has a compliant replacement.

| Failing pairing | Ratio | Verdict | Use instead |
|---|---|---|---|
| champagne `#B89B63` on bone `#FAF9F5` | 2.52 | Fails AA and fails 3:1 | `--rv-color-champagne-deep` `#83672F` (5.05) |
| gold-bright `#D4AF37` on bone | 2.00 | Fails everything | `--rv-color-champagne-deep` (5.05) |
| bone on champagne `#B89B63` | 2.52 | Fails | Obsidian on champagne (7.46). Accent buttons carry **dark** ink |
| sapphire-bright `#0F52BA` on ocean | 2.14 | Fails | Sapphire-bright is a **BONE-only** accent (6.79 on bone) |
| neutral-500 `#67686A` on ocean | 2.74 | Fails | neutral-400 for disabled (4.02 UI), neutral-300 for text (5.77 AA) |
| neutral-400 `#828384` on ocean-raised-2 | 2.96 | Fails 3:1 by a hair | neutral-300 (4.25 UI) or neutral-200 (5.92 AA) |
| champagne on sapphire `#164E6B` | 3.38 | UI only — not body text | bone on sapphire (8.53) |
| `--rv-line-subtle` against its ground | 1.51 (deep) / 1.33 (bone) | Not a UI boundary | Decorative rules only. Any border that identifies a control uses `--rv-line-strong` |

`--rv-color-sapphire-bright` and `--rv-color-slate-deep` are retained as primitives because the
manifest names them and later work (charts, data visualisation, illustration) will want a second
blue. Neither has a semantic role in the DEEP or INK schemes today, and neither may acquire one
without a measured pairing added to §2.6.

### 2.9 State colours

The brand quartet cannot carry success/warning/danger/info: it has one hue family plus a metal.
Four functional hues are therefore added, each generated at the lightness that clears 4.6:1 on the
scheme's ground. Their justification is recorded here as §2.1 requires.

| State | On BONE (text/icon) | On DEEP + INK (text/icon) | Ratio (bone / ocean / obsidian) |
|---|---|---|---|
| `--rv-state-success` | `#2E804B` | `#4D9D66` | 4.63 / 4.60 / 5.97 |
| `--rv-state-warning` | `#9C6500` | `#BB8301` | 4.66 / 4.63 / 6.00 |
| `--rv-state-danger` | `#BF4C44` | `#E0695F` | 4.60 / 4.62 / 6.00 |
| `--rv-state-info` | `#2F77A5` | `#4D94C2` | 4.63 / 4.60 / 5.97 |

Soft state surfaces, for pills and inline notices:

| State | BONE surface | DEEP/INK surface | Ink on it | Ratio |
|---|---|---|---|---|
| success | `#E4F5E8` | `#132819` | `--rv-ink-primary` | 17.48 / 14.82 |
| warning | `#FBEEDB` | `#2F2004` | `--rv-ink-primary` | 17.31 / 15.00 |
| danger | `#FFE8E4` | `#381815` | `--rv-ink-primary` | 16.90 / 15.22 |
| info | `#E4F3FE` | `#122532` | `--rv-ink-primary` | 17.50 / 14.92 |

**The rule that matters more than the hues (WCAG 1.4.1):** state is never carried by colour alone.
Every status surface renders a text label, and where space is tight, a shape. `StatusPill` is a
soft state surface + a **1px border in the state colour** (≥ 4.1:1 against its own fill, ≥ 4.6:1
against the page ground) + the status word in `--rv-ink-primary`. Removing the word is not a
permitted variant.

Status mapping is fixed, because D5's enums are fixed:

| Value | State token | Applies to |
|---|---|---|
| `DRAFT` | neutral (`--rv-surface-raised-2` + `--rv-line-strong`) | `status` |
| `REVIEW` | `info` | `status` |
| `APPROVED` | `success` | `status` |
| `PUBLISHED` | `success`, filled variant | `status` |
| `ARCHIVED` | neutral, `--rv-ink-tertiary` | `status` |
| `OWNER_VERIFICATION_REQUIRED` | `warning` | `owner_verification` |
| `VERIFIED` | `success` | `owner_verification` |
| `NOT_REQUIRED` | neutral, low emphasis | `owner_verification` |

`OWNER_VERIFICATION_REQUIRED` is the highest-visibility non-error state in Studio. It appears in the
row, in the drawer header and in the publish dialog, because publishing such a row is refused
(Phase 08) and the editor must not discover that at the last click.

### 2.10 Focus ring

One token pair, redefined per scheme, honouring WCAG 2.4.11:

```
--rv-focus-ring-width:  2px;
--rv-focus-ring-offset: 2px;
--rv-focus-ring:        <scheme value>;
```

| Scheme | Ring | Against ground | Against raised |
|---|---|---|---|
| DEEP | `#B89B63` | 5.75 | 4.96 |
| INK | `#D4AF37` | 9.42 | 8.61 |
| BONE | `#164E6B` | 8.53 | 8.02 |

Implemented once in `app/styles/base.css` as
`:focus-visible { outline: var(--rv-focus-ring-width) solid var(--rv-focus-ring); outline-offset: var(--rv-focus-ring-offset); }`.
`outline: none` without a replacement is grep-blocked by `scripts/a11y/check-focus-styles.mjs`.
On media and on the accent fill the ring gains a second, inner `1px` `--rv-surface-ground` ring so
it survives on any photograph.

### 2.11 `tokens.css` — colour block

```css
:root {
  /* ---- primitive: brand (manifest evidence, §2.1) ---- */
  --rv-color-obsidian:        #080A0E;
  --rv-color-ocean:           #08283A;
  --rv-color-sapphire:        #164E6B;
  --rv-color-champagne:       #B89B63;
  --rv-color-sapphire-bright: #0F52BA;
  --rv-color-slate-deep:      #0E3A53;
  --rv-color-gold-bright:     #D4AF37;
  --rv-color-bone:            #FAF9F5;

  /* ---- primitive: generated neutrals (§2.2) ---- */
  --rv-neutral-900: #080A0E;  --rv-neutral-800: #1D1F22;
  --rv-neutral-700: #343639;  --rv-neutral-600: #4C4E50;
  --rv-neutral-500: #67686A;  --rv-neutral-400: #828384;
  --rv-neutral-300: #9F9F9F;  --rv-neutral-200: #BCBCBB;
  --rv-neutral-100: #DBDAD7;  --rv-neutral-50:  #FAF9F5;

  /* ---- primitive: generated surfaces and accents (§2.3) ---- */
  --rv-color-ocean-raised:    #153346;
  --rv-color-ocean-raised-2:  #1F3E51;
  --rv-color-ocean-line:      #32444F;
  --rv-color-obsidian-raised: #14161A;
  --rv-color-obsidian-raised-2: #1D1F22;
  --rv-color-obsidian-line:   #2E3035;
  --rv-color-steel:           #79868E;
  --rv-color-bone-raised:     #F3F2EE;
  --rv-color-bone-sunken:     #EEEDE9;
  --rv-color-bone-well:       #E9E8E4;
  --rv-color-champagne-deep:  #83672F;

  /* ---- primitive: state (§2.9) ---- */
  --rv-color-success-dark: #2E804B; --rv-color-success-light: #4D9D66;
  --rv-color-warning-dark: #9C6500; --rv-color-warning-light: #BB8301;
  --rv-color-danger-dark:  #BF4C44; --rv-color-danger-light:  #E0695F;
  --rv-color-info-dark:    #2F77A5; --rv-color-info-light:    #4D94C2;
  --rv-color-success-soft-light: #E4F5E8; --rv-color-success-soft-dark: #132819;
  --rv-color-warning-soft-light: #FBEEDB; --rv-color-warning-soft-dark: #2F2004;
  --rv-color-danger-soft-light:  #FFE8E4; --rv-color-danger-soft-dark:  #381815;
  --rv-color-info-soft-light:    #E4F3FE; --rv-color-info-soft-dark:    #122532;
}
```

```css
/* app/styles/scheme.css */
.rv-scheme-deep {
  --rv-surface-ground:    var(--rv-color-ocean);
  --rv-surface-raised:    var(--rv-color-ocean-raised);
  --rv-surface-raised-2:  var(--rv-color-ocean-raised-2);
  --rv-surface-sunken:    var(--rv-color-obsidian);
  --rv-surface-accent:    var(--rv-color-champagne);
  --rv-surface-inverse:   var(--rv-color-bone);
  --rv-ink-primary:       var(--rv-color-bone);
  --rv-ink-secondary:     var(--rv-neutral-200);
  --rv-ink-tertiary:      var(--rv-neutral-300);
  --rv-ink-disabled:      var(--rv-neutral-400);
  --rv-ink-accent:        var(--rv-color-champagne);
  --rv-ink-on-accent:     var(--rv-color-obsidian);
  --rv-ink-inverse:       var(--rv-color-obsidian);
  --rv-line-subtle:       var(--rv-color-ocean-line);
  --rv-line-strong:       var(--rv-color-steel);
  --rv-focus-ring:        var(--rv-color-champagne);
  --rv-scrim:             rgb(8 10 14 / 0.78);
  --rv-state-success:     var(--rv-color-success-light);
  --rv-state-warning:     var(--rv-color-warning-light);
  --rv-state-danger:      var(--rv-color-danger-light);
  --rv-state-info:        var(--rv-color-info-light);
}
/* .rv-scheme-ink and .rv-scheme-bone redeclare the same names, per §2.5.
   In .rv-scheme-ink, --rv-surface-raised-2 is var(--rv-color-obsidian-raised-2) — the token
   added in §2.3 — never a bare var(--rv-neutral-800). */

/* Nested raised surfaces: two automatic step-ups, both measured in §2.6. */
.rv-scheme-deep .rv-surface-raised-2,
.rv-scheme-ink  .rv-surface-raised-2 { --rv-ink-tertiary: var(--rv-neutral-200); }

/* DEEP only: champagne is 4.24 on ocean-raised-2 (UI), gold-bright is 5.35 (AA).
   INK's accent is already gold-bright, so it needs no rule. */
.rv-scheme-deep .rv-surface-raised-2 { --rv-ink-accent: var(--rv-color-gold-bright); }
```

These two blocks are the whole mechanism. A component nested inside a `--rv-surface-raised-2`
element keeps reading `--rv-ink-tertiary` and `--rv-ink-accent`; the values it receives are already
the compliant ones. No component tests which surface it is on, and no component may re-declare
either token to undo the step-up — `check-contrast.mjs` re-derives both pairings from `tokens.css`
and `scheme.css` and fails the build if either drops below its §2.6 threshold.

---

## 3. Typography

### 3.1 Families

**Two loaded families, plus a device-resident monospace stack.** The ceiling is not this document's
to set: `docs/ops/PERFORMANCE.md` §2.2 fixes it as `next/font`, self-hosted, subset to Latin, **at
most two families (one display, one text)**, `font-display: swap`, and **only the display face used
above the fold is preloaded**. This section is the design system's side of that rule and stays
inside it. Neither loaded family is requested at runtime: there is no call to a font CDN and no
`@import` from `fonts.googleapis.com`.

| Role | Token | Family | Licence | Loading |
|---|---|---|---|---|
| Display | `--rv-font-display` | Newsreader (variable, `opsz` 6–72, weight 200–800) | Expected SIL OFL 1.1 — **VERIFY_BEFORE_USE**, registry RC-901 | `next/font/google`, latin subset, `display: 'swap'`, **preloaded — the only preloaded face in the product** |
| Body / UI | `--rv-font-body` | Inter (variable, weight 100–900) | Expected SIL OFL 1.1 — **VERIFY_BEFORE_USE**, registry RC-902 | `next/font/google`, latin subset, `display: 'swap'`, **not preloaded** |
| Machine text | `--rv-font-mono` | The platform monospace stack. **No font file is loaded, hosted or fetched** | N/A — no font is shipped | None. A CSS stack resolved from faces already on the device |

The two licences are stated as *expected*, not verified. Each carries a `PENDING_AUDIT` row in
`COMPONENT_REGISTRY.md`; the licence file at the pinned version is read and the SPDX identifier
recorded before the font ships. A licence quoted from a specimen page is not a verified licence.
`--rv-font-mono` has no licence row because it ships no file.

**Decision — the third webfont is dropped.** An earlier revision of this section loaded IBM Plex
Mono as a third family for the `technical` role and preloaded two faces. Both exceeded
`docs/ops/PERFORMANCE.md` §2.2, which this document does not get to overrule. The conflict is
resolved in PERFORMANCE.md's favour and the consequences are recorded here rather than absorbed
quietly:

| Previously | Now | Why |
|---|---|---|
| IBM Plex Mono loaded as `--rv-font-technical` | Dropped. Registry **RC-903 is `REJECTED`** with the reason in `COMPONENT_REGISTRY.md` §8 | A third family breaks the two-family ceiling and buys one visual register |
| Eyebrows and technical labels set in a mono face | Body family, uppercase, `--rv-tracking-eyebrow` (0.14em) or `--rv-tracking-technical` (0.02em) | Uppercase plus wide tracking is what makes a technical label read as one. The face was never doing that work |
| Identifiers set in a loaded mono face | `--rv-font-mono`, the platform stack | Column alignment and glyph disambiguation are what identifiers need, and the device already has a face that does both — for zero bytes |
| Inter preloaded | **Not preloaded** | §2.2 permits one preload, and it belongs to the display face that sets the first heading |

The token `--rv-font-technical` no longer exists. A component that wants technical texture asks for
the `technical` or `eyebrow` type role (§3.5); a component rendering a machine identifier asks for
the `identifier` role, which is the only consumer of `--rv-font-mono`.

```css
--rv-font-display: "Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
--rv-font-body:    "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
--rv-font-mono:    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
                   "Liberation Mono", monospace;
```

Rules:

- **Total font payload ≤ 120 kB**, woff2, latin subset, across the two loaded faces, measured on the
  built output. **This budget is owned by this section.** `docs/ops/PERFORMANCE.md` §3 budgets
  per-route JavaScript and carries **no font line item today**, so do not cite it for a font number
  — cite this line. Adding the line item there is an open item recorded in §18.
- `--rv-font-mono` contributes **0 kB**. It downloads nothing, so it is outside both the payload
  budget and the two-family ceiling, which counts *loaded* families. This reading is recorded in §18
  for Phase 40 to confirm or overrule.
- `adjustFontFallback` stays on for both loaded families so the fallback metrics match and the swap
  costs no layout shift. The CLS budget is 0.05; fonts may not consume it.
- No italic is loaded for either family. Display italic is loaded only if and when a block schema
  needs it; today none does.
- The Rivya **wordmark and logo are owner-supplied assets**, not type set in one of these families.
  Until the owner provides them, the header renders the brand name from `global_content` in the
  display family. `OWNER_VERIFICATION_REQUIRED`.

### 3.2 Display scale — fluid

Fluid between 360px and 1440px viewport width; clamped at both ends. Every value is a token; a
component never writes a `clamp()` of its own.

| Token | 360px | 1440px | Value |
|---|---|---|---|
| `--rv-text-display-2xl` | 48px | 104px | `clamp(3rem, 1.833rem + 5.185vw, 6.5rem)` |
| `--rv-text-display-xl` | 40px | 76px | `clamp(2.5rem, 1.75rem + 3.333vw, 4.75rem)` |
| `--rv-text-display-lg` | 34px | 58px | `clamp(2.125rem, 1.625rem + 2.222vw, 3.625rem)` |
| `--rv-text-display-md` | 28px | 44px | `clamp(1.75rem, 1.417rem + 1.481vw, 2.75rem)` |
| `--rv-text-display-sm` | 24px | 34px | `clamp(1.5rem, 1.292rem + 0.926vw, 2.125rem)` |
| `--rv-text-display-xs` | 20px | 26px | `clamp(1.25rem, 1.125rem + 0.556vw, 1.625rem)` |

Above 1440px the display scale is frozen. A 1920px viewport gets more white space, not bigger type
— the container widens, the headline does not (§5.3).

### 3.3 Body and technical scale — fixed

| Token | Size | Line height | Use |
|---|---|---|---|
| `--rv-text-xl` | 1.5rem / 24px | 1.45 | Lead paragraph under a display heading |
| `--rv-text-lg` | 1.25rem / 20px | 1.55 | Section body, `supporting` copy |
| `--rv-text-md` | 1.125rem / 18px | 1.6 | Journal article body |
| `--rv-text-base` | 1rem / 16px | 1.6 | Default body, form inputs, table cells |
| `--rv-text-sm` | 0.875rem / 14px | 1.5 | Helper text, captions, Studio dense tables |
| `--rv-text-xs` | 0.75rem / 12px | 1.4 | Badges, chips, table column heads |
| `--rv-text-2xs` | 0.6875rem / 11px | 1.35 | Absolute floor. Uppercase, letter-spaced labels only |

`--rv-text-2xs` is the smallest size in the system and may be used only for uppercase,
letter-spaced labels at `--rv-tracking-eyebrow`, where the tracking is what keeps the letterforms
apart. Never for sentence-case prose, and never in `--rv-font-mono`, whose glyphs are already
wide enough. Form inputs are never below `--rv-text-base` on touch viewports — 16px is what stops iOS Safari zooming on focus.

### 3.4 Weights, tracking and line heights

| Token | Value | Applied to |
|---|---|---|
| `--rv-weight-display` | 400 | Display headings. The brand voice is calm; a 700-weight serif is not |
| `--rv-weight-display-strong` | 500 | `heading_highlight` runs inside a display heading |
| `--rv-weight-body` | 400 | Body |
| `--rv-weight-medium` | 500 | Buttons, table heads, active nav |
| `--rv-weight-strong` | 600 | The heaviest weight in the system. Inline `<strong>`, KPI values |
| `--rv-leading-display` | 1.06 | display-2xl / xl |
| `--rv-leading-heading` | 1.14 | display-lg / md / sm / xs |
| `--rv-leading-body` | 1.6 | Prose |
| `--rv-leading-tight` | 1.35 | Cards, table cells, compact UI |
| `--rv-tracking-display` | -0.02em | display-2xl / xl |
| `--rv-tracking-heading` | -0.01em | display-lg / md |
| `--rv-tracking-body` | 0 | Everything else |
| `--rv-tracking-eyebrow` | 0.14em | Uppercase eyebrows |
| `--rv-tracking-technical` | 0.02em | Sentence-case technical labels — unit suffixes, metadata keys |
| `--rv-measure-narrow` | 46ch | Pull quotes, captions |
| `--rv-measure-prose` | 68ch | All body copy. Hard maximum |
| `--rv-measure-wide` | 84ch | Studio descriptions, table cell wrapping |

### 3.5 Semantic type roles

Components use roles, not sizes. `<Heading level={2} role="section" />` — the visual size and the
DOM level are separate props, because Phase 41 requires the heading level to be the level the block
declares, not the level that looks right.

| Role | Family | Size | Weight | Tracking | Typical element |
|---|---|---|---|---|---|
| `hero` | display | display-2xl | 400 | -0.02em | `h1` on `/`, `/large-format` |
| `page` | display | display-xl | 400 | -0.02em | `h1` elsewhere |
| `section` | display | display-lg | 400 | -0.01em | `h2` from `section.heading` |
| `subsection` | display | display-md | 400 | -0.01em | `h3` |
| `card` | display | display-xs | 400 | 0 | Card titles |
| `card-compact` | body | text-lg | 500 | 0 | Dense grid card titles, Studio |
| `eyebrow` | body | text-2xs → text-xs | 500 | 0.14em, uppercase | `section.eyebrow` |
| `lead` | body | text-xl | 400 | 0 | `section.supporting` under a hero |
| `body` | body | text-base / text-md | 400 | 0 | `section.body` |
| `caption` | body | text-sm | 400 | 0 | Media captions, alt-text notes |
| `technical` | body | text-sm | 400 | 0.02em | Unit suffixes, dimension labels, metadata keys |
| `identifier` | mono | text-sm | 400 | 0 | SKUs, `rivya_asset_id`, `higgsfield_generation_id`, hex values, commit SHAs, cron expressions |
| `label` | body | text-sm | 500 | 0 | Form labels, table heads |

`identifier` is the only role that reads `--rv-font-mono`, and it is the only role whose text is a
machine value rather than prose. Everything a visitor reads is set in one of the two loaded
families.

`heading_highlight` (a real `page_sections` column) renders as a `<span>` inside the heading, in
`--rv-ink-accent` at `--rv-weight-display-strong`. It never becomes a separate heading element, and
its accent colour is never the only thing distinguishing it — the weight change carries it too.
Inside a `--rv-surface-raised-2` element on a DEEP section the accent it inherits is already the
stepped-up gold-bright (§2.6); the component does nothing to arrange that and must not override it.

### 3.6 Numerals

| Context | Rule |
|---|---|
| Data tables, KPI values, any column of numbers | Body family with `font-variant-numeric: tabular-nums` |
| Prices and price labels (SEED §30) | Body family, `tabular-nums`. The label ("From", "Price on Request") is `--rv-text-sm`, never smaller than the number it qualifies |
| Identifiers — SKU, `rivya_asset_id`, `higgsfield_generation_id`, commit SHA, cron | `identifier` role: `--rv-font-mono`, `--rv-text-sm`, selectable, `user-select: all` on click targets |
| Dimensions in a customization form (SEED §33–§35 spelling) | Body family, `tabular-nums`, unit rendered as a separate suffix element, never typed into the value |
| Step numbers in `process-steps` / `numbered-steps` | Display family at `display-md`, `--rv-ink-accent`, `aria-hidden` when the step also has a real heading |

---

## 4. Motion — the material experience as tokens

FEAT §4 names the creative concept: **WOOD → RESIN → LIGHT → FORM → SPACE → ART**. That is not a
mood board here; each of the six is a named motion class with a duration, a curve, a distance
ceiling and a reduced-motion branch. A component picks a class. It does not pick a number.

### 4.1 Duration and easing tokens

| Token | Value | Class |
|---|---|---|
| `--rv-duration-instant` | `0ms` | State that must feel mechanical (checkbox tick, tab switch) |
| `--rv-duration-fast` | `120ms` | LIGHT |
| `--rv-duration-quick` | `180ms` | LIGHT |
| `--rv-duration-base` | `240ms` | FORM |
| `--rv-duration-slow` | `360ms` | WOOD |
| `--rv-duration-slower` | `560ms` | SPACE |
| `--rv-duration-flow` | `720ms` | RESIN |
| `--rv-duration-scene` | `900ms` | ART. **The ceiling. Nothing in this product animates longer.** |

| Token | Curve | Character |
|---|---|---|
| `--rv-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default for anything that moves between two states |
| `--rv-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances; fast then settles |
| `--rv-ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits only |
| `--rv-ease-flow` | `cubic-bezier(0.65, 0, 0.35, 1)` | Viscous, symmetrical — resin |
| `--rv-ease-settle` | `cubic-bezier(0.34, 1.16, 0.64, 1)` | Slight overshoot. **Permitted only on travel ≤ 8px** |
| `--rv-ease-linear` | `linear` | Opacity-only crossfades, progress, spinners |

| Token | Value | Meaning |
|---|---|---|
| `--rv-motion-rise-sm` | `8px` | Micro-entrance |
| `--rv-motion-rise-md` | `16px` | Standard reveal travel |
| `--rv-motion-rise-lg` | `24px` | Maximum reveal travel. Nothing rises further |
| `--rv-motion-parallax-max` | `24px` | Total parallax displacement, at any viewport |
| `--rv-motion-stagger` | `60ms` | Per-item delay in a group |
| `--rv-motion-stagger-max` | `6` | Items that may stagger. Item 7 onward shares item 6's delay |
| `--rv-motion-scale-in` | `1.015` | Maximum scale change on a media hover |

### 4.2 The six classes

| Class | What it governs | Tokens | Hard limits | Reduced-motion branch |
|---|---|---|---|---|
| **WOOD** — settle | First appearance of static content: headings, paragraphs, list items, cards entering the viewport | `--rv-duration-slow`, `--rv-ease-out`, `--rv-motion-rise-md`, stagger 60ms | Opacity + `translateY` only. No scale, no blur, no rotation. Runs **once** per element per page view | Renders in final position, fully opaque, no transition |
| **RESIN** — flow | Media revealing: hero stills, gallery images, the material sequence, image crossfades | `--rv-duration-flow`, `--rv-ease-flow` | Opacity and `clip-path` inset only. Never a scale on a photograph larger than `--rv-motion-scale-in` | Image is simply present |
| **LIGHT** — specular | Hover, focus, active. Anything that answers a pointer or a key within one frame budget | `--rv-duration-fast`/`quick`, `--rv-ease-standard` | Colour, border, opacity, `box-shadow`. No layout property, ever | Colour changes still apply; they are not motion |
| **FORM** — mass | Things with weight: drawers, dialogs, mega-menu panels, accordions, mobile nav | `--rv-duration-base`, `--rv-ease-out` in / `--rv-ease-in` out, `--rv-motion-rise-md` | Transform + opacity. Height animation only via `grid-template-rows` or `interpolate-size`, never JS-measured pixels | Appears and disappears instantly; focus management is unchanged |
| **SPACE** — depth | Scroll-linked depth: hero media drift, section ground shifts, sticky chapter media | `--rv-duration-slower`, `--rv-motion-parallax-max` | ≤ 24px total travel; `transform` only; disabled below 768px; never on text; never scroll-jacking — the page scroll is observed, never captured | Nothing moves. No listener is attached |
| **ART** — the held moment | The one deliberate transition per page: hero entrance, lightbox open, 3D viewer reveal | `--rv-duration-scene`, `--rv-ease-flow` | **At most one ART transition may run per viewport per page**. Never blocks input; never delays LCP | Static composition, immediately complete |

Three cross-cutting rules:

- **Motion never gates content.** Every element animated by WOOD or RESIN is present, laid out and
  readable in the server-rendered HTML. Reveal changes opacity from an already-painted element; it
  never mounts it. A page with JavaScript disabled is complete.
- **Motion never moves the LCP element.** The hero still is painted at its final position. The
  motion layer mounts *after* first paint (`components/patterns/HeroMotion.tsx`).
- **Motion never animates a layout property.** `width`, `height`, `top`, `left`, `margin` and
  `padding` are not animatable in this system. Compositor properties only: `transform`, `opacity`,
  `filter`, `clip-path`, plus colour on paint-only properties.

#### 4.2.1 Where WOOD actually lives: `app/styles/motion.css`

`Reveal` (RC-207) was built in Phase 02 to carry the WOOD entrance and, until the editorial
redesign, **no section used it** — `grep` found it imported by `Tooltip`, `DropdownMenu` and
`Accordion` and by not one renderer. Every CMS band on the public site appeared instantly, fully
formed, with no entrance at all.

That was not an oversight so much as an impossibility. A section renderer may never be a Client
Component (`scripts/site/check-client-boundary.mjs`), and `components/sections/registry.ts` imports
every renderer — so one static import of a client component is an island on all sixteen CMS routes.
`Reveal` was correct and unusable at the same time.

A scroll-driven CSS animation has neither problem: it hydrates nothing, it is in no bundle, and the
renderer stays a Server Component that adds one class name.

| Class | Applied to | Range |
|---|---|---|
| `.rv-reveal` | every band, by `SectionShell` | `entry 0% cover 30%` |
| `.rv-reveal-fade` | media-led bands wanting opacity alone | `entry 0% cover 25%` |
| `.rv-reveal-group > *` | card grids — `CategoryGrid`, `MaterialPalette`, `SecondaryObjects`, `ReferenceCards` | `entry 0% cover 25%` |

Four rules make it safe, and each is a way the file could otherwise strand a band at `opacity: 0`:

1. **The unanimated state is the finished state.** No `animation-name` is declared outside the
   `@supports (animation-timeline: view())` block, so a browser without scroll timelines renders
   the band exactly as it did before the file existed. This is what §4.2's "motion never gates
   content" means in CSS, and it is the same argument `Reveal` makes in JavaScript.
2. **Reduced motion is suppressed here, not inherited.** The floor in `base.css` sets
   `animation-duration: 0.01ms !important` — a *time* duration. A `view()` timeline is driven by
   scroll progress, so that floor aims at a different instrument and cannot be relied on to land
   the animation at its end state. Each class carries its own `animation: none`.
3. **The first band never animates.** It holds the LCP element, and §4.2's second cross-cutting
   rule forbids moving it. Expressed as `main > section:first-of-type.rv-reveal`, because sections
   are direct children of `<main>` — threading `isFirst` in from twenty-seven call sites would put
   one rule in twenty-seven places.
4. **A band either arrives as one thing or its children do.** `.rv-reveal:has(.rv-reveal-group)`
   cancels the parent, so a grid several components down cannot make its cards travel twice the
   distance the token allows.

`tests/unit/motion-layer.test.ts` asserts all four against the stylesheet text, because jsdom
implements no scroll timeline and drops the three properties that matter.

### 4.3 Reduced-motion contract

`prefers-reduced-motion: reduce` selects a **static branch**, not a shortened animation. Phase 02's
risk register says this in one line and it is the whole contract: a reduced-motion user sees the
finished composition, not a faster version of the journey to it.

The contract has four parts and all four must hold.

1. **The CSS floor.** `app/styles/base.css` carries:

   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```

   This is a safety net for anything that slips through, not the mechanism.

2. **The single source.** `components/primitives/motion/useReducedMotion.ts` exports
   `useReducedMotion(): boolean`, backed by one `matchMedia('(prefers-reduced-motion: reduce)')`
   listener. Every client component that animates reads this hook. There is no second
   implementation, and no component reads `matchMedia` directly.

3. **The branch, not the speed.** When the hook returns `true`:

   | Subject | Behaviour |
   |---|---|
   | `Reveal` | Renders children with no wrapper transition and no `IntersectionObserver` |
   | Parallax / SPACE | No scroll listener is attached at all |
   | `MaterialSequence` | Renders the complete static list of stages, all reachable by `Tab` |
   | Video (`MediaVideo`) | **No `<video>` element mounts.** The poster renders with a visible play control; pressing it plays with controls |
   | Carousel / slider | Auto-advance never starts; slides change instantly on activation |
   | Lightbox, dialog, drawer | Open and close instantly; focus movement and trapping are unchanged |
   | 3D viewer | No auto-rotate, no intro animation, no idle motion; poster plus an explicit control |
   | Skeletons | Static block at `--rv-surface-raised-2`; no shimmer |
   | Toasts | Appear without slide; the auto-dismiss timer is unchanged |

4. **The proof.** `tests/e2e/a11y/reduced-motion.spec.ts` and `tests/e2e/homepage-motion.spec.ts`
   run the suite under `prefers-reduced-motion: reduce` and assert that no `transform` or `opacity`
   transition is applied and that no `<video>` element exists in the document.

Additional gates that suppress motion independently of the media query, because a preference is not
the only reason to hold back: `navigator.connection.saveData === true`, viewport width < 768px for
SPACE, and `deviceMemory < 4` for the 3D viewer.

---

## 5. Space, grid and layout

### 5.1 Spacing

4px base. Twenty-one steps, `--rv-space-0` through `--rv-space-20`, where step `n` = `n × 4px`
expressed in `rem`. There are no half-steps and no negative spacing tokens.

| Step | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 |

Vertical section rhythm is fluid and separate, because 80px is not enough air between two sections
on a 1920px screen:

| Token | 360px | 1440px | Value |
|---|---|---|---|
| `--rv-section-y-sm` | 48px | 72px | `clamp(3rem, 2.5rem + 2.222vw, 4.5rem)` |
| `--rv-section-y-md` | 72px | 112px | `clamp(4.5rem, 3.667rem + 3.704vw, 7rem)` |
| `--rv-section-y-lg` | 96px | 160px | `clamp(6rem, 4.667rem + 5.926vw, 10rem)` |
| `--rv-section-y-xl` | 128px | 200px | `clamp(8rem, 6.5rem + 6.667vw, 12.5rem)` |

`<Section>` takes `spacing="sm" | "md" | "lg" | "xl"`, defaulting to `lg`. Two adjacent sections in
the same scheme collapse to the larger of the two paddings; they do not sum.

**Which step a band gets is a property of its block type, not of a call site.** `SECTION_RHYTHM` in
`components/sections/SectionShell.tsx` is a `Record<BlockType, SectionSpacing>` — exhaustive over
all thirty-four, so a block cannot arrive later and inherit a default nobody chose. The four steps
carry editorial intent rather than sizes:

| Step | What it is for | Blocks |
|---|---|---|
| `xl` | The held moment — earns its weight from what is *not* around it | `manifesto`, `statement`, `scale-statement`, `material-story`, `signature-media`, `commission-cta`, `final-cta`, `quote` |
| `lg` | The working rhythm — substantial bands read one after another | galleries, grids, process, products, configurator, contact form |
| `md` | The sentence above a list — belongs to its neighbour | `category-intro`, `journal-strip`, `secondary-objects`, `testimonial-strip`, `faq-list`, `rich-text` |
| `sm` | Connective tissue — present, not announced | `hero`, `customization-note`, `empty-state`, `divider` |

A renderer may override with a stated reason, and two do: `divider` reads its step from its own
payload, because the size of a gap is exactly what an editor places one to choose; `hero` picks by
layout variant, because a full-bleed hero is meant to meet the header and a contained one is not.

This replaces the state the audit found. Twenty-seven of thirty call sites passed `spacing="lg"`,
so `sm` and `xl` were tokens nothing referenced and ten consecutive bands on `/` were spaced
identically — §50 asks for deliberate negative space, and uniform padding is the opposite of a
decision. `tests/unit/section-rhythm.test.tsx` asserts the shape rather than the values: every
block type has an answer, and all four steps are in use.

#### 5.1.1 The hero floor

| Token | Value |
|---|---|
| `--rv-hero-min-h` | `76svh` |

A hero is an `AspectBox`, so before this token its height was width ÷ ratio and nothing else.
Measured across the eight QA widths its share of the viewport ran 91 · 69 · 61 · 49 · 37 · 91 · 82 ·
76 % — at 768 the opening image of the site held barely a third of the screen, and the ≥ 70 % FEAT
§49 question 2 asks for was met or missed by accident of viewport aspect. §19.1 records that as the
finding rather than the one missing point.

It is a **floor, not a height**: the box still takes its aspect ratio and renders at whichever is
taller, so the wide viewports that already give a commanding 21:9 keep it — 1920 stays at 91 % — and
only the middle band is lifted. One number does that at every width.

`svh` rather than `vh`, deliberately: `vh` on a phone is the height with the browser chrome
retracted, so a `vh` floor is taller than the screen until the visitor scrolls, and the hero would
push its own copy under the address bar on first paint.

It costs no layout shift. Both the ratio and the floor are known before any byte of the image
arrives, so the box reserves its final size on the server exactly as the ratio alone did.

It reaches the frame as `AspectBoxProps.minBlockSize`, a raw token value applied as an inline style
— the way `Section` already sets its rhythm and `Container` its maxima. It cannot be a class:
`min-h-[76svh]` is an arbitrary value, which `scripts/design/check-tokens.mjs` refuses outright, and
a `min-h-hero` utility would put a layout decision in the theme bridge where no other section
measurement lives. Only the **first** section on a page receives it.

### 5.2 Breakpoints

Exactly the FEAT §45 visual QA matrix, plus 360 as the base. Mobile-first: no `max-width` queries.

| Token | Width | QA width it represents |
|---|---|---|
| (base) | 360px | 360 |
| `--rv-bp-sm` | 430px | 390, 430 |
| `--rv-bp-md` | 768px | 768 |
| `--rv-bp-lg` | 1024px | 1024 |
| `--rv-bp-xl` | 1280px | 1280 |
| `--rv-bp-2xl` | 1440px | 1440 |
| `--rv-bp-3xl` | 1920px | 1920 |

`tests/e2e/design-system.spec.ts` snapshots the gallery at all eight QA widths. A component that
looks correct at 1440 and broken at 1280 is a failing component, not a failing viewport.

### 5.3 Containers and gutters

| Token | Width | Use |
|---|---|---|
| `--rv-container-prose` | 44rem / 704px | Journal body, legal pages, single-column forms |
| `--rv-container-default` | 75rem / 1200px | Most sections, product grids, Studio content |
| `--rv-container-wide` | 90rem / 1440px | Gallery grids, portfolio, large-format catalogue |
| `--rv-container-full` | 120rem / 1920px | Full-bleed media bands. Content inside still uses a narrower container |
| `--rv-gutter` | `clamp(1.25rem, 0.333rem + 4.074vw, 4rem)` | 20px at 360, 64px at 1440+ |

`<Container>` takes `size="prose" | "default" | "wide" | "full"` and applies
`margin-inline: auto; padding-inline: var(--rv-gutter)`. Full-bleed media is achieved by a
`full` container, never by negative margins.

**`--container-full` is deliberately NOT bridged into Tailwind's `@theme`** (amendment A12).
Tailwind v4 reads the `--container-*` namespace for `w-*` as well as `max-w-*`, so bridging `full`
redefined `w-full` — a built-in utility meaning `width: 100%` — as 120rem, and every media frame in
the product was 1920px wide inside whatever column contained it. `prose`, `default` and `wide` stay
bridged because they collide with no built-in utility. A surface that wants the 120rem bound writes
`max-w-(--rv-container-full)`; `<Container size="full">` sets it from the raw token as an inline
style and never depended on the bridge.

### 5.4 Grid

| Viewport | Columns | Gap |
|---|---|---|
| < 768px | 4 | `--rv-space-4` (16px) |
| 768–1023px | 8 | `--rv-space-6` (24px) |
| ≥ 1024px | 12 | `--rv-space-6` (24px) |
| ≥ 1440px | 12 | `--rv-space-8` (32px) |

Product and card grids are `repeat(auto-fill, minmax(<min>, 1fr))` rather than fixed column counts,
so a category with four products does not stretch four cards across twelve columns. Minimums:
product 280px, collection 320px, portfolio 340px, journal 300px.

### 5.5 Aspect ratios

D6 fixes the available ratios: `21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16`. Each is a token
(`--rv-ratio-21x9` … `--rv-ratio-9x16`) consumed by `AspectBox`. Every media slot reserves its box
from the CMS ratio **before** the asset loads, so a media failure (SEED §47) never collapses a
layout and never costs CLS.

Default desktop/mobile pairs, which are separate CMS slots per D6:

| Slot | Desktop | Mobile |
|---|---|---|
| Page hero | 21:9 | 9:16 or 4:5 |
| Section media | 16:9 | 4:5 |
| Product card | 4:5 | 4:5 |
| Product gallery | 3:2 | 4:5 |
| Collection / category card | 3:4 | 4:5 |
| Portfolio card | 3:2 | 3:2 |
| Journal card | 16:9 | 16:9 |
| Material macro | 1:1 | 1:1 |

### 5.6 Z-index

| Token | Value | Layer |
|---|---|---|
| `--rv-z-base` | 0 | Document flow |
| `--rv-z-raised` | 10 | Cards on hover, sticky column heads |
| `--rv-z-header` | 100 | Sticky site header, Studio top bar |
| `--rv-z-dropdown` | 200 | Selects, popovers, tooltips |
| `--rv-z-mega` | 300 | Mega-menu panel |
| `--rv-z-drawer` | 400 | Drawers, mobile nav, filter sheet |
| `--rv-z-dialog` | 500 | Dialogs, confirm dialogs |
| `--rv-z-lightbox` | 600 | Lightbox, fullscreen 3D |
| `--rv-z-toast` | 700 | Toasts |
| `--rv-z-command` | 800 | Command palette |
| `--rv-z-dev` | 900 | Dev-only overlays; never in production |

A component that needs a z-index it cannot find here has a stacking-context bug, not a token gap.

---

## 6. Border, radius, shadow, elevation

### 6.1 Border and radius

| Token | Value | Use |
|---|---|---|
| `--rv-border-hairline` | `1px` | Everything. The system has one border width |
| `--rv-border-emphasis` | `2px` | Selected state, active tab underline, focus ring |
| `--rv-radius-0` | `0` | Media frames, full-bleed bands, table cells |
| `--rv-radius-xs` | `2px` | Chips, tags, checkbox |
| `--rv-radius-sm` | `4px` | Inputs, selects, buttons, small cards |
| `--rv-radius-md` | `8px` | Cards, panels, popovers |
| `--rv-radius-lg` | `12px` | Dialogs, drawers, mega-menu panel |
| `--rv-radius-xl` | `20px` | Nothing today. Reserved; requires an entry here before use |
| `--rv-radius-pill` | `999px` | Status pills, filter chips, switch track |

**Media is square-cornered.** `--rv-radius-0` on every image, video and 3D poster, on every card and
in every gallery. A rounded photograph of a resin table reads as a web widget; a square one reads as
a plate in a catalogue. Rounding is for controls, not for work.

### 6.2 Shadow and elevation

On the deep schemes a drop shadow is invisible; elevation is expressed as **surface + line**. On the
bone scheme it is expressed as **surface + shadow**. Both ladders are the same four levels, so a
component asks for a level and gets the right treatment.

| Level | DEEP / INK | BONE | Use |
|---|---|---|---|
| `0` | ground, no line | ground, no shadow | Flat content |
| `1` | `--rv-surface-raised` + `--rv-line-subtle` | `--rv-surface-raised` + `--rv-shadow-1` | Cards, panels |
| `2` | `--rv-surface-raised-2` + `--rv-line-strong` | `--rv-surface-raised` + `--rv-shadow-2` | Popovers, dropdowns, mega-menu panel |
| `3` | `--rv-surface-raised-2` + `--rv-line-strong` + scrim behind | `--rv-surface-raised` + `--rv-shadow-3` + scrim behind | Dialogs, drawers, command palette |

```css
--rv-shadow-1: 0 1px 2px rgb(8 10 14 / 0.06), 0 2px 8px rgb(8 10 14 / 0.05);
--rv-shadow-2: 0 2px 6px rgb(8 10 14 / 0.08), 0 8px 24px rgb(8 10 14 / 0.08);
--rv-shadow-3: 0 4px 12px rgb(8 10 14 / 0.10), 0 24px 64px rgb(8 10 14 / 0.14);
```

Shadows are never coloured, never inset, and never used to fake a border on a control.

---

## 6.3 Polymorphic components and `ref`

A component that accepts an `as` prop cannot pass its forwarded `ref` straight to the
rendered tag. React types `ref` per intrinsic element, and a union of intrinsic elements
does **not** unify those ref types: rendering `<Tag ref={ref}>` where `Tag` is
`'div' | 'section' | 'ul'` asks TypeScript for a ref that is simultaneously an
`HTMLDivElement`, an `HTMLElement` and an `HTMLLIElement` — an intersection nothing
satisfies. The error names a property from an unrelated element (`cite` is missing…,
`align` is missing…) and reads like a bug in the component, which is why three separate
component groups hit it independently while this section did not exist.

Route the tag through `asTag` from `lib/ui/polymorphic.ts`:

```tsx
import { asTag } from '@/lib/ui/polymorphic'

export const Text = React.forwardRef<HTMLElement, TextProps>(function Text({ as = 'p', ...rest }, ref) {
  const Tag = asTag(as)          // not: const Tag: React.ElementType = as
  return <Tag ref={ref} {...rest} />
})
```

Every element in our polymorphic unions **is** an `HTMLElement`, so narrowing the JSX type
to one that accepts an `HTMLElement` ref is sound. The cast lives in that one helper rather
than at each call site, and the component's public prop surface stays fully typed — `as`
remains restricted to its declared union.

Components using it today: `Container`, `Surface`, `Section`, `Stack`, `Text`, `Eyebrow`.

---

## 7. Form controls

Everything in this section lives in `components/primitives/`. Shared rules first, because they are
where accessibility is actually won:

- **Touch target ≥ 44 × 44 CSS px**, measured as the hit box, not the glyph (FEAT §48, exceeding
  WCAG 2.5.8's 24px). A visually smaller control gets its hit area with a `::before` overlay.
- Every control has a programmatic label. **A placeholder is never a label.** Placeholders are used
  only for format hints and are `--rv-ink-tertiary`.
- `autocomplete` tokens on name, email and telephone fields. `inputmode` on numeric fields.
- Error text is `aria-describedby`-linked, prefixed by an icon, and never carried by border colour
  alone (WCAG 1.4.1). The invalid control also gets `aria-invalid="true"`.
- Disabled controls use `disabled`, not `pointer-events: none`, so they remain discoverable.
- No control animates its size. Focus and hover change colour and border only (LIGHT class).

### 7.1 Button

| Variant | Fill | Ink | Border | Where |
|---|---|---|---|---|
| `primary` | `--rv-surface-accent` | `--rv-ink-on-accent` | none | The one conversion action in a view |
| `secondary` | transparent | `--rv-ink-primary` | `--rv-line-strong` | Everything else with equal weight |
| `ghost` | transparent | `--rv-ink-secondary` | none | Tertiary actions, toolbars |
| `quiet` | `--rv-surface-raised-2` | `--rv-ink-primary` | none | Studio table row actions |
| `danger` | transparent | `--rv-state-danger` | `--rv-state-danger` | Destructive actions only; always inside a `ConfirmDialog` flow |

Measured: obsidian on champagne = **7.46:1**; bone on sapphire = **8.53:1**. Both AA.

| Size | Height | Padding-inline | Type | Min hit box |
|---|---|---|---|---|
| `sm` | 36px | `--rv-space-4` | `text-sm` / 500 | 44px via overlay |
| `md` | 44px | `--rv-space-6` | `text-base` / 500 | native |
| `lg` | 52px | `--rv-space-8` | `text-base` / 500 | native |

States: `hover` lightens the fill by OKLab `L ± 0.03` (LIGHT class, 120ms); `active` returns to base
with no transform; `focus-visible` shows the §2.10 ring; `disabled` uses `--rv-ink-disabled` and
`--rv-line-subtle` at full opacity — never `opacity: 0.5`, which drags the ratio below the exemption;
`loading` swaps the label for a `Spinner`, keeps the button's width fixed, sets `aria-busy="true"`,
and leaves the accessible name intact.

A button that navigates is an `<a>` styled as a button. `Button` renders `<button>`; `TextLink`
renders `<a>`. There is no `as` prop that blurs the two.

### 7.2 IconButton

44 × 44 minimum at every size. Requires an `aria-label` sourced from `global_content`, never a
literal (SEED §1). Icons are 20px inline SVG with `stroke-width: 1.5`, `currentColor`, and
`aria-hidden="true"`. No icon font, no sprite sheet fetched at runtime.

### 7.3 TextLink

Inline links are `--rv-ink-accent` with a 1px underline at `text-underline-offset: 0.18em`. Inside a
`--rv-surface-raised-2` element on a DEEP section that token is already the stepped-up gold-bright
(§2.6) — the link inherits it and neither knows nor tests which surface it is on.
Underline is **not** removable — colour alone is not a permitted affordance (WCAG 1.4.1). Hover
thickens the underline to 2px. External links carry a 12px trailing glyph and
`aria-describedby` pointing at a shared "opens in a new tab" string in `global_content`.

### 7.4 Field, Label, HelpText, ErrorText

`Field` is the wrapper that owns the id relationships so no consumer has to:

```
<Field>
  <Label htmlFor={id} required?>          label / 500 / --rv-ink-primary
  <HelpText id={helpId}>                  text-sm / --rv-ink-tertiary   (above the control)
  {control aria-describedby="helpId errorId" aria-invalid=…}
  <ErrorText id={errorId} role="alert">   text-sm / --rv-state-danger + icon
</Field>
```

Help text sits **above** the control, error text below. A required field is marked with the word
"Required" in the label, not with an asterisk alone. Spacing: label → control `--rv-space-2`,
control → error `--rv-space-2`, field → field `--rv-space-5`.

### 7.5 Input and Textarea

| Property | Value |
|---|---|
| Height | 44px (`sm` 36px, Studio dense tables only) |
| Background | `--rv-surface-raised` |
| Border | `--rv-border-hairline` `--rv-line-strong`. Measured in §2.6/§2.7: 4.08:1 on ocean, 3.52:1 on ocean-raised, 3.01:1 on ocean-raised-2, 3.61:1 on bone, 3.39:1 on bone-raised — every input ground clears 1.4.11's 3:1 |
| Radius | `--rv-radius-sm` |
| Type | `--rv-text-base`, body family. Never below 16px on touch |
| Padding | `--rv-space-3` block, `--rv-space-4` inline |
| Focus | Border → `--rv-ink-accent`, plus the §2.10 ring |
| Invalid | Border → `--rv-state-danger`, plus icon and `ErrorText` |
| Textarea | `min-height: 7.5rem`, `resize: vertical`, `field-sizing: content` where supported |

Character counters, where a block schema sets a maximum, are `text-xs` `--rv-ink-tertiary`,
`aria-live="polite"`, and only announce within the last 20 characters.

### 7.6 Select

A native `<select>` styled with `appearance: none` and a token chevron. It is native because a
native picker on a 390px phone beats any custom listbox, and because SEED's forms are short lists.
If a future field needs search, grouping or multi-select, that is a `Combobox` — a new component
with a `COMPONENT_REGISTRY.md` row and the APG combobox keyboard model, not a modified `Select`.

### 7.7 Checkbox and Radio

20px control inside a 44px hit box. Checkbox `--rv-radius-xs`, radio `--rv-radius-pill`. Unchecked:
`--rv-line-strong` border on `--rv-surface-raised`. Checked: `--rv-surface-accent` fill with an
`--rv-ink-on-accent` mark. The mark is an SVG path, not a background image and not a font glyph.
The label is clickable and is part of the hit box. Groups use `<fieldset>` + `<legend>`; the legend
is visible, not `VisuallyHidden`, wherever the group has a real question.

### 7.8 Switch

Only for settings that apply immediately with no save step — Studio feature flags, `is_visible`,
`is_enabled`. Anything requiring a save uses a Checkbox. Track 44 × 24px inside a 44px hit box,
`--rv-radius-pill`; thumb 20px. `role="switch"` with `aria-checked`. On/off is conveyed by the
thumb position **and** a state label beside it, never by track colour alone. Transition: LIGHT,
120ms, transform only.

### 7.9 File and reference upload — `FileUpload`

`components/primitives/FileUpload.tsx`, registry **RC-033**, owned by Phase 19 (its first consumer).
Used by the bespoke configurator (FEAT §15) and the inquiry form for visitor reference images.
Phase 19's `components/patterns/Configurator/ReferenceUpload.tsx` composes this control; it does not
reimplement one. There is exactly one file-input contract in the product and this is it.

- A `<input type="file">` with a real label, plus a drop zone that is an enhancement, never the only
  route. Keyboard users reach the input.
- Accepted types and the byte ceiling are rendered as help text above the control, from the schema.
- Each selected file renders a row: thumbnail (client-generated, revoked on unmount), file name,
  size, and a remove `IconButton` with an accessible name including the file name.
- Progress is a determinate `<progress>` with `aria-live="polite"` announcing at 0/50/100 only.
- On failure the seeded SEED §49 copy renders and the flow continues without the file. An upload
  failure never blocks the inquiry.

### 7.10 Form layout and the conversion rule

Single column by default; two columns only above 1024px and only for genuinely paired fields
(city/postcode, length/width). The submit row is left-aligned, primary first, and sticky at the
bottom of the viewport below 768px with `--rv-surface-raised` and a top `--rv-line-subtle`.

**The rule that overrides layout:** an inquiry is persisted before any WhatsApp redirect. The
submit button therefore has three states — idle, `loading` (`aria-busy`), and either the SEED §48
success surface or the SEED §49 save-error message. There is no state in which the button navigates
to WhatsApp without a persisted `inquiryId`. No online checkout, no payment fields, no account
creation exists in any form in this system.

---

## 8. Navigation

### 8.1 Site header

Server-rendered (`components/patterns/SiteHeader.tsx`). Sticky, with the scroll state expressed in
CSS only — no scroll listener, no client component, no layout thrash.

| Property | Value |
|---|---|
| Height | 72px below 768px; 88px above; 64px in the compact scroll state |
| Ground | Transparent over a hero; `--rv-surface-ground` with `--rv-line-subtle` bottom edge once scrolled |
| Compact trigger | `scroll-timeline`/`animation-timeline` where supported, else the un-compacted header — never a JS scroll handler |
| Contents | Wordmark → primary nav → search trigger → primary CTA. Mobile: wordmark → search → menu |
| Skip link | First focusable element in the DOM, visible on focus, targets `#main` |

Nav labels, order, hrefs and visibility come from `navigation_items` (SEED §8). The header renders
whatever is published; it hard-codes no label.

**The search is an inline field from `xl` up, and nothing between `lg` and `xl` — a divergence from
the "search trigger" above, recorded rather than left silent (Phase 42).** Phase 23 shipped
`SearchCombobox`, a labelled input with a submit button, where this table says *trigger*. It was
visible from `lg`, and at 1024 it does not fit: the content box is 930px, the nine published
top-level items will not compress below 783 once the gap is tightened, and the field will not
compress below 118 because its submit button is `shrink-0`. Every `(site)` route scrolled sideways
at that width until the field was moved to `xl`. §8.2 pins the nav and its mega menu at ≥1024, so the
field was the only one of the three that could move.

What closes the gap is the control this table originally specified: a compact trigger, one control
wide, that opens the field rather than being it. That is a Phase 45 change. Until it exists, a
visitor between 1024 and 1279 reaches `/search` by URL or from a page that links it, and
`tests/e2e/search-combobox-a11y.spec.ts` asserts the field only at and above 1280 — which is the
threshold it had always used, while its comment said `lg`.

**A DESTINATION THAT IS NOT LIVE IS OMITTED FROM THE CHROME, AND RENDERS AS TEXT IN A PAGE BODY.**
The two rules differ, and the difference is what the label is for. A card or a call to action has
copy of its own — a title, a description, sometimes a picture — which is still true when the
destination is unavailable, so `resolveInternalTarget` withdraws only the click and the editor's
words stay on the page. A navigation item has no copy: its entire payload *is* the destination.
"Furniture" as an inert span in a mega menu informs nobody, is correctly not focusable and so cannot
be reached by keyboard at all, and reads as a disabled control with no explanation of what would
enable it. A signpost to nowhere is worse than no signpost. Nothing is deleted — the
`navigation_items` row is untouched and the item returns the moment its destination is live, exactly
as a call to action does.

The filter is applied once, in `lib/site/menu.ts`, which is the single pure transformation all four
chrome surfaces read; the live set it consults is composed in `lib/site/live-paths.ts`, because a
category listing has a second gate its `pages` row knows nothing about. Phase 45 added both after
finding ten destinations in the published menus answering 404. Neither rendering is a WCAG failure,
so axe cannot arbitrate this and the Phase 41 sweep stays at zero either way — which is precisely
why the rule is written down here.

### 8.2 Mega menu

The Collection item opens a panel. Only the panel and the mobile drawer are client components.

| Aspect | Contract |
|---|---|
| Trigger | `<button aria-expanded aria-controls>`; the panel is `aria-labelledby` the trigger |
| Open — pointer | Hover on desktop only, after a **120ms intent delay**; leaving cancels |
| Open — touch/keyboard | On activation only. No hover behaviour below 1024px |
| `ArrowDown` | Moves focus into the first panel item |
| `Tab` | Traverses the panel in DOM order and exits it naturally at the end |
| `Escape` | Closes and returns focus to the trigger |
| Outside click / route change | Closes |
| Focus trap | **None.** A mega menu is not a dialog; trapping focus in it is a defect |
| Layout | 12-column panel: 3 columns of category links + a 1-column feature card |
| Media | Category thumbnails from `categories.hero_media_id` at 3:4. A category with no bound asset renders a **text-only card** — never a placeholder, never a borrowed image from another category |
| Motion | FORM class: 240ms, opacity + 8px rise, `--rv-ease-out`. Reduced motion: appears instantly |
| Below 1024px | The panel does not exist; categories are a nested disclosure inside the mobile drawer |

### 8.3 Mobile navigation

A `Drawer` from the right, full height, `--rv-surface-ground`, occupying 100% width below 430px and
420px above. Focus is trapped, background is `inert`, `Escape` closes and restores focus. Category
children are a `Disclosure` inside it, not a second drawer. Every row is ≥ 56px tall. The primary
CTA is pinned to the bottom of the drawer above the safe-area inset.

### 8.4 Breadcrumbs

`components/patterns/Breadcrumbs.tsx`, registry **RC-230**, built in Phase 02 rather than Phase 10
because Phase 05's `StudioPage` needs a breadcrumb trail before the public chrome exists
(`docs/project/phases/PHASE-00-04.md`, Phase 02 build list). One implementation serves both
surfaces.

`<nav aria-label>` + ordered list. The current page is `aria-current="page"` and is not a link.
Rendered on `/collection/[category]`, `/product/[slug]`, `/collections/[slug]`,
`/portfolio/[slug]`, `/journal/[slug]` and every Studio leaf. `text-sm`, `--rv-ink-tertiary`,
separators `aria-hidden`. Below 430px only the parent and the current page render.

### 8.5 Footer

Four seeded columns (SEED §24) from `navigation_items`, plus the brand statement and a contact
column from site settings. Contact values are `OWNER_VERIFICATION_REQUIRED` content, rendered from
the database — never hard-coded in a component, and never duplicated between the footer and
`/contact`. Below 768px the columns become four `Disclosure` sections with the contact column open
by default.

---

## 9. Cards

Four public card types plus the Studio variants. All four share one anatomy so the grid reads as one
family, and differ only where the content genuinely differs.

Shared: `MediaFrame` (square corners, ratio reserved) → eyebrow → title → supporting line →
meta row. Whole-card link uses a heading-anchor with a `::after` overlay, so the accessible name is
the title and not "read more". Hover (LIGHT, 120ms): border → `--rv-line-strong`, media scales to
`--rv-motion-scale-in` (1.015) behind `overflow: hidden`. No card lifts, shadows or rotates.

| | ProductCard | CollectionCard | PortfolioCard | JournalCard |
|---|---|---|---|---|
| Ratio (desktop / mobile) | 4:5 / 4:5 | 3:4 / 4:5 | 3:2 / 3:2 | 16:9 / 16:9 |
| Eyebrow | Category name | — | Project type | Journal category |
| Title | Product title | Collection name | Project title | Article title |
| Supporting | Price **label** (SEED §30), never a computed price | One-line collection statement | Location or year **only if stored and verified** | Reading time + date |
| Meta row | Material chips (max 3, `+n`), `Made to Order` / `One of One` chips where the record carries them | Item count, or nothing when zero | — | Author, when the record has one |
| Badges | Publication and merchandising badges in Studio only. **Never** an invented "New" or "Bestseller" | Concept badge for `DRAFT_COLLECTION_CONCEPT` (Studio only) | — | — |
| Missing media | Renders `MediaSlot`'s neutral material-toned surface at the reserved ratio with the seeded SEED §47 label. Never a stock image, never a sibling's image | same | same | same |
| Grid minimum | 280px | 320px | 340px | 300px |
| Mobile at 360px | Full-width single column | Full-width | Full-width | Horizontal: 96px media + text |
| Empty grid | The seeded SEED §27/§28/§29 empty state. **Never the words "Coming Soon"** (SEED §55) | same | same | same |

Two content rules, from D10 and SEED §32, that a card must enforce structurally rather than
editorially:

- A price is rendered only when the record carries a price state. `Price on Request`,
  `Request a Quote` and `Starting from` are labels from `global_content`; the card never computes,
  estimates or formats a number the record does not have. A quote-only product never renders `0`.
- A product with `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` cannot be published (Phase 08),
  so the public card never has to render that state. In Studio it renders a warning `StatusPill`.

---

## 10. Media: gallery, lightbox, slider, carousel

### 10.1 MediaSlot, MediaImage, MediaVideo and MediaFrame

Four components, one chain. `MediaFrame` (RC-030, primitive) reserves the box. `MediaSlot` (RC-213)
resolves which asset and which renderer. `MediaImage` (RC-232, server) and `MediaVideo` (RC-233,
client) are the two renderers, built in Phase 06 alongside the `MediaProvider`
(`docs/media/MEDIA_GUIDE.md` §5) — they are the only components in the product permitted to emit an
`<img>` or a `<video>` element. `MediaImage` requires a `sizes` prop and throws without one in
development; `scripts/perf/check-image-props.mjs` fails CI on a usage that omits it, and
`scripts/perf/check-video-props.mjs` requires every `MediaVideo` to carry a poster, `preload="none"`,
`muted` and `playsInline`, with no `autoplay` attribute in markup.

Every image and video on the site passes through `components/patterns/MediaSlot.tsx`. It:

1. Reserves the aspect box from the CMS ratio before anything loads (CLS budget 0.05).
2. Selects the desktop or mobile asset — separate CMS slots per D6, chosen with `<picture>`/`source`
   at `--rv-bp-md`, not by JavaScript.
3. Renders `alt` from `media_assets.alt_text`, or `alt=""` when `is_decorative` is true. An empty
   alt is never produced by omission.
4. On failure paints `--rv-surface-sunken` with the seeded "Image temporarily unavailable" label
   (SEED §47) — the layout does not collapse.
5. Applies `--rv-media-veil` when text sits over the media, so the overlay ink keeps its ratio.

AI concept media (`is_ai_generated`, `is_concept`) is rendered normally; alt text describes what is
visible (SEED §43). Whether a public "concept image" caption is required is a policy decision the
owner makes — the caption slot exists and is empty. `OWNER_VERIFICATION_REQUIRED`.

### 10.2 Gallery

Server-rendered stills in a grid; the client component is the lightbox only.

| Aspect | Contract |
|---|---|
| Layout | 12-col: one lead image spanning 8, the remainder in a 4-col rail; single column below 768px |
| Thumbnails | A roving-tabindex list (`role="tablist"`-free — it is a list of buttons, arrow keys move, `Enter` opens) |
| Counter | `n of m`, `aria-live="polite"` |
| Motion | RESIN on image swap: 720ms crossfade, `--rv-ease-flow`. Reduced motion swaps instantly |

### 10.3 Lightbox

| Aspect | Contract |
|---|---|
| Role | `role="dialog"` + `aria-modal="true"`, labelled by the current image's alt text |
| Focus | Moved in on open, trapped, restored to the originating thumbnail on close |
| Keys | `Escape` closes; `←`/`→` move; `Home`/`End` jump; `Tab` cycles within |
| Background | `inert` while open; body scroll locked with the scrollbar width compensated |
| Scheme | Always `INK`, regardless of the section's scheme |
| Controls | 44px `IconButton`s, always visible on touch, fading on pointer idle after 2.5s on desktop only |
| Zoom | Pinch and double-tap on touch; `+`/`−` keys on desktop; pan with arrows when zoomed |
| Motion | ART on open (900ms max), RESIN between images. Reduced motion: instant |
| Never | Auto-advance. A lightbox is a reading surface |

### 10.4 Slider and carousel

Used sparingly: `selected-works`, `portfolio-strip`, `journal-strip`, related content. Never for a
hero, never for primary navigation.

| Aspect | Contract |
|---|---|
| Mechanism | CSS scroll-snap on a horizontally scrollable list. No transform-based track, no virtualised DOM |
| Semantics | `<ul>` of items in a container with `role="group"` and `aria-roledescription="carousel"`; each item is `aria-label="n of m"` |
| Keyboard | The scroller is focusable; `←`/`→` move one item; `Home`/`End` jump. Every item's own link is separately tabbable |
| Controls | Previous/next `IconButton`s above 768px, disabled at the ends with `aria-disabled`; edge fade below |
| Auto-advance | **Off by default.** Where a block schema enables it, it pauses on hover, focus and `document.hidden`, exposes a pause control as the first focusable item, and never runs under reduced motion (WCAG 2.2.2) |
| Mobile | Free scroll with snap, one-and-a-peek so a second card edge shows the list continues |
| Motion | FORM on control-driven movement (240ms); native inertia on touch |

---

## 11. Overlays and disclosure

All seven are built in Phase 02 and everything else composes them. Each follows its APG pattern.
`DropdownMenu` is in this list rather than in a page phase for the same reason as `Breadcrumbs`
(§8.4): Phase 05's Studio top bar needs a user menu, and Phase 05 runs before Phase 10 builds the
public chrome, so deferring it would mean the Studio inventing a second one.

| Component | Role / semantics | Open | Close | Focus | Motion |
|---|---|---|---|---|---|
| `Dialog` | `role="dialog"` `aria-modal` `aria-labelledby` `aria-describedby` | Trigger activation | `Escape`, close button, scrim click (never for a destructive confirm) | Moved to the first control or the heading; trapped; restored to the trigger | FORM 240ms, 8px rise + fade |
| `Drawer` | Same as Dialog, edge-anchored | Trigger | `Escape`, close button, scrim click | Trapped; restored | FORM 240ms, `translateX`/`translateY` |
| `Tabs` | APG tabs: `role="tablist"`, roving tabindex, `aria-selected`, `aria-controls` | Arrow keys move and activate; `Home`/`End` jump | — | Panel is `tabindex="-1"` and focusable as a group | `--rv-duration-instant` on panel swap; the underline slides at 180ms |
| `Accordion` | Headers are `<button>` inside `<h3>`, `aria-expanded`, `aria-controls` | Click / `Enter` / `Space` | Same | Stays on the header | FORM via `grid-template-rows: 0fr → 1fr` |
| `Tooltip` | `role="tooltip"`, `aria-describedby` on the trigger | Hover after 400ms, or focus immediately | `Escape`, blur, pointer leave (with a 100ms grace so the pointer can cross to it) | Never receives focus | LIGHT 120ms fade |
| `Disclosure` | `<button aria-expanded>` + region | Activation | Activation | Stays on the trigger | FORM |
| `DropdownMenu` | APG menu button: `<button aria-haspopup="menu" aria-expanded aria-controls>` over a `role="menu"` of `role="menuitem"` children | Click, `Enter`, `Space`, `ArrowDown` | `Escape`, outside click, route change, item activation | Moves to the first item on open, roving tabindex inside, `Home`/`End` jump, restored to the trigger on close. **No focus trap** — a menu is not a dialog | FORM 240ms, opacity + 8px rise |

Rules that apply to all of them:

- Background content is `inert` while a modal surface is open. `aria-hidden` on a container holding
  the focused element is a bug.
- Body scroll lock compensates for the scrollbar width so the page does not jump.
- **A tooltip never carries information available nowhere else**, and never contains an interactive
  element. If it needs a link, it is a `Popover`, which is not yet a component in this system.
- `ConfirmDialog` (Studio) is a `Dialog` whose scrim is not click-to-close, whose default focus is
  the **cancel** button, and which requires typed confirmation for bulk destructive actions
  (FEAT §20).
- Nested modals are not permitted. A dialog that needs a second dialog is a two-step dialog.

### 11.1 Toasts — `ToastRegion` and `Toast`

`components/studio/ToastRegion.tsx`, registry **RC-317**, owned by Phase 05. **Studio only.** The
public site has no toast: a visitor-facing outcome is the SEED §48 success surface or the SEED §49
error message rendered in place, where it stays on screen and can be re-read. A component that
wants a toast on a public route needs a new registry row and a reason, not a reuse of this one.

| Aspect | Contract |
|---|---|
| Region | One `ToastRegion` per Studio shell, rendered once in `app/(studio)/studio/layout.tsx`. `role="status"` with `aria-live="polite"` and `aria-atomic="true"`. It is **empty in the DOM from first paint**, so the live region exists before the first message arrives — a live region added at the same moment as its content is not announced |
| Severity | `success` · `info` · `warning`. **`danger` is not a toast severity.** A destructive or failed outcome is reported where the action was taken — in the dialog, on the form, in the row — because a toast is dismissible, transient and easy to miss (ACCESSIBILITY.md §2.5). A toast may accompany that report; it may never be the only carrier of it |
| Anatomy | State icon (decorative, `aria-hidden`) + the message text + an optional single action + a close `IconButton` whose accessible name names the message. Severity is carried by the words, never by colour alone (§2.9) |
| Colour | Soft state surface from §2.9 with a 1px border in the state colour and `--rv-ink-primary` text, at elevation 3. It renders in the Studio's `BONE` scheme like everything else |
| Placement | Bottom-right above 768px, bottom-centre below, at `--rv-z-toast` (700), above the safe-area inset. It never covers the submit row of an open form |
| Stacking | At most three at once; a fourth replaces the oldest. Identical consecutive messages coalesce into one with a count rather than repeating |
| Dismiss | Auto-dismiss after **6 s** for `success` and `info`, **10 s** for `warning`; the timer pauses on hover, on focus within, and while `document.hidden`. A close button is always present, so the timer is never the only route out |
| Keyboard | Focus is **never moved to a toast**. The toast and its action are reachable by `Tab` in DOM order while present. `Escape` dismisses the focused toast only |
| Motion | FORM class: 240ms, opacity + 8px rise, `--rv-ease-out` in / `--rv-ease-in` out |
| Reduced motion | No slide and no fade — the toast appears and disappears. **The auto-dismiss timer is unchanged**: reduced motion removes the movement, never the reading time (ACCESSIBILITY.md §2.5) |

---

## 12. Filters, search and the command palette

### 12.1 Filter bar

| Aspect | Contract |
|---|---|
| State | The URL is the state. Filters are `searchParams`; there is no client filter store |
| Desktop (≥ 1024px) | A left rail of `Disclosure` groups: category, material, collection, scale, price state, availability — each group driven by the facets the catalogue layer returns, never a hard-coded list |
| Tablet / mobile | A `Drawer` opened by a "Filters" button that shows the active count; the drawer's footer holds "Apply" and "Clear all" |
| Chips | Active filters render as removable chips above the grid, each an `IconButton` with an accessible name naming the filter it clears |
| Counts | Each option shows its result count; zero-result options are disabled, not hidden, so the shape of the catalogue stays visible |
| Live region | The result count is `aria-live="polite"`; the grid itself is not a live region |
| Skip link | "Skip to filters" on `/collection/[category]` (Phase 41) |
| Sort | A `Select`, URL-synced, never a custom listbox |
| Empty result | The seeded empty state plus the two most-effective filters to remove |

### 12.2 Public search

Instant suggestions grouped by type (Products, Categories, Collections, Portfolio, Journal — SEED
§18/§19). Never scraped research data; no `research_*` identifier exists anywhere in the public
bundle.

| Aspect | Contract |
|---|---|
| Pattern | APG combobox: `role="combobox"` `aria-expanded` `aria-controls` `aria-activedescendant` on a `role="listbox"` |
| Keys | `↓`/`↑` move through groups; `Enter` opens; `Escape` clears then closes; `Tab` accepts and moves on |
| Debounce | 200ms; in-flight requests aborted |
| Announcement | "n results" via `aria-live="polite"`, throttled to one announcement per settled query |
| Empty | Seeded SEED §26 copy plus category links. Never a bare "No results" |
| Highlighting | Matched substring in `--rv-ink-accent` at weight 500 — colour is not the only cue |

### 12.3 Command palette (Studio)

`⌘K` / `Ctrl-K`. A `Dialog` containing the same combobox pattern, provider-driven through
`components/studio/command/registry.ts`. Results are grouped by provider (Navigate, Products,
Content, Media, Inquiries, Research). **Every result is permission-filtered server-side** — a
palette that lists a route the user may not open is an information leak, not a convenience. Recent
commands are per-user in `studio_preferences`. Reduced motion: opens instantly.

---

## 13. Data: tables, grids, charts, KPI cards

Studio only. All of it renders in the BONE scheme.

### 13.1 DataTable

| Aspect | Contract |
|---|---|
| Semantics | A real `<table>` with `<caption>` (visually hidden where the page heading already names it), `<th scope="col">`, and `aria-sort` on the sorted column |
| Density | Row height 52px default, 44px compact; `--rv-text-sm`; numeric columns `tabular-nums` and right-aligned |
| Header | `--rv-surface-sunken`, sticky under the Studio top bar, `--rv-line-strong` bottom edge |
| Sort | Column headers are `<button>`s inside the `<th>`; the sort key is a `searchParam` |
| Selection | A checkbox column with a header "select all on this page" whose label states the page scope; the selected count is announced `aria-live="polite"` |
| Pagination | `rel`-linked page controls with a total; never infinite scroll |
| Row action | The whole row is not a link. The first cell holds the link; an action `IconButton` column sits at the end |
| Overflow | The table scrolls inside `overflow-x: auto` with `tabindex="0"` and an accessible name, so a keyboard user can scroll it. The page body never scrolls horizontally |
| Mobile (< 768px) | Rows become stacked cards with `<dt>`/`<dd>` pairs. The column set is chosen by the caller — this is a declared responsive view, not an automatic squeeze |
| Empty | `EmptyState` with a heading, a body and the action that would create the first row |
| Loading | Skeleton rows matching the column count; never a spinner that replaces the whole table |

### 13.2 Charts

Token-driven inline SVG (`BarSeries`, `BandStrip`, `Scatter`, `Sparkline`). No runtime chart
dependency; any proposal to add one needs a `COMPONENT_REGISTRY.md` row and a bundle-delta
justification.

| Rule | Detail |
|---|---|
| Accessible equivalent | Every chart has `role="img"` with an `aria-label` stating what it shows, **and** an adjacent, keyboard-reachable data table carrying the same numbers |
| Colour | Series are distinguished by more than hue: pattern, position or direct labelling. The categorical ramp is `sapphire → champagne-deep → success → warning → steel`, each ≥ 3:1 against `--rv-surface-raised` |
| Coverage | A coverage badge sits above every chart: rows in scope, rows parsed, rows unknown. An `UNKNOWN` bucket is drawn, never dropped |
| Honesty | A chart is never drawn from data the system does not have. Where a metric is unavailable, the tile states the reason (FEAT §28) |
| Axes | Zero-baselined for bars; a truncated axis is labelled as truncated |
| Motion | Charts do not animate on load. A value change transitions at `--rv-duration-quick`, and not at all under reduced motion |

### 13.3 KPI card (`StatCard`)

Anatomy: label (`text-sm`, `--rv-ink-secondary`) → value (`display-md`, `tabular-nums`,
`--rv-weight-strong`) → delta → hint (`text-xs`, `--rv-ink-tertiary`) → coverage badge.

- A delta renders only with a stated comparison window ("vs previous 30 days"). A delta with no
  denominator is not rendered.
- The **unavailable state is a first-class state**: label, an em dash where the value would be, and
  the reason. It is never `0`, never blank, and never "Coming Soon".
- Direction is carried by an arrow glyph plus the sign, not by colour alone. Green-is-good is not
  assumed: each metric declares whether an increase is favourable.
- Cards are `role="group"` with `aria-labelledby` pointing at the label, so a screen reader reads
  label and value together.

---

## 14. 3D viewer UI

Phase 02 reserves the token surface; Phase 21 builds the viewer. The tokens exist now so the viewer
cannot invent its own.

```css
--rv-3d-surface:        rgb(8 10 14 / 0.72);   /* control bar over the canvas */
--rv-3d-surface-solid:  var(--rv-color-obsidian);
--rv-3d-ink:            var(--rv-color-bone);
--rv-3d-ink-muted:      var(--rv-neutral-300);
--rv-3d-line:           rgb(250 249 245 / 0.22);
--rv-3d-control-size:   44px;
--rv-3d-control-gap:    var(--rv-space-2);
--rv-3d-hotspot:        var(--rv-color-champagne);
--rv-3d-hotspot-ring:   rgb(184 155 99 / 0.35);
--rv-3d-progress-track: rgb(250 249 245 / 0.18);
--rv-3d-progress-fill:  var(--rv-color-champagne);
```

The viewer renders in the `INK` scheme. UI contract:

| Element | Contract |
|---|---|
| Entry | The **poster is the LCP element**, never the canvas. The viewer mounts on an explicit "Inspect in 3D" activation, or on intersection only when viewport ≥ 768px, reduced motion is not preferred, `saveData` is false and `deviceMemory ≥ 4` |
| Control bar | Bottom-anchored, `--rv-3d-surface`, 44px controls: reset camera, zoom in, zoom out, fullscreen, lighting preset, environment preset, variant switch, dimensions toggle |
| Canvas | `role="img"` with an accessible name from the model's title and an `aria-describedby` summary; every camera action also has a keyboard route (arrows orbit, `+`/`−` zoom, `0` resets) |
| Loading | Determinate progress on the poster, `aria-live="polite"` at 0/50/100. The poster stays visible until the first frame |
| Fullscreen | Focus is trapped; `Escape` exits and restores focus to the trigger |
| Below 768px | Opt-in only, and fullscreen once opened |
| Reduced motion | No auto-rotate, no intro animation, no idle motion — poster plus explicit controls |
| Flag off | Nothing 3D is requested, rendered or downloaded |
| Failure | Poster plus a stated reason. A failed model never leaves an empty box |

Dimension indicators render measurements **only** from stored, owner-verified product data. The
viewer never derives a dimension from the mesh bounding box and presents it as a specification.

---

## 15. Studio primitives

Studio uses the same `components/primitives/**` as the public site — there is no second design
system — plus the composed pieces in `components/studio/**`. Studio-specific conventions:

| Convention | Value |
|---|---|
| Scheme | `BONE` throughout |
| Shell | Fixed 264px sidebar (collapsible to 64px, persisted in `studio_preferences`), 56px top bar, content in `--rv-container-default` |
| Page | Every leaf renders `StudioPage`: title, description, breadcrumb, actions slot, permission gate, stub notice |
| Density | One step tighter than public: `text-sm` body, 44px controls, `--rv-space-4` grid gap |
| Status | `StatusPill` per §2.9, on every row and in every drawer header |
| Destructive | Never inline. Always `ConfirmDialog`, with the entity named in the dialog body and typed confirmation for bulk actions |
| Forms | `DrawerForm` + `FormField`, server actions, Zod errors mapped to `ErrorText` by field path; a failed save never clears the form |
| Feedback | Outcome toasts through the single `ToastRegion` (§11.1). A destructive or failed outcome is **also** reported in place — in the dialog, on the form or in the row — because a toast is transient |
| Empty | `EmptyState` — heading, body, action. **The words "Coming Soon" are forbidden** (SEED §55) and a unit test greps for them |
| Stub | A page whose feature lands in a later phase renders a stub notice naming the phase, not a blank screen |
| Permission | `PermissionGate` hides UI, and is never the only guard — the server re-checks on every page and every action |
| Helper copy | From `global_content` group `STUDIO_HELP` (SEED §40), never a literal |

---

## 16. Enforcement

A rule without a script is a wish.

| Check | Script | Fails when |
|---|---|---|
| Token discipline | `scripts/design/check-tokens.mjs` | A hex literal, `rgb(`/`hsl(` literal or raw `px` spacing appears under `components/**` or `app/**` outside `app/styles/**`; or the neutral ramp in `tokens.css` does not match the §2.2 derivation |
| Contrast | `scripts/a11y/check-contrast.mjs` | Any pairing in §2.6/§2.7/§2.9 drops below its stated threshold after a token edit. It reads the hex values out of `tokens.css`, re-derives every ratio, and asserts the three automatic step-ups by name: `--rv-ink-tertiary` → neutral-200 and `--rv-ink-accent` → gold-bright on `--rv-surface-raised-2` in DEEP, and `--rv-ink-tertiary` → neutral-200 in INK. It also asserts the boundary rows — `--rv-line-strong` on every ground a control sits on, at 3:1 |
| Focus styles | `scripts/a11y/check-focus-styles.mjs` | `outline: none` appears without a replacement ring |
| Registry | `scripts/design/check-registry.mjs` | A component file under `components/{primitives,patterns,studio,three}/**` has no `COMPONENT_REGISTRY.md` row, or a row is missing a required column. `components/sections/**` is out of its scope by design — block renderers are checked 1:1 against the block registry by `tests/unit/cms-registry.test.ts` (see `COMPONENT_REGISTRY.md` §1) |
| Copy in JSX | `scripts/site/check-content-literals.mjs` — script name proposed here for `ARCHITECTURE.md` import rule 6, owned by Phase 10 | Marketing copy appears in a `.tsx` file (SEED §1, D2) |
| Visual | `tests/e2e/design-system.spec.ts` | A primitive's snapshot changes at any of the eight FEAT §45 widths |
| Reduced motion | `tests/e2e/a11y/reduced-motion.spec.ts` | Any transform or opacity transition applies, or a `<video>` mounts, under `prefers-reduced-motion: reduce` |
| Touch targets | `tests/e2e/a11y/touch-targets.spec.ts` | Any hit box is below 44 × 44 at 390px |
| Axe sweep | `tests/e2e/a11y/*.spec.ts` | Any critical or serious violation, at 1440px and 390px |

The dev-only gallery at `app/(site)/design-system/**` renders every primitive in every state at
every width, served at `/design-system` and `/design-system/[group]`. The first statement of both
page components is an explicit `if (process.env.NODE_ENV === 'production') notFound()`, so the route
returns 404 in a production build; it is excluded from the sitemap and is not part of the D3 route
map. The segment is **not** underscore-prefixed: a `_`-prefixed directory is a Next.js private
folder and is opted out of routing entirely, which would leave nothing to open, tab through or
axe-scan. The path is fixed by the 2026-09-07 A2 amendment to `CANONICAL-DECISIONS.md`.

---

## 17. Change control

1. A new value needs a token. A new token needs a row in the relevant table above.
2. A new **base colour** needs a §2.1 entry with its justification, a measured pairing row in
   §2.6 or §2.7, and a reviewer sign-off recorded in `COMPONENT_REGISTRY.md`.
3. A new **component** needs a `COMPONENT_REGISTRY.md` row before its first commit. Nothing ships
   unregistered.
4. A change to a shared token is a design-system change: it updates this document, re-runs
   `check-contrast.mjs` and `design-system.spec.ts`, and follows the FEAT §43 documentation update
   contract into `CHANGELOG.md`, `PROJECT_STATE.md` and `docs/SESSION-STATE.md`.
5. This document is amended, never silently diverged from — the same rule the canonical decisions
   apply to themselves.

---

## 18. Open items handed to other documents

Recorded here rather than resolved silently, because each needs an edit to a document this one does
not own. None blocks Phase 02; each is a citation this document deliberately does not make until
the other document carries the line.

| # | Item | Document that must change | Why it is open |
|---|---|---|---|
| 1 | Add a font-payload line item — **≤ 120 kB total woff2, latin subset, across the two loaded faces** — to the budget tables | `docs/ops/PERFORMANCE.md` §2.2 or §3, owned by Phase 40 | §3.1 states the budget and owns it. PERFORMANCE.md §3 budgets per-route JavaScript only; the sole 120 kB figure there is `/faq`'s first-load JS and is unrelated. Until the line exists, §3.1 is the citation for a font number |
| 2 | Confirm that "at most two families" counts **loaded** families, so a device-resident `--rv-font-mono` stack that fetches nothing is permitted | `docs/ops/PERFORMANCE.md` §2.2, owned by Phase 40 | §3.1 takes that reading and says so. If Phase 40 rules otherwise, the `identifier` role (§3.5) collapses onto the body family with `tabular-nums` and this document is amended — the fix is one row, not a redesign |
| 3 | `components/patterns/ArticleCard.tsx` is named as the journal card; this system's journal card is `JournalCard` (registry RC-220, §9) | `docs/content/INITIAL_CONTENT_INVENTORY.md` | Two names for one component. `JournalCard` is the name in the registry, in the phase documents and in §9; the inventory row should follow it |

---

## 19. Final creative audit

FEAT §49 asks eight questions. This section is where they are answered, and its shape was fixed
before the answers existed so that no question can be answered without also recording who answered
it and when. Phase 45 owns it (`docs/project/phases/PHASE-39-46.md` §45); Phase 02 owns everything
above. The two are different kinds of writing and the difference matters: §1–§18 are rules, and a
rule is true until amended. §19 is a dated record of judgements, and a judgement carries a name.

**No question gets a number.** There is no 7/10 for "does it feel like a collectible-design studio",
because a score invents precision the evidence does not have and averages away the one question that
cannot be averaged. A row gets one of five tokens from the closed vocabulary in §19.2 and nothing
else — and the vocabulary is closed, so a reviewer who wants `PARTIAL` or `71%` is being told by
this document that they have not finished thinking.

**Three of the eight cannot be answered from inside the repository.** Question 1 is the owner's
judgement about their own studio. Question 5 needs people who have never seen the site. Question 8
needs the owner to sit in front of the Studio and try. An engineer can measure the site all day and
answer none of the three, and an AI agent can answer none of them at all. §19.3 states who may write
in which column, and §19.4 is the standing instruction that produces the owner's answers.

### 19.1 The eight questions

| # | FEAT §49 question | Examined on | Evidence | Verdict | Reviewer | Date |
|---|---|---|---|---|---|---|
| 1 | Does it feel like a collectible-design studio? | `/`, `/large-format`, `/about`, `/process` at 1440 × 900 and 390 × 844. **Not** `/collection/[category]` or `/collections/[slug]`, which §45 names and which 404 — see §19.5 | The owner's own session log, kept to the shape in §19.4 and pasted beneath this table | `OWNER_VERIFICATION_REQUIRED` | — | — |
| 2 | Does large furniture visually dominate? | `/` and `/large-format`, all eight FEAT §45 widths | Measured. The hero media box is **617 px = 69 % of 900** at 1440 and **693 px = 82 % of 844** at 390; across the eight widths it runs 91 · 69 · 61 · 49 · 37 · 91 · 82 · 76 %. It is a 21:9 `AspectBox`, so its height is a function of WIDTH and never of viewport height — the ≥ 70 % condition is met or missed by accident of viewport aspect, which is the finding rather than the one missing point. The scale-reference-above-the-fold clause and the "no large-format piece smaller than a décor item" clause are **not yet observed**; a row takes the worst verdict among its measured clauses and names the rest. **The mechanism has since been fixed** — `--rv-hero-min-h` (§5.1.1) gives the first section of a page a viewport-relative floor of 76 svh, so the height is no longer a function of width alone. The verdict stands at `FAIL` until somebody re-runs the measurement in a browser and signs it, per §19.2, and the two unobserved clauses are unaffected by the floor | `FAIL` | — (measured; see §19.3) | 2026-09-12 |
| 3 | Can the visitor feel resin, wood, light and surface? | `/about` material palette, `/process`, product galleries; delivery presets and `sizes` read statically, because the browser harness serves committed fixture derivatives and cannot judge texture | Seventeen `sizes` strings declare a `(min-width: 640px)` switch this design system does not have — `--breakpoint-sm` is 26.875rem (430 px) and `--breakpoint-md` is 48rem (768 px) — so the browser is told the layout changes where it does not. `media_crops` focal points are written by the Studio and read by no public renderer. The material palette forces `mobileRatio="4:5"` on a macro study | `FAIL` | — (measured; see §19.3) | 2026-09-12 |
| 4 | Does 3D improve understanding rather than exist as a gimmick? | Nothing. There is nothing to examine | Zero real models exist and the flag is off: `three_d_viewer` in `lib/flags/flags.ts` is off until a model with a poster exists, and no row seeds it on. Inventing a model to answer this question would fabricate a product (D10) | `N/A — no model exists; flag off` | — | 2026-09-12 |
| 5 | Can users discover and understand products easily? | The five tasks in `docs/ops/TESTING.md` §14.2, on each participant's own device | Three or more first-time participants, task completion, times and verbatim quotes, recorded in `TESTING.md` §14.4. The threshold lives there and is not restated here | `OWNER_VERIFICATION_REQUIRED` | — | — |
| 6 | Can users Enquire · Customize · Request Quote · Request Consultation · Commission · Continue to WhatsApp? | Every conversion surface at 390 px, plus `tests/e2e/inquiry-conversion.spec.ts` in both directions | Six named affordances resolve to **one** form reached by two URLs. `ProductInquiryRail` returns the same `/contact?product=<slug>&type=product` for "Ask About This Piece" and "Request a Quote", and `type` is read by nothing; both file `kind = 'PRODUCT'`. `QUOTE` and `CONSULTATION` are real enum values with real schemas, real WhatsApp templates and two Studio inbox views that can never receive a row. `Customize` is gated on a flag that ships off, behind a block type nothing seeds. Persistence-before-redirect **passes** structurally. The pass condition's own "two clicks" is unsatisfiable for affordance six — see the note below this table | `FAIL` | — (measured; see §19.3) | 2026-09-12 |
| 7 | Does mobile feel intentionally designed? | Every tier A and B route at 430, 390 and 360 | No route scrolls sideways at any of the eight widths, and `rv-hit-44` holds every touch target. Against that: there is no sticky conversion affordance anywhere, so on `/product/<slug>` at 390 the two calls to action sit at y = 997 and 1053 of a 1928 px document, outside the thumb zone on every phone; the journal card's `h2` truncates at 390 and 360; and the mobile crops the Studio can write are not read by any renderer | `FAIL` | — (measured; see §19.3) | 2026-09-12 |
| 8 | Can the owner manage everything without code changes? | The ten operations in `docs/ops/TESTING.md` §14.3, performed by the owner, unaided and observed | Ten of ten, or a named list of what needed an engineer. Three capability-table rows are excluded from the ten by construction and the exclusions are part of the verdict — see `TESTING.md` §14.3 | `OWNER_VERIFICATION_REQUIRED` | — | — |

**Question 6's pass condition is itself wrong, and the audit records that rather than the code.**
FEAT §49 asks that each affordance be reachable "within two clicks" *and* "terminate in a persisted
inquiry then WhatsApp". For "Continue to WhatsApp" those two clauses cannot both hold: D1 requires
the enquiry to be saved before any redirect, so the handoff is the link on the success state — the
third click, by construction. `buildHandoffUrl` takes a non-optional inquiry id, which is the rule
expressed in a type signature. The code is right and the condition is over-specified; a future
amendment should say "within two clicks of the surface that files it".

Beneath this table, each answered question gets a short paragraph: what was looked at, what was
seen, and what the verdict cost. A `FAIL` or a `PASS_WITH_ACTIONS` names its work item and where it
went — fixed inside the five-condition remit (§45), or recorded in `docs/project/ROADMAP.md` with
the reason it was deferred. A verdict with no paragraph is a verdict nobody can audit.

### 19.2 The verdict vocabulary, and why an unanswered question is not "TBD"

| Token | Means | Who may replace it, and with what |
|---|---|---|
| `PASS` | Every clause of the pass condition was met | Nobody. It is finished. A later regression opens a new dated row; it does not edit this one |
| `PASS_WITH_ACTIONS` | Met, with named work items | The reviewer who wrote it, once every item is closed or deferred with a reason |
| `FAIL` | A clause was not met | The reviewer who re-runs the evidence after the fix, with a new date |
| `OWNER_VERIFICATION_REQUIRED` | The question is a fact about the world, or a judgement about this business, that only the owner can settle | **The owner alone**, replacing it with `PASS` or `FAIL` and adding their name and the date |
| `NOT YET RUN` | The examination is scheduled and nobody has done it | Whoever does it |

`OWNER_VERIFICATION_REQUIRED` is not a word invented for this table. It is the D5 enum value, it is
the value the publish triggers refuse a row for, it is already this document's own status-pill
vocabulary (§2.9), and it is on the front matter of five sibling documents. Using it here means this
project has exactly one phrase for "nobody has confirmed this", which is the discipline §1 applies
to a colour.

**It is not "TBD", for five reasons, and the reasons are the convention.**

1. **TBD is prose; this is a value.** `OWNER_VERIFICATION_REQUIRED` is greppable and it means the
   same thing in this table as it means in `media_assets`, in `page_sections` and in a front-matter
   block. A reader who knows the codebase needs no key to read this cell.
2. **It names who owes the answer.** TBD says a cell is empty. This token says the cell is waiting
   on one specific person, and §19.3 says nobody else may fill it.
3. **It flips the front matter, so the outstanding row is visible outside this section.** While any
   row here carries the token, this document's front matter reads
   `owner_verification: OWNER_VERIFICATION_REQUIRED`. A blank cell would leave the front matter
   saying `NOT_REQUIRED` — this document claiming it needs nothing from the owner while three of its
   eight audit rows are unanswered. That is the failure mode the convention prevents, and it is
   mechanical rather than cultural.
4. **It cannot be tidied away.** A blank cell and a `TBD` both read as an editorial oversight, and a
   careful reviewer's instinct on meeting an oversight is to fix it. Fixing this token is a rule
   violation, not a tidy-up: §19.3 makes it one in writing, and the front-matter interlock makes the
   violation show up in a two-line diff rather than one cell of a wide table.
5. **It keeps the phase honest.** Phase 45's exit criteria require all eight questions answered with
   a verdict, named reviewers and a date. Three tokens here therefore mean Phase 45 is **PARTIAL**,
   and `PROJECT_STATE.md`, `docs/project/ROADMAP.md` and `docs/SESSION-STATE.md` say so with these
   three question numbers named. A `TBD` invites the opposite reading.

An outstanding row's Reviewer and Date cells stay `—`. They are never a role, never "pending", never
a placeholder name, and never the date the token was written: a date in that column means an answer
was given on that day.

**A blocked precondition does not get a sixth token.** If question 5 cannot be run because the site
cannot yet support one of its tasks, the row keeps `OWNER_VERIFICATION_REQUIRED` and its Evidence
cell names the blocker. Inventing `BLOCKED` would let a row look answered when the honest statement
is that nobody has answered it.

### 19.3 Who may write in which column

**Evidence may be produced by anybody; a verdict is signed by a person.** Questions 2, 3, 6 and 7
resolve to measurements — a pixel height, a derivative width, a click count, a scroll width — and a
measurement is reproducible, so the Evidence cell names the mechanism precisely enough for a
stranger to re-run it and the verdict may stand unsigned, with `—` in Reviewer. Questions 1, 5 and 8
resolve to judgement or to somebody's lived attempt. Nothing can be re-run, so the verdict is void
without a name and a date. That is the whole rule, and it is why row 2 may carry `FAIL` with no
signature while row 1 may not carry `PASS` with one.

**No AI agent signs a row.** An agent may fill *Examined on* and *Evidence* — the routes it opened,
the numbers it measured, the file and line it read — because those are checkable. It may not write
in *Verdict*, *Reviewer* or *Date*, and its name may not appear in *Reviewer* on any row, including
a measured one. The agent measured; a person decides what the measurement means.

**The people who built a thing do not sign question 1, 5 or 8.** That is the point of the three
tokens. An audit that passes itself is the risk §45's own risk table names, and the countermeasure
is not a policy but this table's shape: those three verdicts have exactly one legitimate author
each.

### 19.4 The standing instruction to the owner — question 1

Do this once, in one sitting, on the deployed site rather than a development server, before any
polish change is accepted. It takes about forty minutes and needs no preparation. It is not a review
of the work: it is the only recorded answer to the question the whole project is for.

**What to open, in this order, at 1440 × 900 on a laptop and then at 390 × 844 on your own phone:**
`/` · `/large-format` · `/about` · `/process`. Eight visits. Do not open `/collection/…` or
`/collections/…` — those routes return "not found" today for the reasons in §19.5, and a broken door
tells you nothing about the room.

**How to look.** For each visit, wait for the page to finish, then scroll once at a normal reading
pace to the bottom and stop. Do not click into anything, do not read the copy closely, and do not
compare it with another site. Then write four short lines, in your own words:

| Line | What to write |
|---|---|
| First thing | The first thing your eye landed on — an image, a word, a shape, an empty space |
| Studio or shop | Whether this page reads as a design studio or as a shop, in one sentence |
| The weakest thing | The one thing on this page that most works against the studio reading |
| Would you send it | Whether you would send this page, as it is, to someone whose opinion you care about |

**Then the verdict, once, for the site as a whole.** One line: `Yes` — or `No, because …` followed
by the single most important reason. Not a score, not a list. If the answer is `No`, the reason
becomes a work item under §19.1 row 1 and it is the highest-priority item in the phase.

**Where it goes.** The four-line notes and the verdict are pasted beneath the §19.1 table under the
heading `Question 1 — the owner's session, <date>`, and row 1's Verdict, Reviewer and Date are
filled in the same commit. Nobody else fills them. If you have not done this, row 1 stays as it is:
the token is the honest state, and the site can ship with it outstanding as long as
`PROJECT_STATE.md` says Phase 45 is PARTIAL and says why.

**Questions 5 and 8 are the same kind of instruction and live with the procedure they belong to**,
in `docs/ops/TESTING.md` §14 — §14.2 for the five-task walkthrough, §14.3 for the ten Studio
operations, §14.4 for the record. They are written there rather than here so that the tasks, the
thresholds and the record form are one text in one place; §19.1 cites them rather than restating
them, for the same reason a token has one home.

### 19.5 What was deliberately not examined, and why

Recorded so a reader does not mistake an absence for an oversight, and so nobody "fixes" the audit
by examining a route that cannot be examined.

| Not examined | Why | Where it is tracked |
|---|---|---|
| `/collection/<slug>`, all seven | Every `categories` row is `DRAFT`, so each route calls `notFound()`. The owner cannot clear it either: `saveCategoryAction` writes name, subtitle, description, order, hero image and the two SEO fields and never `status`, and no `publishCategoryAction` exists anywhere in the repository | `docs/project/ROADMAP.md` |
| `/collections/<slug>` | Ten of the eleven rows sit at `DRAFT_COLLECTION_CONCEPT`, which only an owner or admin may clear. The one published collection is the Phase 42 test fixture, not editorial content | `docs/project/ROADMAP.md` |
| `/faq`, `/privacy`, `/terms` | Published `pages` rows with zero published sections, so all three 404. An editor cannot fix them: `faq-list` and `rich-text` are PLANNED block types that render nothing | `docs/project/ROADMAP.md` |
| The 3D viewer | Question 4's own answer: no model exists and `three_d_viewer` is off | Nothing to track until the owner supplies a model |
