---
name: section-renderer
description: Use when adding, editing or reviewing a CMS block renderer in components/sections/ — anything that draws a band on a public page. Encodes the Server Component rule, the no-copy-in-JSX rule, and how a band decides its own ground.
---

# A section renderer is a Server Component that renders data

## Three rules that are not negotiable

**1. It may never be a Client Component.** `components/sections/registry.ts` imports every renderer,
so one `'use client'` anywhere in the tree becomes an island on **all sixteen CMS routes**.
`scripts/site/check-client-boundary.mjs` fails the build on it. When a band genuinely needs
interaction, load it through `next/dynamic` from inside the renderer — that is how
`ContentCarousel`, `Configurator` and `MediaVideo` ship.

**2. No marketing copy in JSX.** Components render `section.heading`, `section.eyebrow`,
`section.body` — never a literal headline. `scripts/cms/check-section-copy.ts` scans string literals
and fails on a visitor-readable one. Changing website copy must never require a code change.

A generated string is not copy: `String(index + 1).padStart(2, '0')` is an expression and passes.

**3. It renders what it is given.** `lib/cms/resolve.ts` has already applied status, the publish
window and `is_visible`. Two places deciding what is live is how one route ends up with a band the
other lacks.

## The shell does the chrome

Wrap in `SectionShell`. It supplies the scheme band, the vertical rhythm from `SECTION_RHYTHM`
(exhaustive over all 34 block types), the container, and the `id="section-<id>"` anchor that
`SectionRail` links to.

**Do not pass a theme.** The page decides: `withDefaultTheme()` in `components/sections/rhythm.ts`
fills `theme` on every band that has none, alternating MINERAL and SAND and interrupting with INK
for the material blocks. A dark band does not advance the warm counter, which is what stops two SAND
bands meeting across a hero. An editor's explicit theme always wins.

## Declining to render

Roughly twenty renderers return `null` rather than drawing an empty frame. The common guard is
`items.length === 0 && !hasSectionCopy(section)`. Note `hasSectionCopy` is **true whenever an eyebrow
exists**, so a band with an eyebrow renders its empty state rather than disappearing.

**If your renderer can return null, know that `SectionRail` needs to know.** A band that carries an
eyebrow but renders nothing produced a dead link in the page index. The rail now also requires
`reference.result.reason === 'OK'`; if you add a new way to decline that is not reference-driven,
check `railEntries()` in `components/patterns/SectionRail/index.tsx`.

## Heading levels are the renderer's job

`SectionList` assigns **no** heading levels. `SectionCopy` defaults to `level = 2`. A renderer that
wants the page's `h1` must pass `level={isFirst ? 1 : 2}` — `/faq` had no `h1` for exactly this
reason, and a seed comment claiming `SectionList` handled it was wrong.

## Read before editing

`docs/design/DESIGN_SYSTEM.md` §2.4a, `docs/design/COMPONENT_REGISTRY.md` §7.
