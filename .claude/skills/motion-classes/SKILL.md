---
name: motion-classes
description: Use when adding, changing or reviewing any animation, transition, transform or scroll-driven effect. Encodes §4.2's six motion classes, which properties each permits, and the contrast failure that opacity-on-scroll caused.
---

# Motion is six classes, and each permits different properties

| Class | Duration | Permits | Typical |
|---|---|---|---|
| **WOOD** — settle | `slow` | `translateY` only (not opacity — see below) | First appearance of a band |
| **RESIN** — flow | `flow` | opacity, `clip-path` inset | Media revealing |
| **LIGHT** — specular | `fast`/`quick` | colour, border, opacity, `box-shadow` — **no transform at all** | Hover, focus, active |
| **FORM** — mass | `base` | **transform + opacity** | Drawers, dialogs, accordions, a tab list's travelling indicator |
| **SPACE** — depth | `slower` | transform, ≤24px, never on text | Scroll-linked drift |
| **ART** — held | `scene` | one per viewport per page | Hero entrance, lightbox |

**Picking the class picks the properties.** A travelling bar is a `transform`, so it is FORM and not
LIGHT — LIGHT forbids transform outright. Getting this backwards is what made a previous session
conclude a sliding tab indicator could not be built at all.

## The rule that cost a serious accessibility failure

**No keyframe in `app/styles/motion.css` may animate `opacity`.** `tests/unit/motion-layer.test.ts`
fails if one does, asserted over every keyframe rather than by name.

Why: `animation-fill-mode: both` on a `view()` timeline holds a band at its `from` keyframe until it
enters, so on a long page exactly one band is part way through the range at any moment — and while
it is, every colour inside it composites against the ground behind the section. **Contrast became a
function of scroll position.** Measured on `/large-format`: a heading at `opacity: 0.184` gave
1.82:1 where the opaque band is 17.55:1. It failed axe at SERIOUS, and no colour choice could have
fixed it.

A rise without a fade is still an entrance.

## Three cross-cutting rules

- **Motion never gates content.** Every animated element is present and readable in the
  server-rendered HTML. A page with JavaScript disabled is complete.
- **Motion never moves the LCP element.** The first band on a page does not animate —
  `main > section:first-of-type.rv-reveal { animation: none }`.
- **Motion never animates a layout property.** `width`, `height`, `top`, `left`, `margin`, `padding`
  are not animatable here. Compositor properties only. To resize a bar, use `scaleX` on a 1px
  element, never an animated `width`.

## Reduced motion is a branch, not a speed

`base.css`'s floor sets `animation-duration` — a **time** duration, which a scroll-progress timeline
ignores. Every scroll-driven rule carries its own `animation: none` and `animation-timeline: none`
under `prefers-reduced-motion: reduce`. For transitions, `motion-reduce:transition-none`.

## Read before editing

`docs/design/DESIGN_SYSTEM.md` §4.2 and §4.2.1, `docs/ops/TESTING.md` §5.1.
