# SESSION-STATE

> Updated at the end of every phase, per requirement FEAT §40. Read this second, after
> `CLAUDE.md`, before doing anything. **Verify the claims below against the repository** —
> never assume a phase completed because this file says so.

---

## Current Phase

**Phase 02 — Reference UI Audit + Design System.**

## Status

**PARTIAL.** The token layer, all 32 primitives, both motion helpers, the dev gallery, the
five gates and the eight-width visual/accessibility harness are built and verified. The
seven behavioural patterns are the only Phase 02 scope not yet written.

## Completed

- Toolchain scaffolded per CANONICAL D1/D2: Next.js 16 App Router, React 19, TypeScript
  strict with `noUncheckedIndexedAccess`, Tailwind 4 CSS-first, Vitest, Playwright, ESLint,
  Prettier, and `.github/workflows/ci.yml` running every gate as its own step.
- **Token layer.** `app/styles/tokens.css` is the only file permitted a colour literal;
  `scheme.css` redeclares an identical 28-token semantic set for DEEP, INK and BONE;
  `globals.css` carries the Tailwind `@theme` bridge and no values of its own.
- **Every derived value re-verified before use.** The palette quartet re-counted against the
  Higgsfield manifest (114 assets each). The ten-step neutral ramp reproduces exactly from
  the OKLab rule in DESIGN_SYSTEM §2.2 — all ten hexes and luminances to four decimals.
  Every contrast claim recomputed, including champagne on bone at 2.52:1 (fails AA at every
  size) and its replacement champagne-deep at 5.05:1.
- **32 primitives** in `components/primitives/**`, each with behaviour-level tests.
- **Motion helpers** implementing the §4.3 contract: reduced motion renders the final state,
  not a shortened animation; content is never gated on motion; the static branch is used on
  both the server and the first client render so hydration agrees.
- **Dev gallery** at `/design-system`, verified 200 under `next dev` and 404 in a production
  build — and since the route is in the production manifest, the 404 provably comes from the
  `notFound()` guard rather than an absent route.
- **Licence audit of all eleven FEAT §7 sources.** 5 NOT_ADOPTED, 6 REJECTED, none adopted.
- **Five gates**, each proved to bite by provoking the failure it exists for.

## Files Created

```
package.json · tsconfig.json · next.config.ts · postcss.config.mjs · eslint.config.mjs
playwright.config.ts · vitest.config.ts · .prettierrc.json · .github/workflows/ci.yml
app/layout.tsx · app/globals.css · app/styles/{tokens,scheme,base}.css
app/(site)/design-system/page.tsx
components/primitives/**  (32 components + motion/{Reveal,useReducedMotion})
components/devtools/Specimen.tsx
lib/ui/{cn.ts,polymorphic.ts}
scripts/design/{check-tokens,check-registry,check-utilities}.mjs
tests/setup/vitest.setup.ts · tests/e2e/design-system.spec.ts
tests/e2e/design-system.spec.ts-snapshots/  (8 baselines)
```

## Database Changes

**None.** Phase 02 touches no data. The schema lands in Phase 03.

## Tests Run

```
npx tsc --noEmit · npx eslint . · npx prettier --check .
npx vitest run
npx playwright test            (8 projects = the FEAT §45 widths)
node scripts/design/check-tokens.mjs · check-utilities.mjs · check-registry.mjs
npm run manifest:verify · npm run media:check-ids
NODE_ENV=production npm run build && npm start   (route guard)
```

## Test Results

- Unit: **209 tests across 34 files**, all passing.
- E2E: **32 tests across 8 widths**, all passing — specimens, visual baseline, axe scan,
  keyboard reachability at each width.
- Zero critical or serious axe violations.
- All five gates clean; manifest still regenerates byte-identically.

## Known Issues

**BLOCKING, and outside this session's reach: GitHub Actions cannot provision a runner.**
Every CI run since the workflow was added — 12 and counting — fails in 2-5 seconds with
`runner_id: 0`, no runner name and **zero steps executed**, including the first. A job that
dies before a runner picks it up has not run any of this PR's code. This is an account-level
condition (typically exhausted minutes, a spending limit on a private repository, or Actions
disabled), not a defect in the diff. The full CI sequence passes locally from a clean
`npm ci` with `CI=true`. Recorded with evidence on PR #2.

**Resolved during this phase**, recorded because each was a real defect:

1. `Switch` rendered a button with **no accessible name** — a critical axe violation. The
   unit tests had hidden it by passing `aria-label` themselves. Now optional `label` with a
   dev-time assertion covering all three name sources, plus a test that the name does not
   change when toggled.
2. Four component groups independently hit the **polymorphic ref** error. Fixed in
   `lib/ui/polymorphic.ts` and documented as DESIGN_SYSTEM §6.3 so a fifth does not.
3. **Three false positives in my own gates** — unescaped variant selectors, bare utility
   roots matching prose, unstripped block comments, and CSS leading-digit escaping.
4. Playwright polled `/` for readiness, which legitimately 404s until Phase 10.

## Remaining Work

The seven behavioural patterns — `Dialog`, `Drawer`, `Tooltip`, `Tabs`, `Accordion`,
`Disclosure`, `DropdownMenu` — then `/design-system/patterns`, a baseline regeneration, and
the D9 sweep.

## Next Exact Action

Finish the seven patterns in `components/patterns/**` against `DESIGN_SYSTEM.md` §11 and the
WAI-ARIA Authoring Practices, each with behaviour-level tests. `FocusTrap` (RC-031) is built
and is what `Dialog` and `Drawer` compose; its contract is documented in its own header.
Then extend the gallery with a `/design-system/patterns` route, regenerate the eight
baselines, and tick the Phase 02 exit criteria.

## Relevant Documentation

`docs/project/phases/PHASE-00-04.md` §PHASE 02 · `docs/design/DESIGN_SYSTEM.md` ·
`docs/design/COMPONENT_REGISTRY.md` · `docs/architecture/CANONICAL-DECISIONS.md` D1/D2/D6

## Environment Requirements

Node 22, npm 10. **TypeScript is pinned to 6.0.3 and ESLint to 9.x** — the reasons are in
`eslint.config.mjs`; do not bump either without reading them. Playwright uses the image's
pre-installed Chromium via `PLAYWRIGHT_CHROMIUM_PATH`; do not run `playwright install`.
No Supabase or Cloudinary credentials are set; Phase 02 needs none.

## Migration Requirements

**None.** `supabase/migrations/` does not exist until Phase 03.
