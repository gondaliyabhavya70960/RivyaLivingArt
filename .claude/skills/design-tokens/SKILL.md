---
name: design-tokens
description: Use when writing or reviewing any CSS, Tailwind class, or component style in this repository — choosing a colour, a length, a duration, a font size, or a radius. Prevents the build failures that colour literals and ad-hoc values cause.
---

# Colour and length come from tokens, and only from tokens

## The one rule that fails the build

`app/styles/tokens.css` is the **only** file in this repository permitted to hold a colour
literal. Everywhere else — component files, other stylesheets, arbitrary Tailwind values — a
hex, `rgb()`, `hsl()` or named colour is a build failure.

Enforced by `scripts/design/check-tokens.mjs` and `scripts/design/check-token-usage.mjs`, both in
`npm run check`. There is no exception and no escape hatch.

## Three layers, and you almost always want the third

| Layer | Example | Use it |
|---|---|---|
| Primitive | `--rv-color-mineral`, `--rv-neutral-500` | Only inside `tokens.css` and `scheme.css` |
| Semantic | `--rv-surface-ground`, `--rv-ink-primary`, `--rv-line-strong` | When a component needs a role |
| Component | `--rv-header-h`, `--rv-rail-gutter` | A value one component owns |

In a component, reach for the **semantic** name through its Tailwind bridge: `bg-surface`,
`text-ink`, `text-ink-secondary`, `border-line`, `bg-surface-sunken`. A component never asks which
colour scheme it is in — it reads the role and the scheme supplies the value.

## Five schemes, not three

`DEEP`, `INK`, `BONE`, and since amendment A46 `MINERAL` and `SAND`. They are the values of
`page_sections.theme`. There is **no Zod enum and no check constraint** — `schemeOf()` in
`components/sections/SectionShell.tsx` is the single parser, and an unknown value falls back rather
than throwing, so a page never 500s because somebody typed "dark".

Which ground a band gets when nobody has said is decided once per page by
`components/sections/rhythm.ts`, never by a renderer. Do not reach for a neighbour's surface.

## Lengths, durations and easings

Same rule. `--rv-duration-*` and `--rv-ease-*` for time, `--rv-space-*` for spacing. A hand-written
`600ms` or a bespoke `cubic-bezier()` in raw CSS is caught by
`scripts/design/check-motion-tokens.mjs`.

**The CSS-variable Tailwind form is `duration-(--rv-duration-quick)` with parentheses.** The bracket
form `duration-[--rv-duration-quick]` emits an invalid declaration and silently drops the
transition. Do not "tidy" the parentheses into brackets.

## Before you add a token

Check it does not already exist. The neutral ramp is **generated** by OKLab interpolation and
re-derived by the gate — editing a ramp step by hand is reverted on the next run. Repointing a
primitive re-derives everything downstream of it: repointing `--rv-color-bone` was tried and refused
because it moved nine of ten ramp steps.

## Read before editing

`docs/design/DESIGN_SYSTEM.md` §1 (token architecture), §2 (colour), §2.4a (the warm grounds).
