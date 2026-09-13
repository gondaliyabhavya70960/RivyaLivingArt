---
name: accessibility-contract
description: Use when building or reviewing any interactive component, heading structure, form, or colour pairing. Encodes the APG contracts this repo holds itself to and the failures its axe sweep has actually caught.
---

# Accessibility here is a contract, not a lint pass

## The gates

`tests/e2e/a11y/` runs as a required CI job: axe sweep (zero **critical**, zero **serious** on every
public route and seven Studio routes, at 1440 and 390), landmarks, headings, forms, touch targets
(≥44×44 at 390), reduced motion, zoom reflow at 200% and 320px. Plus **two** pre-browser guards in
`npm run check`: `check-contrast.mjs` and `check-focus-styles.mjs`.

`tests/e2e/a11y/exceptions.json` ships with **zero rows** and its row count is an exit criterion.
Adding a row is not how you pass.

## Selection and state never rest on colour alone

WCAG 1.4.1. A selected tab carries an underline **and** an ink step. A component that signals only
with `--rv-ink-accent` fails for a reader who cannot separate the two inks.

This has a real failure mode worth knowing: an indicator that is drawn from a **measurement** can
measure zero — inside a `display: none` ancestor, or before a webfont resolves. `Tabs` guards with
`w > 0` and falls back to the per-tab underline, so the strip is never without a shape. If you build
anything measured, ask what it draws when the measurement is zero.

## Contrast: the static gate cannot see everything

`scripts/a11y/check-contrast.mjs` proves every semantic pair in every scheme — 60 pairs across 5
schemes. It was passing on the day `/large-format` failed axe at SERIOUS, and both were right: the
band was being composited at partial opacity mid-scroll. **A token matrix cannot see a rendered
page.** If axe reports a contrast failure that moves when the page gets taller, probe the computed
`opacity` of the element's section before reaching for a re-run.

## Exactly one `h1`, and the renderer decides

`SectionList` assigns no heading levels. A renderer that should own the page's `h1` passes
`level={isFirst ? 1 : 2}`. Never skip a level.

## Patterns carry their full APG contract

A tabs widget is a strip **plus** panels bound by `aria-controls`/`aria-labelledby` — `role="tablist"`
and `role="tab"` alone is a strip, not tabs. Roving tabindex (exactly one `0`), arrow keys, Home/End,
panels at `tabindex="-1"`.

This is a live evaluation criterion, not theory: a third-party tabs component was refused because it
had the roles and the keyboard model and **zero `aria-controls` and zero `tabpanel`**. Adopting it
would have been a regression a licence check and a bundle check would both have passed.

## Never

Never `opacity: 0.5` for a disabled state — it drags contrast below the §2.6 exemption. Use
`text-ink-disabled`. Never remove an outline without replacing it
(`scripts/a11y/check-focus-styles.mjs`). Never navigate on a timer (WCAG 2.2.1) — note this one is
a **rule without a gate**: `ACCESSIBILITY.md` §1.2 states it and nothing checks it, so it is on you.

## Read before editing

`docs/ops/ACCESSIBILITY.md`, `docs/ops/TESTING.md` §5.
