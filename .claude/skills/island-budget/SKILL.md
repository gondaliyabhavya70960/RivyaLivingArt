---
name: island-budget
description: Use before adding 'use client', a React hook, an event handler, or any interactive library to a public route. Encodes why the island budget exists, what counts against it, and how to ship interaction without spending it.
---

# Client JavaScript on a public route is rationed

## The numbers

**5 islands** in the initial bundle across the homepage's layouts and page, enforced by
`scripts/site/check-island-budget.mjs`. Per-route budgets are enforced too — 104 routes, the
heaviest being `/product/[slug]` at 6/6.

The current five: `SiteErrorCopy`, `MegaMenu`, `MobileNav`, `SearchCombobox`, `VitalsReporter`.
Eight more load on demand and do not count: `ContentCarousel`, `Configurator`, `InquiryForm`,
`HeroMotion`, `MaterialSequence`, `ChapterMedia`, `MediaVideo`, `ModelViewerMount`.

## The multiplier that catches people

`components/sections/registry.ts` **statically imports every section renderer**. So one `'use client'`
anywhere in a renderer's import tree is not one island — it is an island on **all sixteen CMS
routes**. `scripts/site/check-client-boundary.mjs` fails the build on a `'use client'` in a public
route file.

This is the single most common reason a third-party component cannot be adopted here, and it has
nothing to do with the component's quality.

## How to ship interaction anyway

1. **Ask whether CSS can do it.** The band entrance is a scroll-driven CSS animation costing zero
   islands, after an earlier `Reveal` client component sat unused because it was unusable.
2. **`next/dynamic` from inside a Server Component.** This is how the eight on-demand islands ship.
3. **Put it in Studio.** Studio is behind auth and outside the public budget — the one surface where
   an island is genuinely cheap.
4. **Accept the reduced version.** `SectionRail` has no active-state highlight because tracking the
   visible band costs either a scroll handler on sixteen routes or a static list of every section on
   a page whose section count is data. An index without a highlight is still an index.

## A component shared between Studio and public is public

`Tabs` renders in Studio **and** on `/product/[slug]`. Changing its default behaviour changes the
public site. When adding a behaviour that only Studio wants, put it behind a prop that defaults off
and opt in at the Studio call site — and write the test that fails if somebody flips the default.

## Read before editing

`docs/ops/PERFORMANCE.md` §4, `docs/architecture/ARCHITECTURE.md`.
