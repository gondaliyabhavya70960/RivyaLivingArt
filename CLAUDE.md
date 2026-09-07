# CLAUDE.md — working agreement for this repository

## Read these first, in this order, at the start of every session

1. `CLAUDE.md` (this file)
2. `PROJECT_STATE.md` — what is actually built
3. `CONTEXT.md` — what this project is and who it is for
4. `docs/SESSION-STATE.md` — where the last session stopped and the next exact action
5. `docs/project/ROADMAP.md` — the phase map

Then **inspect the repository state**. Never assume a phase completed because a document says it
was planned. Verify: does the code exist, does it run, do the tests pass?

## The binding contract

`docs/architecture/CANONICAL-DECISIONS.md` fixes the stack, repository layout, route maps,
database naming, media rules, documentation map, environment variable names and the phase
completion contract. **If anything contradicts it, that thing is wrong.** Amend the contract
explicitly; never diverge silently.

## Specifications of record

`docs/requirements/` holds the two governing specifications verbatim. They are read-only history.
Do not edit them — capture decisions that supersede them as amendments in CANONICAL-DECISIONS.md.

## Non-negotiable business rules

- **No online checkout. No payment gateway. No customer accounts.** Conversion ends in a
  persisted inquiry, then a WhatsApp handoff.
- **An inquiry must be persisted before any WhatsApp redirect.** Never redirect if the save failed.
- **Never fabricate business facts** — product names presented as inventory, prices, dimensions,
  materials, lead times, delivered projects, named customers, testimonials, sales figures, awards,
  certifications or durability claims. Where copy asserts real business capability, seed it
  `OWNER_VERIFICATION_REQUIRED` and let the owner confirm.
- **Scraped competitor data is research only.** Never published, never publicly searchable, never
  auto-imported into the Rivya catalog.
- **No marketing copy inside JSX.** Components render `section.heading` from the CMS, never a
  literal headline. Changing normal website copy must never require a code change.

## Media rule

250 Higgsfield assets already exist and are catalogued in `data/higgsfield/asset-manifest.json`.
Asset priority is: real Rivya media → approved user asset → **existing Higgsfield asset** →
existing render → new generation → technical fallback. Regenerating something already in the
manifest is a defect, not a shortcut. Rebuild the manifest with
`python3 scripts/media/build-higgsfield-manifest.py`.

## Phase discipline

A phase is COMPLETE only when all ten conditions in CANONICAL-DECISIONS.md D9 hold. At the end of
every phase, update `docs/SESSION-STATE.md`, `PROJECT_STATE.md` and `CHANGELOG.md`, plus the
domain documentation the change touched (see the documentation update contract in
`docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` §43).

## House style

- TypeScript strict. Server Components by default; Client Components only where interaction demands it.
- Zod at every trust boundary. Server-side permission checks on every mutation, in addition to RLS.
- Tailwind + CSS custom properties for tokens. Build the design system before the pages.
- British-leaning prose in documentation; follow the specification's spelling when quoting seeded copy.
- Never log or display a secret value, prefix or length.
