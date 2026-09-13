---
name: studio-surfaces
description: Use when building or reviewing anything under app/(studio)/ — a Studio page, table, form, drawer or action. Encodes the permission rule, the list→detail→edit pattern, and the verification gap you must plan around.
---

# Studio is an application, and it is behind auth

## Every mutation checks twice

A server-side permission check **in addition to** RLS, on every mutation. RLS is the floor, not the
gate. `scripts/security/check-action-guards.mjs` enforces it.

Zod at every trust boundary. All reads and writes go through `lib/supabase/repositories/**` —
`scripts/db/check-data-layer.mjs` fails on a `.from(` or `.rpc(` outside that directory.

## The verification gap — plan around it

**The local harness has no auth server, so 156 Studio specs skip.** No Studio interaction can be
browser-tested here. `docs/ops/TESTING.md` §13 records it.

What this means in practice:

- Cover Studio logic with **unit and integration tests**, which do run.
- Be cautious adopting anything interactive into Studio — you cannot regression-test it.
- When you ship a Studio-only behaviour, **say plainly that it is unverified in that surface**.
  Do not report it as tested.

This is the top blocker for the Studio redesign. Resolving it (GoTrue locally, or a hosted preview
with a fixture account) unblocks more than any code change.

## Islands are cheap here, and only here

Studio is outside the public island budget. But **a component shared with a public route is
public** — `Tabs` renders in Studio *and* on `/product/[slug]`. Add Studio-only behaviour behind a
prop that defaults off, opt in at the Studio call site, and test that the default has not moved.

## Interface conventions

Restrained dark sidebar, warm neutral workspace, **Inter for all UI and data text** — the display
serif is for brand moments, never dense data entry. Consistent `list → detail → edit`. Page actions
separate from record actions. Preserve breadcrumbs, search state, filters and return paths.

Make understandable: pending changes, save results, publication readiness, and permission limits. A
control a role may not use should say so rather than fail on click.

## Never

Never let Studio write to a research table across the isolation boundary. Never surface a secret
value, prefix or length — the Environment page reports **reachability only**. Never publish on the
owner's behalf: seeding writes DRAFT, and promotion is a person's act.

## Read before editing

`docs/studio/STUDIO_GUIDE.md`, `docs/ops/SECURITY.md`, `docs/ops/TESTING.md` §13.
